import { checkWebGPUSupported, createCanvas } from "..";
import { StorageTextureToCanvas } from "../helper";
import { CreateAndSetRecord } from "../loaders";
import { Scene } from "../scene";
import { StaticTextureUtil } from "../utils/StaticTextureUtil";
import { EnvMap } from "../utils/envmap";

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
  static features: GPUFeatureName[] = [];
  public className?: string;
  public parentID?: string;
  private done: boolean = false;
  constructor(options?: { className?: string; parentID?: string }) {
    this.className = options?.className;
    this.parentID = options?.parentID;
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
      { device, format },
      this.className,
      this.parentID
    );
    Object.assign(this, { ...gpuSupport, ...canvasReturn });
    return this;
  }

  render(scene: Scene, print?: (record: CreateAndSetRecord) => void) {
    const encoder = this.device.createCommandEncoder();
    // 非实时计算，只需要一次即可
    const realtime = scene.options?.realtime ?? false;
    const envMap = scene.options?.envMap;
    if (envMap && ((!realtime && !this.done) || realtime)) {
      const computePass = encoder.beginComputePass();
      envMap!.compute(computePass, scene.options?.envMapOptions);
      computePass.end();
    }
    const canvasTexture = this.ctx.getCurrentTexture();
    const depthTexture = StaticTextureUtil.createDepthTexture(this.device, [
      canvasTexture.width,
      canvasTexture.height,
    ]);
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

    if (envMap && !this.done) {
      const sc = new StorageTextureToCanvas(this.device, encoder);
      sc.render(envMap.diffuseTexure, {});
      sc.render(envMap.specularTexure, {});
    }
    this.device.queue.submit([encoder.finish()]);
    this.done = true;
    if (!realtime && envMap) {
      envMap!.destroy();
    }
  }
}
