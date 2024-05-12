import {
  CreateCanvasReturn,
  GPUSupport,
  checkWebGPUSupported,
  createCanvas,
} from "..";
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
  constructor() {}

  // 初始化 GPUDevice 和 canvas
  async checkSupport(onError?: (error: Error) => void) {
    try {
      const gpuSupport = await checkWebGPUSupported();
      const { device, format } = gpuSupport;
      const canvasReturn = createCanvas(500, 500, { device, format });
      Object.assign(this, { ...gpuSupport, ...canvasReturn });
    } catch (error) {
      onError && onError(error as Error);
    }
    return this;
  }

  render(scene: Scene) {
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
    scene.render(pass);
    pass.end();
    this.device.queue.submit([encoder.finish()]);
  }
}
