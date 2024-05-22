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
import { MipMap, getSizeForMipFromTexture, maxMipLevelCount } from "../mipmaps";
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
import { GPUSamplerCache } from "../../scene/cache";

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
  doned: boolean;
  done(): void;

  renderPipeline: GPURenderPipeline;
  bindGroup: GPUBindGroup;
  uniformBuffer: GPUBuffer;
  sampler: GPUSampler;
}

export function getFilterType(polyfill: boolean) {
  const filtered = !polyfill;
  const sampleType: GPUTextureSampleType = filtered
    ? "float"
    : "unfilterable-float";
  const type: GPUSamplerBindingType = filtered ? "filtering" : "non-filtering";
  return { sampleType, type };
}

export function createSamplerByPolyfill(
  polyfill: boolean,
  cached: GPUSamplerCache
) {
  return polyfill ? cached.get({}) : cached.default;
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
    cached,
  }: BuildOptions) {
    const { color, width, height } = this.hdrReturn;
    const { mipmaps = true } = this.options ?? {};
    const _format: GPUTextureFormat = "rgba32float";
    this.polyfill = !device.features.has("float32-filterable");

    this.sampler = createSamplerByPolyfill(this.polyfill, cached.sampler);

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
    this.specularTexure = createEmptyStorageTexture(
      device,
      _format,
      [width, height],
      {
        mipLevelCount: Math.min(
          this.texture.mipLevelCount,
          this.options?.specular?.roughnessDetail ?? 5
        ),
      }
    );

    // 渲染管线
    const { sampleType, type } = getFilterType(this.polyfill);
    this.renderPipeline = createRenderPipeline(
      vertex(),
      fragment(this.polyfill),
      device,
      format,
      [null],
      {
        layout: device.createPipelineLayout({
          bindGroupLayouts: [
            device.createBindGroupLayout({
              entries: [
                {
                  binding: 0,
                  visibility: GPUShaderStage.FRAGMENT,
                  buffer: { type: "uniform" },
                },
                {
                  binding: 1,
                  visibility: GPUShaderStage.FRAGMENT,
                  sampler: { type },
                },
                {
                  binding: 2,
                  visibility: GPUShaderStage.FRAGMENT,
                  texture: { sampleType },
                },
              ],
            }),
          ],
        }),
        depthStencil: {
          format: depthFormat,
          depthWriteEnabled: true,
          depthCompare: "less-equal",
        },
      }
    );
    this.uniformBuffer = device.createBuffer({
      size: 4 * 4 * 4,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM,
    });
    this.bindGroup = device.createBindGroup({
      layout: this.renderPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.uniformBuffer } },
        { binding: 1, resource: this.sampler },
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
      specularDetails: this.specularTexure.mipLevelCount,
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
  public hasGeneratedMips = false;
  constructor(
    hdrReturn: HDRLoaderReturn<Float32Array>,
    options?: EnvMapOptions
  ) {
    super(hdrReturn, options);
  }

  done() {
    if (this.doned) return;
    this.doned = true;
  }

  compute(computePass: GPUComputePassEncoder, device: GPUDevice) {
    if (!this.hasGeneratedMips) {
      const mipmap = new MipMap(device, computePass);
      mipmap.generateMipmaps(this.texture);
      this.hasGeneratedMips = true;
    }
    const mipLevels = [
      this.options?.diffuse?.mipLevel ?? 6,
      this.options?.specular?.mipLevel ?? 4,
    ] as [number, number];
    const { pipeline, createBindGroup, dispatchSize, roughnesses } =
      this.build_IBL_BRDF_IS_ComputePass(device, mipLevels);
    computePass.setPipeline(pipeline);
    for (let i = 0; i < roughnesses.length; i++) {
      computePass.setBindGroup(0, createBindGroup(i));
      const _ds = getSizeForMipFromTexture(
        [dispatchSize[1], dispatchSize[2]],
        i
      );
      computePass.dispatchWorkgroups(1, _ds[0], _ds[1]);
    }
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
    const details = this.specularTexure.mipLevelCount;
    console.log(`roughness details: ${details}`);
    const { width, height, format } = this.texture;
    const roughnesses = this.generateRoughness(details);
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

    const { sampleType, type } = getFilterType(this.polyfill);

    console.log(
      `float32-filterable ${this.polyfill ? "not" : ""} supported`,
      sampleType,
      type,
      this.polyfill ? "use polyfill" : ""
    );

    const pipeline = createComputePipeline(
      IBL_BRDF_IS(
        this.polyfill,
        format,
        mipLevels,
        chunkSize,
        dispatchSize[order[2]],
        order,
        this.options?.diffuse?.INT ?? 1e4,
        this.options?.specular?.INT ?? 1e4
      ),
      device,
      {
        layout: device.createPipelineLayout({
          bindGroupLayouts: [
            device.createBindGroupLayout({
              entries: [
                {
                  binding: 0,
                  visibility: GPUShaderStage.COMPUTE,
                  texture: { sampleType },
                },
                {
                  binding: 1,
                  visibility: GPUShaderStage.COMPUTE,
                  storageTexture: { access: "write-only", format },
                },
                {
                  binding: 2,
                  visibility: GPUShaderStage.COMPUTE,
                  storageTexture: {
                    access: "write-only",
                    format,
                  },
                },
                {
                  binding: 3,
                  visibility: GPUShaderStage.COMPUTE,
                  sampler: {
                    type,
                  },
                },
                {
                  binding: 4,
                  visibility: GPUShaderStage.COMPUTE,
                  buffer: { type: "uniform" },
                },
              ],
            }),
          ],
        }),
      }
    );
    const createBindGroup = (baseMipLevel: number) => {
      const buffer = device.createBuffer({
        size: 4,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM,
      });
      device.queue.writeBuffer(
        buffer,
        0,
        new Float32Array([roughnesses[baseMipLevel]])
      );
      return device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [
          {
            binding: 0,
            resource: this.texture.createView(),
          },
          {
            binding: 1,
            resource: this.diffuseTexure.createView(),
          },
          {
            binding: 2,
            resource: this.specularTexure.createView({
              mipLevelCount: 1,
              baseMipLevel,
            }),
          },
          {
            binding: 3,
            resource: this.sampler,
          },
          {
            binding: 4,
            resource: { buffer },
          },
        ],
      });
    };
    return {
      pipeline,
      createBindGroup,
      dispatchSize,
      roughnesses,
    };
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
