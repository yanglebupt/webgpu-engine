import { TextureCreationData, TypedArray } from "webgpu-utils";
import { Texture } from "./Texture";

export class DataTexture extends Texture {
  constructor(
    data: TypedArray | number[],
    width = 1,
    height = 1,
    options?: { format?: GPUTextureFormat; mips?: boolean; flipY?: boolean },
    public samplerDescriptor?: GPUSamplerDescriptor
  ) {
    super("", options, samplerDescriptor);
    this.source = { width, height, data } as TextureCreationData;
  }
}
