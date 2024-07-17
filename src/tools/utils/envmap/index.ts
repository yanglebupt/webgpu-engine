import {
  ShaderDataDefinitions,
  StructuredView,
  createTextureFromSource,
  makeShaderDataDefinitions,
  makeStructuredView,
} from "webgpu-utils";
import { createComputePipeline } from "../..";
import { Logger, createEmptyStorageTexture } from "../../helper";
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
  RenderableFirst,
  VirtualView,
} from "../../scene/types";
import { GPUSamplerCache } from "../../scene/cache";
import pdf from "./shader/pdf.wgsl.ts";
import inverse_cdf from "./shader/inverse_cdf.wgsl.ts";
import IBL_IS from "./shader/ibl-is.wgsl.ts";

export interface EnvMapPartOptions {
  mipLevel?: number;
  INT?: number;
}

export interface EnvMapOptions {
  mipmaps?: boolean;
  diffuse?: EnvMapPartOptions;
  specular?: EnvMapPartOptions & {
    // roughness 分多少级，也就是计算多少次不同的 roughness, 然后对其他 roughness 进行插值，默认是 mipLevelCount 是一样的
    roughnessDetail?: number;
    fixed?: boolean;
    minLevel?: number;
  };
  pbrSpecular?: {
    T2: { width?: number; height?: number };
  };
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
  details: number;
  pbrSpecularTexure: {
    T1: GPUTexture;
    T2: GPUTexture;
  };
  doned: boolean;
  done(): void;

  renderPipeline: GPURenderPipeline;
  bindGroup: GPUBindGroup;
  uniformBuffer: GPUBuffer;
  sampler: GPUSampler;

  // compute
  buildCompute: boolean;
  pipeline: GPUComputePipeline;
  dispatchSize: number[];
  roughnesses: number[];
  levels: number[];

  createBindGroup(device: GPUDevice, baseMipLevel: number): GPUBindGroup;

  buildComputePipeline(device: GPUDevice): void;
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
  implements Buildable, Computable, RenderableFirst, VirtualView
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
  protected _format: GPUTextureFormat = "rgba32float";

  constructor(
    public hdrReturn: HDRLoaderReturn<Float32Array>,
    public options?: EnvMapOptions
  ) {}

  abstract compute(
    computePass: GPUComputePassEncoder,
    device?: GPUDevice
  ): void;

