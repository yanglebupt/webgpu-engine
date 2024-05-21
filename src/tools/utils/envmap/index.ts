import {
  ShaderDataDefinitions,
  StructuredView,
  makeShaderDataDefinitions,
  makeStructuredView,
} from "webgpu-utils";
import { createComputePipeline, createRenderPipeline } from "../..";
import { createEmptyStorageTexture } from "../../helper";
import { HDRLoader, HDRLoaderReturn } from "../../loaders/HDRLoader";
import { DispatchCompute } from "../Dispatch";
import { MipMap, maxMipLevelCount } from "../mipmaps";
import IBL_BRDF_IS from "./shader/ibl-brdf-is.wgsl";
import { ENV_NAME, EnvMapGroupBinding } from "../../shaders";
import { Vec3, Vec4, mat4 } from "wgpu-matrix";
import vertex from "../../shaders/vertex-wgsl/full-plane.wgsl";
import fragment from "../../shaders/fragment-wgsl/skybox.wgsl";
import { Camera } from "../../camera";
import { StaticTextureUtil } from "../StaticTextureUtil";
import {
  BuildOptions,
  Buildable,
  Computable,
  Renderable,
  VirtualView,
} from "../../scene/types";

export interface EnvMapPartOptions {
  mipLevel?: number;
  INT?: number;
}

export interface EnvMapOptions {
  mipmaps?: boolean;
  diffuse?: EnvMapPartOptions;
  // roughness 分多少级，也就是计算多少次不同的 roughness, 然后对其他 roughness 进行插值
  // 默认是 mipLevelCount 是一样的
  specular?: EnvMapPartOptions & { roughnessDetail?: number };
  samplers?: number;

  diffuseColor?: Vec4;
  specularColor?: Vec4;
  diffuseFactor?: Vec3;
  specularFactor?: Vec3;
}

export interface EnvMap {
  hdrReturn: HDRLoaderReturn<Float32Array>;
  options?: EnvMapOptions;

  polyfill: boolean;
  texture: GPUTexture;
  diffuseTexure: GPUTexture;
  specularTexure: GPUTexture;
  destroyed: boolean;
  destroy(): void;

  renderPipeline: GPURenderPipeline;
  bindGroup: GPUBindGroup;
  uniformBuffer: GPUBuffer;
}

export abstract class EnvMap
  implements
    Buildable,
    Computable,
    Renderable<
      (
        renderPass: GPURenderPassEncoder,
        device: GPUDevice,
        camera: Camera
      ) => void
    >,
    VirtualView
{
  static features: GPUFeatureName[] = ["float32-filterable"];
  static defs: ShaderDataDefinitions;
  static view: StructuredView;
  static {
    try {
      EnvMap.defs = makeShaderDataDefinitions(EnvMapGroupBinding);
      EnvMap.view = makeStructuredView(EnvMap.defs.uniforms[ENV_NAME]);
    } catch (error) {}
  }

  constructor(
    public hdrReturn: HDRLoaderReturn<Float32Array>,
    public options?: EnvMapOptions
  ) {}

  abstract compute(
    computePass: GPUComputePassEncoder,
    device?: GPUDevice
  ): void;

  build({
    device,
    format,
    depthFormat = StaticTextureUtil.depthFormat,
  }: BuildOptions) {
    const { color, width, height } = this.hdrReturn;
    const { mipmaps = true } = this.options ?? {};
    const _format: GPUTextureFormat = "rgba32float";
    this.polyfill = !device.features.has("float32-filterable");

    // hdr 贴图
    this.texture = device.createTexture({
      format: _format,
      mipLevelCount: mipmaps ? maxMipLevelCount(width, height) : 1,
      size: [width, height],
      usage:
        GPUTextureUsage.TEXTURE_BINDING |
        GPUTextureUsage.STORAGE_BINDING |
        GPUTextureUsage.COPY_DST |
        GPUTextureUsage.COPY_SRC,
    });
    device.queue.writeTexture(
      { texture: this.texture },
      color,
      { bytesPerRow: width * 16 },
      { width, height }
    );

    // IBL IS 后的贴图
    this.diffuseTexure = createEmptyStorageTexture(device, _format, [
      width,
      height,
    ]);
    const details = this.options?.specular?.roughnessDetail ?? 3;
    console.log(`roughnessDetail: ${details}`);
    this.specularTexure = createEmptyStorageTexture(device, _format, [
      width,
      height,
      details,
    ]);

    // 渲染管线
    this.renderPipeline = createRenderPipeline(
      vertex(true),
      fragment(),
      device,
      format,
      [null],
      {
        depthStencil: {
          format: depthFormat,
          depthWriteEnabled: true,
          depthCompare: "less-equal",
        },
      }
    );
    const sampler = device.createSampler();
    this.uniformBuffer = device.createBuffer({
      size: 4 * 4 * 4,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM,
    });
    this.bindGroup = device.createBindGroup({
      layout: this.renderPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.uniformBuffer } },
        { binding: 1, resource: sampler },
        { binding: 2, resource: this.texture.createView() },
      ],
    });
  }

  getBufferView() {
    return {
      diffuseColor: this.options?.diffuseColor ?? [1, 1, 1, 1],
      specularColor: this.options?.specularColor ?? [1, 1, 1, 1],
      diffuseFactor: this.options?.diffuseFactor ?? [0.2, 0.2, 0.2],
      specularFactor: this.options?.specularFactor ?? [0.2, 0.2, 0.2],
    };
  }

  render(renderPass: GPURenderPassEncoder, device: GPUDevice, camera: Camera) {
    const pvInverse = mat4.inverse(
      mat4.multiply(camera.matrix, camera.viewMatrix)
    ); // inverse(projection * view) 进行顶点变换，（clip space 转 世界坐标）作为 cubemap 采样的坐标
    const uniformValue = new Float32Array(4 * 4);
    uniformValue.set(pvInverse);
    device.queue.writeBuffer(this.uniformBuffer, 0, uniformValue);
    renderPass.setPipeline(this.renderPipeline);
    renderPass.setBindGroup(0, this.bindGroup);
    renderPass.draw(3);
  }
}

