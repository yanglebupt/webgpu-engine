export class StaticTextureUtils {
  static depthTexture: GPUTexture;
  static multiSampleTexture: GPUTexture;

  static checkTextureIsValid(
    texture: GPUTexture,
    size: [number, number]
  ): boolean {
    const expired =
      !texture || texture.width !== size[0] || texture.height !== size[1];
    if (expired && texture) texture.destroy();
    return expired;
  }

  static createDepthTexture(device: GPUDevice, size: [number, number]) {
    if (
      StaticTextureUtils.checkTextureIsValid(
        StaticTextureUtils.depthTexture,
        size
      )
    ) {
      StaticTextureUtils.depthTexture = device.createTexture({
        size,
        format: "depth24plus",
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
      });
    }
    return StaticTextureUtils.depthTexture;
  }

  static createMultiSampleTexture(
    device: GPUDevice,
    size: [number, number],
    format: GPUTextureFormat,
    sampleCount: number
  ) {
    if (
      StaticTextureUtils.checkTextureIsValid(
        StaticTextureUtils.multiSampleTexture,
        size
      )
    ) {
      StaticTextureUtils.multiSampleTexture = device.createTexture({
        format,
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
        size,
        sampleCount,
      });
    }
    return StaticTextureUtils.multiSampleTexture;
  }
}
