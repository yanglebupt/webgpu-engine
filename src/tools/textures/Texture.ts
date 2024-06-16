import {
  TextureSource,
  createTextureFromSource,
  getSizeFromSource,
} from "webgpu-utils";
import { maxMipLevelCount } from "../utils/mipmaps";
import { GPUSamplerCache } from "../scene/cache";

export interface Texture {
  format: GPUTextureFormat;
  mips: boolean;
  flipY: boolean;
}

export class Texture {
  sampler!: GPUSampler;
  source!: TextureSource;
  texture!: GPUTexture;
  private filename: string;

  constructor(
    filename: string,
    options?: { format?: GPUTextureFormat; mips?: boolean; flipY?: boolean },
    public samplerDescriptor?: GPUSamplerDescriptor
  ) {
    this.filename = filename;
    Object.assign(this, { flipY: true, ...options });
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
    const [width, height] = getSizeFromSource(this.source, {});
    this.sampler = this.samplerDescriptor
      ? cached.get(this.samplerDescriptor)
      : cached.default;
    this.texture = createTextureFromSource(device, this.source, {
      flipY: this.flipY,
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
