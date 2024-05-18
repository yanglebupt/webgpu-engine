export class StaticTextureUtil {
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
      StaticTextureUtil.checkTextureIsValid(
        StaticTextureUtil.depthTexture,
        size
      )
    ) {
      StaticTextureUtil.depthTexture = device.createTexture({
        size,
        format: "depth24plus",
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
      });
    }
    return StaticTextureUtil.depthTexture;
  }

  static createMultiSampleTexture(
    device: GPUDevice,
    size: [number, number],
    format: GPUTextureFormat,
    sampleCount: number
  ) {
    if (
      StaticTextureUtil.checkTextureIsValid(
        StaticTextureUtil.multiSampleTexture,
        size
      )
    ) {
      StaticTextureUtil.multiSampleTexture = device.createTexture({
        format,
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
        size,
        sampleCount,
      });
    }
    return StaticTextureUtil.multiSampleTexture;
  }
}
