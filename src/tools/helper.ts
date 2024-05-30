import { CreateCanvasReturn, createCanvas, createRenderPipeline } from ".";
import vertex from "./shaders/vertex-wgsl/full-plane.wgsl";
import fragment from "./shaders/fragment-wgsl/image.wgsl";

export type MIME_TYPE = "image/jpeg" | "image/png" | "image/webp";

export function saveCanvas(
  id: string,
  fileName?: string,
  mime_type?: MIME_TYPE,
  quality?: number
): void;
export function saveCanvas(
  canvas: HTMLCanvasElement,
  fileName?: string,
  mime_type?: MIME_TYPE,
  quality?: number
): void;
export function saveCanvas(
  idOrCanvas: string | HTMLCanvasElement,
  fileName: string = "test",
  mime_type: MIME_TYPE = "image/jpeg",
  quality: number = 1
) {
  let canvasElement: HTMLCanvasElement;
  if (idOrCanvas instanceof HTMLCanvasElement) {
    canvasElement = idOrCanvas;
  } else {
    const ele = document.getElementById(idOrCanvas);
    if (!ele || !(ele instanceof HTMLCanvasElement)) {
      throw new Error("need HTMLCanvasElement");
    }
    canvasElement = ele;
  }
  const MIME_TYPE = "image/png";
  const imgURL = canvasElement.toDataURL(mime_type, quality);

  const dlLink = document.createElement("a");
  dlLink.download = fileName;
  dlLink.href = imgURL;
  dlLink.dataset.downloadurl = [MIME_TYPE, dlLink.download, dlLink.href].join(
    ":"
  );
  document.body.appendChild(dlLink);
  dlLink.click();
  document.body.removeChild(dlLink);
}

export function createEmptyStorageTexture(
  device: GPUDevice,
  format: GPUTextureFormat,
  size: [number, number] | number[],
  options?: Partial<GPUTextureDescriptor>
) {
  return device.createTexture({
    label: options?.label ?? "",
    mipLevelCount: options?.mipLevelCount ?? 1,
    usage:
      (options?.usage ?? 0) |
      GPUTextureUsage.TEXTURE_BINDING |
      GPUTextureUsage.STORAGE_BINDING |
      GPUTextureUsage.COPY_SRC,
    format,
    size,
    dimension: "2d",
  });
}

// 4 通道的
export const TextureFormatSampleType: Partial<
  Record<
    GPUTextureFormat,
    {
      renderable: boolean;
      multisample: boolean;
      storage: boolean;
      sampleType: GPUTextureSampleType;
    }
  >
> = {
  rgba8unorm: {
    renderable: true,
    multisample: true,
    storage: true,
    sampleType: "float",
  },
  "rgba8unorm-srgb": {
    renderable: true,
    multisample: true,
    storage: false,
    sampleType: "float",
  },
  rgba8snorm: {
    renderable: false,
    multisample: false,
    storage: false,
    sampleType: "float",
  },
  rgba8uint: {
    renderable: true,
    multisample: true,
    storage: true,
    sampleType: "uint",
  },
  rgba8sint: {
    renderable: true,
    multisample: true,
    storage: true,
    sampleType: "sint",
  },
  bgra8unorm: {
    renderable: true,
    multisample: true,
    storage: false,
    sampleType: "float",
  },
  "bgra8unorm-srgb": {
    renderable: true,
    multisample: true,
    storage: false,
    sampleType: "float",
  },
  rgba16uint: {
    renderable: true,
    multisample: true,
    storage: true,
    sampleType: "uint",
  },
  rgba16sint: {
    renderable: true,
    multisample: true,
    storage: true,
    sampleType: "sint",
  },
  rgba16float: {
    renderable: true,
    multisample: true,
    storage: true,
    sampleType: "float",
  },
  rgba32uint: {
    renderable: true,
    multisample: false,
    storage: true,
    sampleType: "uint",
  },
  rgba32sint: {
    renderable: true,
    multisample: false,
    storage: true,
    sampleType: "sint",
  },
  rgba32float: {
    renderable: true,
    multisample: false,
    storage: true,
    sampleType: "unfilterable-float",
  },
};

export const PreferredCanvasFormats: GPUTextureFormat[] = [
  "rgba8unorm",
  "bgra8unorm",
];

export class StorageTextureToCanvas {
  bindGroupLayoutCache: Map<string, GPUBindGroupLayout> = new Map();
  samplerCache: Map<string, GPUSampler> = new Map();
  renderPipelineCache: Map<string, GPURenderPipeline> = new Map();
  constructor(public device: GPUDevice, public encoder: GPUCommandEncoder) {}

  getFromCache<K, T>(
    cache: Map<string, T>,
    keyObject: K,
    create: (keyObject: K) => T
  ): T {
    const key = JSON.stringify(keyObject);
    if (cache.has(key)) return cache.get(key) as T;
    return create.apply(this, [keyObject]);
  }

