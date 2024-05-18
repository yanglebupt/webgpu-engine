import { createComputePipeline } from "../..";
import { createEmptyStorageTexture } from "../../helper";
import { HDRLoader } from "../../loaders/HDRLoader";
import { DispatchCompute } from "../Dispatch";
import { MipMap, maxMipLevelCount } from "../mipmaps";
import IBL_BRDF_IS from "./shader/ibl-brdf-is.wgsl";

export interface EnvMapPartOptions {
  mipLevel?: number;
  INT?: number;
}

export interface EnvMapOptions {
  diffuse?: EnvMapPartOptions;
  specular?: EnvMapPartOptions;
  samplers?: number;
}

export class EnvMap {
  static features: GPUFeatureName[] = ["float32-filterable"];
  public polyfill: boolean = false;
  public diffuseTexure: GPUTexture;
  public specularTexure: GPUTexture;
  public mipmapFilterTexture?: GPUTexture;
  public sampler?: GPUSampler;
  public destroyed: boolean = false;
  constructor(public device: GPUDevice, public texture: GPUTexture) {
    const { width, height, format } = this.texture;
    this.diffuseTexure = createEmptyStorageTexture(this.device, format, [
      width,
      height,
    ]);
    this.specularTexure = createEmptyStorageTexture(this.device, format, [
      width,
      height,
    ]);
  }

  destroy() {
    if (this.destroyed) return;
    this.texture?.destroy();
    this.mipmapFilterTexture?.destroy();
    //@ts-ignore
    this.texture = null;
    //@ts-ignore
    this.mipmapFilterTexture = null;
    this.destroyed = true;
  }

  compute(computePass: GPUComputePassEncoder, envMapOptions?: EnvMapOptions) {
    const mipmap = new MipMap(this.device, computePass);
    mipmap.generateMipmaps(this.texture);
    const mipLevels = [
      envMapOptions?.diffuse?.mipLevel ?? 6,
      envMapOptions?.specular?.mipLevel ?? 4,
    ] as [number, number];
    if (!this.device.features.has("float32-filterable")) {
      ////////////////提取 mipmap 后的贴图/////////////////
      this.mipmapFilterTexture = createEmptyStorageTexture(
        this.device,
        this.texture.format,
        [this.texture.width, this.texture.height, mipLevels.length]
      );
      mipmap.extractMipmap(this.texture, {
        texture: this.mipmapFilterTexture,
        mipLevels,
      });
      this.polyfill = true;
    } else {
      this.sampler = this.device.createSampler({
        minFilter: "linear",
        magFilter: "linear",
      });
      this.polyfill = false;
    }
    const { pipeline, bindGroup, dispatchSize } =
      this.build_IBL_BRDF_IS_ComputePass(mipLevels, envMapOptions);
    computePass.setPipeline(pipeline);
    computePass.setBindGroup(0, bindGroup);
    computePass.dispatchWorkgroups(1, dispatchSize[1], dispatchSize[2]);
  }

  build_IBL_BRDF_IS_ComputePass(
    mipLevels: [number, number],
    envMapOptions?: EnvMapOptions
  ) {
    const { width, height, format } = this.texture;
    const samplers = envMapOptions?.samplers ?? 512;
    const { chunkSize, dispatchSize, order } =
      DispatchCompute.dispatchImageAndSampler(
        this.device,
        [width, height],
        samplers
      );
    console.log(
      `sample chunk size: ${chunkSize}, sample dispatch size: ${dispatchSize}`
    );
    const pipeline = createComputePipeline(
      IBL_BRDF_IS(
        this.polyfill,
        format,
        mipLevels,
        chunkSize,
        dispatchSize[order[2]],
        order,
        envMapOptions?.diffuse?.INT ?? 1e4,
        envMapOptions?.specular?.INT ?? 1e4
      ),
      this.device
    );
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
      { binding: 2, resource: this.specularTexure.createView() },
    ];
    if (!this.polyfill)
      entries.push({
        binding: 3,
        resource: this.sampler!,
      });
    const bindGroup = this.device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: entries,
    });
    return { pipeline, bindGroup, dispatchSize };
  }
}

export class EnvMapLoader {
  async load(device: GPUDevice, filename: string, mipmaps: boolean = true) {
    const hdrLoader = new HDRLoader();
    const format: GPUTextureFormat = "rgba32float";
    const { color, width, height } = await hdrLoader.load<Float32Array>(
      filename,
      {
        sRGB: false,
        uint8: false,
      }
    );
    // hdr 贴图
    const envTexture = device.createTexture({
      format,
      mipLevelCount: mipmaps ? maxMipLevelCount(width, height) : 1,
      size: [width, height],
      usage:
        GPUTextureUsage.TEXTURE_BINDING |
        GPUTextureUsage.STORAGE_BINDING |
        GPUTextureUsage.COPY_DST |
        GPUTextureUsage.COPY_SRC,
    });
    device.queue.writeTexture(
      { texture: envTexture },
      color,
      { bytesPerRow: width * 16 },
      { width, height }
    );
    return new EnvMap(device, envTexture);
  }
}
