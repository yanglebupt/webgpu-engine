import {
  CreateCanvasReturn,
  GPUSupport,
  checkWebGPUSupported,
  createCanvas,
} from "..";
import { CreateAndSetRecord } from "../loaders";
import { Scene } from "../scene";
import { StaticTextureUtils } from "../utils";

export interface WebGPURenderer {
  gpu: GPU;
  adapter: GPUAdapter;
  device: GPUDevice;
  format: GPUTextureFormat;
  canvas: HTMLCanvasElement;
  ctx: GPUCanvasContext;
  width: number;
  height: number;
  aspect: number;
}
export class WebGPURenderer {
  public className?: string;
  public parentID?: string;
  constructor(options?: { className?: string; parentID?: string }) {
    this.className = options?.className;
    this.parentID = options?.parentID;
  }

  // 初始化 GPUDevice 和 canvas
  async checkSupport() {
    const gpuSupport = await checkWebGPUSupported();
    const { device, format } = gpuSupport;
    const canvasReturn = createCanvas(
      500,
      500,
      { device, format },
      this.className,
      this.parentID
    );
    Object.assign(this, { ...gpuSupport, ...canvasReturn });
    return this;
  }

  render(scene: Scene, print?: (record: CreateAndSetRecord) => void) {
    const canvasTexture = this.ctx.getCurrentTexture();
    const depthTexture = StaticTextureUtils.createDepthTexture(this.device, [
      canvasTexture.width,
      canvasTexture.height,
    ]);
    const encoder = this.device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          loadOp: "clear",
          storeOp: "store",
          view: canvasTexture.createView(),
        },
      ],
      depthStencilAttachment: {
        depthClearValue: 1.0,
        depthLoadOp: "clear",
        depthStoreOp: "store",
        view: depthTexture.createView(),
      },
    });
    scene.render(pass, print);
    pass.end();
    this.device.queue.submit([encoder.finish()]);
  }
}