  build({ device, format, depthFormat, cached, antialias }: BuildOptions) {
    const { color, width, height } = this.hdrReturn;
    const { mipmaps } = this.options ?? {};

    this.polyfill = !device.features.has("float32-filterable");

    this.sampler = createSamplerByPolyfill(this.polyfill, cached.sampler);

    // hdr 贴图
    this.texture = device.createTexture({
      format: this._format,
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
    this.diffuseTexure = createEmptyStorageTexture(device, this._format, [
      width,
      height,
    ]);
    this.details = Math.min(
      maxMipLevelCount(width, height),
      this.options?.specular?.roughnessDetail ?? 5
    );
    this.specularTexure = createEmptyStorageTexture(
      device,
      this._format,
      [width, height],
      {
        mipLevelCount: this.details,
      }
    );
    const wh = this.options?.pbrSpecular?.T2 ?? {};
    this.pbrSpecularTexure = {
      T1: createEmptyStorageTexture(device, this._format, [width, height], {
        mipLevelCount: this.details,
      }),
      T2: createEmptyStorageTexture(device, this._format, [width, height]),
    };

    // 渲染管线
    const { sampleType, type } = getFilterType(this.polyfill);
    this.renderPipeline = cached.pipeline.get(
      { code: vertex, context: {} },
      { code: fragment, context: { polyfill: this.polyfill } },
      {
        format,
        primitive: { topology: "triangle-list" },
        depthStencil: {
          format: depthFormat,
          depthWriteEnabled: true,
          depthCompare: "less-equal",
        },
        ...(antialias ? { multisample: { count: 4 } } : {}),
      },
      [
        cached.bindGroupLayout.get([
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
        ]),
      ]
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

    this.buildComputePipeline(device);
    this.buildCompute = true;
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

  generateRoughness() {
    this.roughnesses = [];
    this.levels = [];
    Logger.log(`roughness details: ${this.details}`);
    const { fixed = false, minLevel = this.texture.mipLevelCount / 2 } =
      this.options?.specular ?? {};
    for (let i = 0; i < this.details; i++) {
      const roughness = i / (this.details - 1);
      let level = roughness * this.texture.mipLevelCount;
      if (level >= this.texture.mipLevelCount - 1) {
        level = this.texture.mipLevelCount - 2;
      } else if (level <= minLevel - 1 && roughness > 0) {
        level = minLevel;
      }
      if (roughness > 0) this.levels.push(fixed ? minLevel : level);
      else this.levels.push(0);
      this.roughnesses.push(roughness);
    }
  }

  done() {
    if (this.doned) return;
    this.doned = true;
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
  private hasGeneratedMips = false;

  constructor(
    hdrReturn: HDRLoaderReturn<Float32Array>,
    options?: EnvMapOptions
  ) {
    super(hdrReturn, options);
  }

  compute(computePass: GPUComputePassEncoder, device: GPUDevice) {
    if (!this.hasGeneratedMips) {
      const mipmap = new MipMap(device, computePass);
      mipmap.generateMipmaps(this.texture);
      this.hasGeneratedMips = true;
    }
    if (!this.buildCompute) return;
    computePass.setPipeline(this.pipeline);
    for (let i = 0; i < this.roughnesses.length; i++) {
      computePass.setBindGroup(0, this.createBindGroup(device, i));
      const _ds = getSizeForMipFromTexture(
        [this.dispatchSize[1], this.dispatchSize[2]],
        i
      );
      computePass.dispatchWorkgroups(1, _ds[0], _ds[1]);
    }
  }

  createBindGroup(device: GPUDevice, baseMipLevel: number) {
    const buffer = device.createBuffer({
      size: 4 * 2,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM,
    });
    device.queue.writeBuffer(
      buffer,
      0,
      new Float32Array([
        this.roughnesses[baseMipLevel],
        this.levels[baseMipLevel],
      ])
    );
    return device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
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
          resource: this.pbrSpecularTexure.T1.createView({
            mipLevelCount: 1,
            baseMipLevel,
          }),
        },
        {
          binding: 4,
          resource: this.pbrSpecularTexure.T2.createView(),
        },
        {
          binding: 5,
          resource: this.sampler,
        },
        {
          binding: 6,
          resource: { buffer },
        },
      ],
    });
  }

  buildComputePipeline(device: GPUDevice) {
    const mipLevels = [
      this.options?.diffuse?.mipLevel ?? 6,
      this.options?.specular?.mipLevel ?? 4,
    ] as [number, number];
    const { width, height, format } = this.texture;
    this.generateRoughness();
    const samplers = this.options?.samplers ?? 512;
    const { chunkSize, dispatchSize, order } =
      DispatchCompute.dispatchImageAndSampler(
        device,
        [width, height],
        samplers
      );
    Logger.log(
      `sample chunk size: ${chunkSize}, sample dispatch size: ${dispatchSize}, order: ${order}`
    );

    const { sampleType, type } = getFilterType(this.polyfill);

    Logger.log(
      `float32-filterable ${this.polyfill ? "not" : ""} supported`,
      sampleType,
      type,
      this.polyfill ? "use polyfill" : ""
    );

    this.pipeline = createComputePipeline(
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
                  storageTexture: { access: "write-only", format },
                },
                {
                  binding: 4,
                  visibility: GPUShaderStage.COMPUTE,
                  storageTexture: {
                    access: "write-only",
                    format,
                  },
                },
                {
                  binding: 5,
                  visibility: GPUShaderStage.COMPUTE,
                  sampler: {
                    type,
                  },
                },
                {
                  binding: 6,
                  visibility: GPUShaderStage.COMPUTE,
                  buffer: { type: "uniform" },
                },
              ],
            }),
          ],
        }),
      }
    );

    this.dispatchSize = dispatchSize;
  }
}

export class EnvMapIBLIS extends EnvMap {
  // compute
  private rowAvgTexture!: GPUTexture;
  private pdfTexture!: GPUTexture;
  private inverseCDFTexture!: GPUTexture;

  private preComputed: boolean = false;
  private pre_compute: Array<{
    pipeline: GPUComputePipeline;
    bindGroup: GPUBindGroup;
    dispatchSize: number[];
  }> = new Array(2);

  done() {
    if (this.doned) return;
    this.rowAvgTexture.destroy();
    this.pdfTexture.destroy();
    //@ts-ignore
    this.rowAvgTexture = null;
    //@ts-ignore
    this.pdfTexture = null;
    this.doned = true;
  }

