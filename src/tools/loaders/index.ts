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
  mips?: boolean;
  depthFormat?: GPUTextureFormat;
  record?: CreateAndSetRecord;
  onProgress?: (name: string, percentage: number) => void;
}

export class SolidColorTextureView {
  public texture: GPUTexture | null = null;
  public format: GPUTextureFormat | null = null;
  constructor(public color: { r: number; g: number; b: number; a: number }) {}
  setFormat(format: GPUTextureFormat) {
    this.format = format;
  }
  async uploadTexture(device: GPUDevice) {
    if (!this.format) {
      return;
    }
    const data = new Uint8Array([
      this.color.r * 255,
      this.color.g * 255,
      this.color.b * 255,
      this.color.a * 255,
    ]);
    this.texture?.destroy();
    this.texture = device.createTexture({
      size: [1, 1],
      format: this.format!,
      usage:
        GPUTextureUsage.TEXTURE_BINDING |
        GPUTextureUsage.COPY_DST |
        GPUTextureUsage.RENDER_ATTACHMENT,
    });
    device.queue.writeTexture(
      { texture: this.texture },
      data,
      {},
      { width: 1, height: 1 }
    );
  }
}

export class SolidColorTexture {
  static opaqueWhiteTexture = new SolidColorTextureView({
    r: 1,
    g: 1,
    b: 1,
    a: 1,
  });
  static transparentBlackTexture = new SolidColorTextureView({
    r: 0,
    g: 0,
    b: 0,
    a: 0,
  });
  static defaultNormalTexture = new SolidColorTextureView({
    r: 0.5,
    g: 0.5,
    b: 1,
    a: 1,
  });
  static async upload(device: GPUDevice) {
    return Promise.all([
      SolidColorTexture.defaultNormalTexture.uploadTexture(device),
      SolidColorTexture.transparentBlackTexture.uploadTexture(device),
      SolidColorTexture.opaqueWhiteTexture.uploadTexture(device),
    ]);
  }
}
