export type ShaderModuleCode =
  | string
  | ((context: Record<string, any>) => string);

export class CreateAndSetRecord {
  // 创建了多少个 pipeline
  public pipelineCount: number = 0;
  // 切换了多少次 pipeline
  public pipelineSets: number = 0;
  // 创建了多少个 bindGroup
  public bindGroupCount: number = 0;
  // 切换了多少次 bindGroup
  public bindGroupSets: number = 0;
  // 切换了多少次 buffers
  public bufferSets: number = 0;
  // 调用了多少次 draw
  public drawCount: number = 0;
}

export interface BuiltRenderPipelineOptions {
  bindGroupLayouts: GPUBindGroupLayout[];
  format: GPUTextureFormat;
  depthFormat?: GPUTextureFormat;
  record?: CreateAndSetRecord;
}

export type ShaderContext = Record<string, any>;

export function createSolidColorTexture(
  device: GPUDevice,
  r: number,
  g: number,
  b: number,
  a: number
) {
  const data = new Uint8Array([r * 255, g * 255, b * 255, a * 255]);
  const texture = device.createTexture({
    size: { width: 1, height: 1 },
    format: "rgba8unorm",
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
  });
  device.queue.writeTexture({ texture }, data, {}, { width: 1, height: 1 });
  return texture;
}

export class SolidColorTexture {
  static opaqueWhiteTexture: GPUTexture | null = null;
  static transparentBlackTexture: GPUTexture | null = null;
  static defaultNormalTexture: GPUTexture | null = null;
  static upload(device: GPUDevice) {
    if (!SolidColorTexture.opaqueWhiteTexture)
      SolidColorTexture.opaqueWhiteTexture = createSolidColorTexture(
        device,
        1,
        1,
        1,
        1
      );
    if (!SolidColorTexture.transparentBlackTexture)
      SolidColorTexture.transparentBlackTexture = createSolidColorTexture(
        device,
        0,
        0,
        0,
        0
      );
    if (!SolidColorTexture.defaultNormalTexture)
      SolidColorTexture.defaultNormalTexture = createSolidColorTexture(
        device,
        0.5,
        0.5,
        1,
        1
      );
  }
}