  buildComputePipeline(device: GPUDevice) {
    const { avg_gray, row_avg, width, height } = this.hdrReturn;

    this.generateRoughness();

    this.rowAvgTexture = createTextureFromSource(
      device,
      { data: row_avg, width: 1, height },
      {
        mips: false,
        usage:
          GPUTextureUsage.TEXTURE_BINDING |
          GPUTextureUsage.STORAGE_BINDING |
          GPUTextureUsage.COPY_SRC,
        format: this._format,
      }
    );

    // 根据 device 的最大限制计算分块, chunk 并行计算
    let { chunkSize, dispatchSize } = DispatchCompute.dispatch(device, [
      width,
      height,
    ]);
    Logger.log(`chunk size: ${chunkSize}, dispatch size: ${dispatchSize}`);

    // 计算联合概率、边缘概率、条件概率
    const pdf_pipeline = createComputePipeline(
      pdf(this._format, avg_gray, chunkSize),
      device
    );
    /*
      pdfTexture: 合并 texture 来减少资源开销
      [r] 代表 joint pdf  [g] 代表 condition pdf [b] 代表 margin pdf，因为是一维的，只有第一列有效
    */
    this.pdfTexture = createEmptyStorageTexture(device, this._format, [
      width,
      height,
    ]);
    const pdf_bindGroup = device.createBindGroup({
      layout: pdf_pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: this.texture.createView() },
        { binding: 1, resource: this.rowAvgTexture.createView() },
        { binding: 2, resource: this.pdfTexture.createView() },
      ],
    });

    // 计算逆 CDF
    const inverse_cdf_pipeline = createComputePipeline(
      inverse_cdf(this._format, chunkSize),
      device
    );
    /*
      inverseCDFTexture: 由于 rgba32float 不支持 read_write，无法覆盖前面的 pdfTexture，因此只能再新建一个
      [r] 代表 joint pdf  [g] 代表 condition inverse cdf [b] 代表 margin inverse cdf，因为是一维的，只有第一列有效
    */
    this.inverseCDFTexture = createEmptyStorageTexture(device, this._format, [
      width,
      height,
    ]);
    const inverse_cdf_bindGroup = device.createBindGroup({
      layout: inverse_cdf_pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: this.pdfTexture.createView() },
        { binding: 1, resource: this.inverseCDFTexture.createView() },
      ],
    });

    // 预计算
    this.pre_compute = [
      { pipeline: pdf_pipeline, bindGroup: pdf_bindGroup, dispatchSize },
      {
        pipeline: inverse_cdf_pipeline,
        bindGroup: inverse_cdf_bindGroup,
        dispatchSize,
      },
    ];

    // IBL-IS
    const samplers = this.options?.samplers ?? 10;
    const {
      chunkSize: chunkSize_sample,
      dispatchSize: dispatch_sample,
      order,
    } = DispatchCompute.dispatchImageAndSampler(
      device,
      [width, height],
      samplers
    );
    Logger.log(
      `sample chunk size: ${chunkSize_sample}, sample dispatch size: ${dispatch_sample}`
    );
    this.pipeline = createComputePipeline(
      IBL_IS(
        this._format,
        chunkSize_sample,
        dispatch_sample[order[2]],
        order,
        this.options?.diffuse?.INT ?? 1e4,
        this.options?.specular?.INT ?? 1e4
      ),
      device
    );
    this.dispatchSize = dispatch_sample;
  }

  createBindGroup(device: GPUDevice, baseMipLevel: number) {
    const buffer = device.createBuffer({
      size: 4,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM,
    });
    device.queue.writeBuffer(
      buffer,
      0,
      new Float32Array([this.roughnesses[baseMipLevel]])
    );
    return device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: this.texture.createView() },
        { binding: 1, resource: this.inverseCDFTexture.createView() },
        { binding: 2, resource: this.diffuseTexure.createView() },
        {
          binding: 3,
          resource: this.specularTexure.createView({
            baseMipLevel,
            mipLevelCount: 1,
          }),
        },
        {
          binding: 4,
          resource: { buffer },
        },
      ],
    });
  }

  compute(computePass: GPUComputePassEncoder, device: GPUDevice): void {
    if (!this.buildCompute) return;
    if (!this.preComputed) {
      // 只需要计算一次
      this.pre_compute.forEach(({ pipeline, bindGroup, dispatchSize }) => {
        computePass.setPipeline(pipeline);
        computePass.setBindGroup(0, bindGroup);
        computePass.dispatchWorkgroups(dispatchSize[0], dispatchSize[1]);
      });
      this.preComputed = true;
    }
    computePass.setPipeline(this.pipeline);
    for (let i = 0; i < this.roughnesses.length; i++) {
      computePass.setBindGroup(0, this.createBindGroup(device, i));
      const _ds = getSizeForMipFromTexture(
        [this.dispatchSize[1], this.dispatchSize[2]],
        i
      );
      computePass.dispatchWorkgroups(1, _ds[0], _ds[1]);
    }
  }
}

export class EnvMapLoader {
  async load(filename: string, options?: EnvMapOptions) {
    const hdrLoader = new HDRLoader();
    const ibl_is = !!!options?.mipmaps;
    const result = await hdrLoader.load<Float32Array>(filename, {
      sRGB: false,
      uint8: false,
      returnRowAvgGray: ibl_is,
    });
    return ibl_is
      ? new EnvMapIBLIS(result, options)
      : new EnvMapBRDFIS(result, options);
  }
}
