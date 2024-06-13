export class StaticTextureUtil {
  static renderFormat: GPUTextureFormat = "rgba8unorm";
  static textureFormat: GPUTextureFormat = "rgba8unorm";
  static depthFormat: GPUTextureFormat = "depth24plus";
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

  static createDepthTexture(
    device: GPUDevice,
    size: [number, number],
    sampleCount?: number,
    format?: GPUTextureFormat
  ) {
    if (
      StaticTextureUtil.checkTextureIsValid(
        StaticTextureUtil.depthTexture,
        size
      )
    ) {
      StaticTextureUtil.depthTexture = device.createTexture({
        size,
        format: format ?? StaticTextureUtil.depthFormat,
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
        sampleCount: sampleCount,
      });
    }
    return StaticTextureUtil.depthTexture;
  }

  static createMultiSampleTexture(
    device: GPUDevice,
    size: [number, number],
    sampleCount: number = 4,
    format?: GPUTextureFormat
  ) {
    if (
      StaticTextureUtil.checkTextureIsValid(
        StaticTextureUtil.multiSampleTexture,
        size
      )
    ) {
      StaticTextureUtil.multiSampleTexture = device.createTexture({
        format: format ?? StaticTextureUtil.renderFormat,
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
        size,
        sampleCount,
      });
    }
    return StaticTextureUtil.multiSampleTexture;
  }
}
