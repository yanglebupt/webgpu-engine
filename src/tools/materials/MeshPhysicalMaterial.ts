import { Vec3, Vec4 } from "wgpu-matrix";
import fragment, {
  M_U_NAME,
  MaterialUniform,
} from "../shaders/fragment-wgsl/mesh/pbr-light.wgsl";
import {
  ShaderDataDefinitions,
  StructuredView,
  makeShaderDataDefinitions,
  makeStructuredView,
} from "webgpu-utils";
import { MeshMaterial } from "./MeshMaterial";
import { Texture } from "../textures/Texture";
import { StaticTextureUtil } from "../utils/StaticTextureUtil";
import { SolidColorTextureType } from "../scene/cache";
import { BuildOptions } from "../scene/types";

export interface MeshPhysicalMaterial {
  baseColorFactor: Vec4;
  metallicFactor: number;
  roughnessFactor: number;
  emissiveFactor: Vec3;
  normalScale: number;
  bumpScale: number;
  occlusionStrength: number;
  opacity: number;
  alphaCutoff: number;
  applyNormalMap: boolean;
  useEnvMap: boolean;
  transparent: boolean;

  /* 下面属性不支持动态修改 */
  useAlphaCutoff: boolean;
  baseColorTexture?: Texture;
  normalTexture?: Texture;
  bumpTexture?: Texture;
  metallicRoughnessTexture?: Texture;
  emissiveTexture?: Texture;
  occlusionTexture?: Texture;
  alphaTexture?: Texture;
}

export class MeshPhysicalMaterial extends MeshMaterial {
  static defs: ShaderDataDefinitions;
  static {
    try {
      MeshPhysicalMaterial.defs = makeShaderDataDefinitions(MaterialUniform);
    } catch (error) {}
  }
  private uniformValue: StructuredView;
  private uniform!: GPUBuffer;
  private defaultFormat: string;
  constructor(options?: Partial<MeshPhysicalMaterial>) {
    super();
    this.defaultFormat = StaticTextureUtil.textureFormat.split("-")[0];
    Object.assign(this, {
      baseColorFactor: [1, 1, 1, 1],
      metallicFactor: 1,
      roughnessFactor: 1,
      emissiveFactor: [1, 1, 1],
      normalScale: 1,
      bumpScale: 1,
      occlusionStrength: 1,
      opacity: 1,
      useAlphaCutoff: false,
      alphaCutoff: 0,
      applyNormalMap: false,
      useEnvMap: false,
      transparent: false,
      ...options,
    });
    this.uniformValue = makeStructuredView(
      MeshPhysicalMaterial.defs.uniforms[M_U_NAME]
    );
  }

  protected get textures() {
    return [
      {
        a: this.baseColorTexture,
        d: "opaqueWhiteTexture",
        f: this.defaultFormat,
      },
      {
        a: this.normalTexture,
        d: "defaultNormalTexture",
        f: this.defaultFormat,
      },
      {
        a: this.metallicRoughnessTexture,
        d: "opaqueWhiteTexture",
        f: this.defaultFormat,
      },
      {
        a: this.emissiveTexture,
        d: "transparentBlackTexture",
        f: this.defaultFormat,
      },
      {
        a: this.occlusionTexture,
        d: "transparentBlackTexture",
        f: this.defaultFormat,
      },
    ] as Array<{
      a?: Texture;
      d: SolidColorTextureType;
      f: GPUTextureFormat;
    }>;
  }

  onChange() {
    if (!this.device) return;
    this.uniformValue.set({
      baseColorFactor: this.baseColorFactor,
      metallicFactor: this.metallicFactor,
      roughnessFactor: this.roughnessFactor,
      emissiveFactor: this.emissiveFactor,
      normalScale: this.normalScale,
      occlusionStrength: this.occlusionStrength,
      alphaCutoff: this.alphaCutoff,
      applyNormalMap: Number(this.applyNormalMap),
      useEnvMap: Number(this.useEnvMap),
    });
    this.device.queue.writeBuffer(
      this.uniform,
      0,
      this.uniformValue.arrayBuffer
    );
  }

  build({ device, cached, scene }: BuildOptions) {
    const bindGroupLayoutEntries: GPUBindGroupLayoutEntry[] = [
      {
        binding: 0,
        visibility: GPUShaderStage.FRAGMENT,
        buffer: { type: "uniform" },
      },
      ...([1, 2, 3, 4, 5].map((binding) => ({
        binding: binding,
        visibility: GPUShaderStage.FRAGMENT,
        texture: { viewDimension: "2d" },
      })) as GPUBindGroupLayoutEntry[]),
      {
        binding: 6,
        visibility: GPUShaderStage.FRAGMENT,
        sampler: { type: "filtering" },
      },
    ];
    this.uniform = device.createBuffer({
      size: this.uniformValue.arrayBuffer.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    const texturesView = this.textures.map(({ a, d, f }) => {
      if (a) {
        a.upload(device, { sampler: cached.sampler, mipmap: cached.mipmap }, f);
        return a.texture.createView();
      } else {
        return cached.solidColorTexture
          .get({
            format: f,
            type: d,
          })
          .createView();
      }
    });
    this.device = device;
    return {
      fragment: {
        resources: [this.uniform, ...texturesView, cached.sampler.default],
        bindGroupLayoutEntries,
        shader: {
          code: fragment,
          context: {
            polyfill: scene.polyfill,
            useAlphaCutoff: this.useAlphaCutoff,
          },
        },
      },
    };
  }
}
