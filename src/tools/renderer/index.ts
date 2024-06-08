import { checkWebGPUSupported, createCanvas } from "..";
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
}

export class WebGPURenderer {
  static features: GPUFeatureName[] = [];
  public className?: string;
  public parentID?: string;
  public cached?: BuildCache;
  public backgroundColor!: GPUColor;
  constructor(
    options?: Partial<{
      className: string;
      parentID: string;
      antialias: boolean;
      backgroundColor: GPUColor;
      alphaMode: GPUCanvasAlphaMode;
    }>
  ) {
    Object.assign(this, options);
  }

  private static __collectDeviceFeatures() {
    return [...WebGPURenderer.features, ...EnvMap.features];
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
    const canvasReturn = createCanvas(
      500,
      500,
      { device, format, alphaMode: this.alphaMode },
      this.className,
      this.parentID
    );
    (this.cached = {
      sampler: new GPUSamplerCache(device),
      solidColorTexture: new SolidColorTextureCache(device),
      pipeline: new GPURenderPipelineCache(device),
      bindGroupLayout: new GPUBindGroupLayoutCache(device),
    }),
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

  render(scene: Scene) {
    const encoder = this.device.createCommandEncoder();
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

    if (envMap && !envMap.doned) {
      const sc = new StorageTextureToCanvas(this.device, encoder);
      const size = [envMap.specularTexure.width, envMap.specularTexure.height];
      sc.render(envMap.diffuseTexure, {});
      for (
        let baseMipLevel = 0;
        baseMipLevel < envMap.specularTexure.mipLevelCount;
        baseMipLevel++
      ) {
        const s = getSizeForMipFromTexture(size, baseMipLevel);
        sc.render(
          envMap.specularTexure,
          {
            baseMipLevel,
            mipLevelCount: 1,
          },
          { width: s[0], height: s[1] }
        );
      }
    }

    this.device.queue.submit([encoder.finish()]);
    if (!realtime && envMap) {
      envMap.done();
    }
  }
}