export class EnvMapBRDFIS extends EnvMap {
  public mipmapFilterTexture?: GPUTexture;
  public sampler?: GPUSampler;
  constructor(
    hdrReturn: HDRLoaderReturn<Float32Array>,
    options?: EnvMapOptions
  ) {
    super(hdrReturn, options);
  }

  destroy() {
    if (this.destroyed) return;
    this.mipmapFilterTexture?.destroy();
    this.mipmapFilterTexture = undefined;
    this.destroyed = true;
  }

  compute(computePass: GPUComputePassEncoder, device: GPUDevice) {
    const mipmap = new MipMap(device, computePass);
    mipmap.generateMipmaps(this.texture);
    const mipLevels = [
      this.options?.diffuse?.mipLevel ?? 6,
      this.options?.specular?.mipLevel ?? 4,
    ] as [number, number];
    if (this.polyfill) {
      console.log("float32-filterable unsupported, try use polyfill");
      ////////////////提取 mipmap 后的贴图/////////////////
      this.mipmapFilterTexture = createEmptyStorageTexture(
        device,
        this.texture.format,
        [this.texture.width, this.texture.height, mipLevels.length]
      );
      mipmap.extractMipmap(this.texture, {
        texture: this.mipmapFilterTexture,
        mipLevels,
      });
    } else {
      console.log("float32-filterable supported");
      this.sampler = device.createSampler({
        minFilter: "linear",
        magFilter: "linear",
      });
    }
    const { pipeline, bindGroup, dispatchSize } =
      this.build_IBL_BRDF_IS_ComputePass(device, mipLevels);
    computePass.setPipeline(pipeline);
    computePass.setBindGroup(0, bindGroup);
    computePass.dispatchWorkgroups(
      dispatchSize[0],
      dispatchSize[1],
      dispatchSize[2]
    );
  }

  generateRoughness(details: number) {
    const arr: number[] = [];
    for (let i = 0; i < details; i++) {
      arr.push(i / (details - 1));
    }
    return arr;
  }

  build_IBL_BRDF_IS_ComputePass(
    device: GPUDevice,
    mipLevels: [number, number]
  ) {
    const { width, height, format } = this.texture;
    const roughnesses = this.generateRoughness(
      this.specularTexure!.depthOrArrayLayers
    );
    const samplers = this.options?.samplers ?? 512;
    const { chunkSize, dispatchSize, order } =
      DispatchCompute.dispatchImageAndSampler(
        device,
        [width, height],
        samplers
      );
    console.log(
      `sample chunk size: ${chunkSize}, sample dispatch size: ${dispatchSize}, order: ${order}`
    );
    const pipeline = createComputePipeline(
      IBL_BRDF_IS(
        this.polyfill,
        format,
        mipLevels,
        roughnesses,
        chunkSize,
        dispatchSize[order[2]],
        order,
        this.options?.diffuse?.INT ?? 1e4,
        this.options?.specular?.INT ?? 1e4
      ),
      device
    );
    dispatchSize[order[2]] = roughnesses.length;
    const entries: GPUBindGroupEntry[] = [
      {
        binding: 0,
        resource: this.polyfill
          ? this.mipmapFilterTexture!.createView({
              dimension: "2d-array",
            })
          : this.texture.createView(),
      },
      { binding: 1, resource: this.diffuseTexure.createView() },
      {
        binding: 2,
        resource: this.specularTexure!.createView({
          dimension: "2d-array",
        }),
      },
    ];
    if (!this.polyfill)
      entries.push({
        binding: 3,
        resource: this.sampler!,
      });
    const bindGroup = device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: entries,
    });
    return { pipeline, bindGroup, dispatchSize };
  }
}

export class EnvMapIBLIS extends EnvMap {
  compute(computePass: GPUComputePassEncoder, device?: GPUDevice): void {
    throw new Error("Method not implemented.");
  }
}

export class EnvMapLoader {
  async load(filename: string, options?: EnvMapOptions) {
    const hdrLoader = new HDRLoader();
    const result = await hdrLoader.load<Float32Array>(filename, {
      sRGB: false,
      uint8: false,
    });
    return new EnvMapBRDFIS(result, options);
  }
}
