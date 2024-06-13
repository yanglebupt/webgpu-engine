import { createTextureFromSource } from "webgpu-utils";
import { maxMipLevelCount } from "../utils/mipmaps";
import { GPUSamplerCache } from "../scene/cache";

export interface Texture {
  format: GPUTextureFormat;
  mips: boolean;
}

export class Texture {
  sampler!: GPUSampler;
  source!: ImageBitmap;
  texture!: GPUTexture;
  private filename: string;

  constructor(
    filename: string,
    public samplerDescriptor?: GPUSamplerDescriptor,
    options?: { format?: GPUTextureFormat; mips?: boolean }
  ) {
    this.filename = filename;
    Object.assign(this, options);
  }

  async load() {
    const blob = await (await fetch(this.filename)).blob();
    this.source = await createImageBitmap(blob);
    return this;
  }

  upload(
    device: GPUDevice,
    cached: GPUSamplerCache,
    format?: GPUTextureFormat
  ) {
    const { width, height } = this.source;
    this.sampler = this.samplerDescriptor
      ? cached.get(this.samplerDescriptor)
      : cached.default;
    this.texture = createTextureFromSource(device, this.source, {
      format: format ?? this.format,
      mips: false,
      usage:
        GPUTextureUsage.TEXTURE_BINDING |
        // GPUTextureUsage.STORAGE_BINDING |
        GPUTextureUsage.COPY_DST |
        GPUTextureUsage.COPY_SRC,
      mipLevelCount: this.mips ? maxMipLevelCount(width, height) : 1,
    });
  }
}
