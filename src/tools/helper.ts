import { createCanvas, createRenderPipeline } from ".";
import vertex from "./shaders/vertex-wgsl/full-plane.wgsl";
import fragment from "./shaders/fragment-wgsl/image.wgsl?raw";

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
  size: [number, number],
  options?: GPUTextureDescriptor
) {
  return device.createTexture({
    label: options?.label ?? "",
    usage:
      GPUTextureUsage.TEXTURE_BINDING |
      GPUTextureUsage.STORAGE_BINDING |
      GPUTextureUsage.COPY_SRC,
    format,
    size,
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
    showSize?: { width?: number; height?: number },
    options?: {
      className?: string;
      parentID?: string;
    }
  ): HTMLCanvasElement {
    const { className, parentID } = options ?? {};
    const size = [texture.width, texture.height];
    let format = texture.format;
    if (format in PreferredCanvasFormats) {
      const { ctx, canvas } = createCanvas(
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

      this.encoder.copyTextureToTexture(
        { texture: texture },
        { texture: ctx.getCurrentTexture() },
        size
      );
      return canvas;
    } else {
      const canvasFormat = PreferredCanvasFormats[0];
      const sampleType = TextureFormatSampleType[format]?.sampleType ?? "float";
      const filter: GPUSamplerBindingType = sampleType.includes("unfilterable")
        ? "non-filtering"
        : "filtering";
      const { ctx, canvas } = createCanvas(
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
          { binding: 1, resource: texture.createView() },
        ],
      });

      const pipelineLayout = this.device.createPipelineLayout({
        bindGroupLayouts: [bindGroupLayout],
      });

      const vertexStr = vertex(true);
      const renderPipeline = this.getFromCache(
        this.renderPipelineCache,
        { vertex: vertexStr, fragment, format: canvasFormat, entries },
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
      renderPass.setBindGroup(0, bindGroup);
      renderPass.setPipeline(renderPipeline);
      renderPass.draw(3);
      renderPass.end();

      return canvas;
    }
  }
}