  createBindGroupLayout(entries: Iterable<GPUBindGroupLayoutEntry>) {
    const key = JSON.stringify(entries);
    const bindGroupLayout = this.device.createBindGroupLayout({
      entries: entries,
    });
    this.bindGroupLayoutCache.set(key, bindGroupLayout);
    return bindGroupLayout;
  }

  createSampler(descriptor?: GPUSamplerDescriptor) {
    const key = JSON.stringify(descriptor ?? {});
    const sampler = this.device.createSampler(descriptor);
    this.samplerCache.set(key, sampler);
    return sampler;
  }

  createRenderPipeline(
    descriptor: {
      vertex: string;
      fragment: string;
      format: GPUTextureFormat;
      entries: Iterable<GPUBindGroupLayoutEntry>;
    },
    pipelineLayout: GPUPipelineLayout
  ) {
    const key = JSON.stringify(descriptor);
    const { vertex, fragment, format } = descriptor;
    const renderPipeline = createRenderPipeline(
      vertex,
      fragment,
      this.device,
      format,
      [null],
      {
        layout: pipelineLayout,
      }
    );
    this.renderPipelineCache.set(key, renderPipeline);
    return renderPipeline;
  }

  render(
    texture: GPUTexture,
    viewOption?: GPUTextureViewDescriptor,
    showSize?: { width?: number; height?: number },
    options?: {
      canvasReturn?: CreateCanvasReturn;
      className?: string;
      parentID?: string;
      flipY?: boolean;
    }
  ): CreateCanvasReturn {
    const { className, parentID, flipY = false } = options ?? {};
    const size = [texture.width, texture.height];
    let format = texture.format;
    let canvasReturn: CreateCanvasReturn;
    if (format in PreferredCanvasFormats) {
      canvasReturn =
        options?.canvasReturn ??
        createCanvas(
          {
            width: showSize?.width ?? size[0],
            height: showSize?.height ?? size[1],
          },
          { width: size[0], height: size[1] },
          {
            format,
            scale: false,
            device: this.device,
            usage:
              GPUTextureUsage.TEXTURE_BINDING |
              GPUTextureUsage.STORAGE_BINDING |
              GPUTextureUsage.COPY_DST,
          },
          className,
          parentID
        );
      const { ctx } = canvasReturn;

      this.encoder.copyTextureToTexture(
        { texture: texture },
        { texture: ctx.getCurrentTexture() },
        size
      );
    } else {
      const canvasFormat = PreferredCanvasFormats[0];
      const sampleType = TextureFormatSampleType[format]?.sampleType ?? "float";
      const filter: GPUSamplerBindingType = sampleType.includes("unfilterable")
        ? "non-filtering"
        : "filtering";
      canvasReturn =
        options?.canvasReturn ??
        createCanvas(
          {
            width: showSize?.width ?? size[0],
            height: showSize?.height ?? size[1],
          },
          { width: size[0], height: size[1] },
          {
            format: canvasFormat,
            scale: false,
            device: this.device,
          },
          className,
          parentID
        );
      const { ctx } = canvasReturn;

      const entries = [
        {
          binding: 0,
          visibility: GPUShaderStage.FRAGMENT,
          sampler: { type: filter },
        },
        {
          binding: 1,
          visibility: GPUShaderStage.FRAGMENT,
          texture: { sampleType },
        },
      ];
      const bindGroupLayout = this.getFromCache(
        this.bindGroupLayoutCache,
        entries,
        this.createBindGroupLayout
      );

      const sampler = this.getFromCache(
        this.samplerCache,
        {},
        this.createSampler
      );

      const bindGroup = this.device.createBindGroup({
        layout: bindGroupLayout,
        entries: [
          { binding: 0, resource: sampler },
          { binding: 1, resource: texture.createView(viewOption ?? {}) },
        ],
      });

      const pipelineLayout = this.device.createPipelineLayout({
        bindGroupLayouts: [bindGroupLayout],
      });

      const vertexStr = vertex(flipY);
      const fragmentStr = fragment(0);
      const renderPipeline = this.getFromCache(
        this.renderPipelineCache,
        {
          vertex: vertexStr,
          fragment: fragmentStr,
          format: canvasFormat,
          entries,
        },
        (arg) => this.createRenderPipeline(arg, pipelineLayout)
      );

      const renderPass = this.encoder.beginRenderPass({
        colorAttachments: [
          {
            clearValue: { r: 0, g: 0, b: 0, a: 1 },
            loadOp: "clear",
            storeOp: "store",
            view: ctx.getCurrentTexture().createView(),
          },
        ],
      });
      renderPass.setPipeline(renderPipeline);
      renderPass.setBindGroup(0, bindGroup);
      renderPass.draw(3);
      renderPass.end();
    }

    return canvasReturn;
  }
}

export class Logger {
  static production: boolean = false;
  static log(...msg: any[]) {
    if (!Logger.production) console.log(...msg);
  }
}
