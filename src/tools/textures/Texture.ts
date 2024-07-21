import {
  TextureSource,
  createTextureFromSource,
  getSizeFromSource,
  numMipLevels,
} from "webgpu-utils";
import { MipMap } from "../utils/mipmaps";
import { GPUSamplerCache } from "../scene/cache";
import { StaticTextureUtil } from "../utils/StaticTextureUtil";

export interface TextureOptions {
  format?: GPUTextureFormat;
  mips?: boolean;
  flipY?: boolean;
}

export class Texture {
  sampler!: GPUSampler;
  source!: TextureSource;
  texture!: GPUTexture;

  format: GPUTextureFormat;
  mips: boolean;
  flipY: boolean;

  constructor(
    public filename: string,
    public options?: TextureOptions,
    public samplerDescriptor?: GPUSamplerDescriptor
  ) {
    this.format = options?.format ?? StaticTextureUtil.textureFormat;
    this.mips = options?.mips ?? false;
    this.flipY = options?.flipY ?? true;
  }

  async load() {
    const blob = await (await fetch(this.filename)).blob();
    this.source = await createImageBitmap(blob);
    return this;
  }

  upload(
    device: GPUDevice,
    cached: { sampler: GPUSamplerCache; mipmap: MipMap }
  ) {
    const { sampler, mipmap } = cached;
    const size = getSizeFromSource(this.source, {});
    this.sampler = this.samplerDescriptor
      ? sampler.get(this.samplerDescriptor)
      : sampler.default;

    this.texture = createTextureFromSource(device, this.source, {
      flipY: this.flipY,
      format: this.format,
      mips: false,
      usage:
        GPUTextureUsage.TEXTURE_BINDING |
        GPUTextureUsage.STORAGE_BINDING |
        GPUTextureUsage.COPY_DST |
        GPUTextureUsage.COPY_SRC,
      mipLevelCount: this.mips ? numMipLevels(size) : 1,
    });

    if (this.mips) mipmap.generateMipmaps(this.texture);
  }
}
