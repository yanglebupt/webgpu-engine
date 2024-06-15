import { BuildOptions } from "../scene/types";

export abstract class Pass {
  abstract texture: GPUTexture;
  abstract build(options: BuildOptions, descriptor: GPUTextureDescriptor): void;
  abstract render(
    encoder: GPUCommandEncoder,
    device: GPUDevice,
    texture: GPUTexture,
    options: { isEnd: boolean; target?: GPUTexture }
  ): void;
}
