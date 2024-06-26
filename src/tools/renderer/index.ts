import { CreateCanvasConfig, checkWebGPUSupported, createCanvas } from "..";
import { StorageTextureToCanvas } from "../helper";
import { Scene } from "../scene";
import { BuildCache } from "../scene/types";
import { StaticTextureUtil } from "../utils/StaticTextureUtil";
import { EnvMap } from "../utils/envmap";
import { getSizeForMipFromTexture } from "../utils/mipmaps";
import {
  GPUBindGroupLayoutCache,
  GPURenderPipelineCache,
  GPUSamplerCache,
  SolidColorTextureCache,
} from "../scene/cache";
import { ComputePass } from "../postprocess/ComputePass";

export type CreateCanvasParameters = {
  config?: {
    scale?: boolean;
    virtual?: boolean;
  };
  className?: string;
  parentID?: string;
} & (
  | {
      width?: number | string;
      height?: number | string;
    }
  | {
      showSize: {
        width: number | string;
        height: number | string;
      };
      pixelSize: {
        width: number;
        height: number;
      };
    }
);

export interface WebGPURenderer {
  gpu: GPU;
  adapter: GPUAdapter;
  device: GPUDevice;
  format: GPUTextureFormat;
  depthFormat: GPUTextureFormat;
  canvas: HTMLCanvasElement;
  ctx: GPUCanvasContext;
  width: number;
  height: number;
  aspect: number;
  antialias: boolean;
  alphaMode: GPUCanvasAlphaMode;
  backgroundColor: GPUColor;
  canvasConfig: CreateCanvasParameters;
}

export class WebGPURenderer {
  static features: GPUFeatureName[] = [];
  cached?: BuildCache;
  constructor(
    options?: Partial<{
      antialias: boolean;
      backgroundColor: GPUColor;
      alphaMode: GPUCanvasAlphaMode;
      canvasConfig: CreateCanvasParameters;
    }>
  ) {
    this.canvasConfig = {
      width: 500,
      height: 500,
    };
    Object.assign(this.canvasConfig, options?.canvasConfig);
    if (options) Reflect.deleteProperty(options, "canvasConfig");
    Object.assign(this, {
      backgroundColor: [0, 0, 0, 1],
      ...options,
    });
  }

  private static __collectDeviceFeatures() {
    return [
      ...WebGPURenderer.features,
      ...EnvMap.features,
      ...ComputePass.features,
    ];
  }

  // 申请设备功能
  static requestDeviceFeatures(...features: GPUFeatureName[]) {
    features.push(...features);
  }

  // 初始化 GPUDevice 和 canvas
  async checkSupport() {
    const gpuSupport = await checkWebGPUSupported(
      {},
      { requiredFeatures: WebGPURenderer.__collectDeviceFeatures() }
    );
    const { device, format } = gpuSupport;
    const { className, parentID, config, width, height, showSize, pixelSize } =
      this.canvasConfig as any;
    const canvasReturn = createCanvas(
      showSize ?? width,
      pixelSize ?? height,
      {
        device,
        format,
        alphaMode: this.alphaMode,
        usage:
          GPUTextureUsage.RENDER_ATTACHMENT |
          GPUTextureUsage.TEXTURE_BINDING |
          GPUTextureUsage.COPY_DST |
          GPUTextureUsage.COPY_SRC,
        ...config,
      },
      className,
      parentID
    );
    this.cached = {
      sampler: new GPUSamplerCache(device),
      solidColorTexture: new SolidColorTextureCache(device),
      pipeline: new GPURenderPipelineCache(device),
      bindGroupLayout: new GPUBindGroupLayoutCache(device),
    };
    Object.assign(this, {
      ...gpuSupport,
      ...canvasReturn,
      depthFormat: StaticTextureUtil.depthFormat,
    });
    return this;
  }

  private get clearColor() {
    // 所有使用的颜色都需要考虑 预乘 alpha
    const bg = this.backgroundColor as Array<number>;
    const { r, g, b, a } = Reflect.has(bg, "x")
      ? (bg as unknown as GPUColorDict)
      : { r: bg[0], g: bg[1], b: bg[2], a: bg[3] };
    const color = { r, g, b, a };
    if (this.alphaMode === "premultiplied") {
      color.r *= a;
      color.g *= a;
      color.b *= a;
    }
    return color;
  }

  appendCanvas() {
    const parentID = this.canvasConfig.parentID;
    (parentID ? document.getElementById(parentID) : document.body)?.appendChild(
      this.canvas
    );
  }

  renderScene(scene: Scene, encoder: GPUCommandEncoder) {
    // 非实时计算，只需要一次即可
    const realtime = scene.options?.realtime ?? false;
    const envMap = scene.options?.envMap;
    if (envMap && ((!realtime && !envMap.doned) || realtime)) {
      const computePass = encoder.beginComputePass();
      envMap.compute(computePass, this.device);
      computePass.end();
    }

    const canvasTexture = this.ctx.getCurrentTexture();
    const depthTexture = StaticTextureUtil.createDepthTexture(
      this.device,
      [canvasTexture.width, canvasTexture.height],
      this.antialias ? 4 : undefined
    );
    const multisampleTexture = this.antialias
      ? StaticTextureUtil.createMultiSampleTexture(
          this.device,
          [canvasTexture.width, canvasTexture.height],
          4,
          this.format
        )
      : null;
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          loadOp: "clear",
          storeOp: "store",
          clearValue: this.clearColor,
          view: this.antialias
            ? multisampleTexture!.createView()
            : canvasTexture.createView(),
          resolveTarget: this.antialias
            ? canvasTexture.createView()
            : undefined,
        },
      ],
      depthStencilAttachment: {
        depthClearValue: 1.0,
        depthLoadOp: "clear",
        depthStoreOp: "store",
        view: depthTexture.createView(),
      },
    });
    scene.render(pass);
    pass.end();
  }

  render(scene: Scene) {
    const encoder = this.device.createCommandEncoder();
    this.renderScene(scene, encoder);
    this.device.queue.submit([encoder.finish()]);
    // destroyUnused
    const realtime = scene.options?.realtime ?? false;
    const envMap = scene.options?.envMap;
    // 销毁一些资源
    if (!realtime && envMap) {
      envMap.done();
    }
  }
}
