import { checkWebGPUSupported, createCanvas } from "..";
import { StorageTextureToCanvas } from "../helper";
import { Scene } from "../scene";
import { StaticTextureUtil } from "../utils/StaticTextureUtil";
import { EnvMap } from "../utils/envmap";
import { getSizeForMipFromTexture } from "../utils/mipmaps";

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
}

export class WebGPURenderer {
  static features: GPUFeatureName[] = [];
  public className?: string;
  public parentID?: string;
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
    Object.assign(this, {
      ...gpuSupport,
      ...canvasReturn,
      depthFormat: StaticTextureUtil.depthFormat,
    });
    return this;
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
