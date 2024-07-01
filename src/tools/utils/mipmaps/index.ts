import { SPDPassConfig, WebGPUSinglePassDownsampler } from "webgpu-spd";
import { createComputePipeline } from "../..";
import { DispatchCompute } from "../Dispatch";
import extract_mimmap from "./shaders/extract-mipmap.wgsl";
import { Logger } from "../../helper";
import TimeHelper from "../time-helper/TimeHelper";

export function getSizeForMipFromTexture(
  size: [number, number] | number[],
  mipLevel: number
) {
  return size.map((v) => Math.max(1, Math.floor(v / 2 ** mipLevel)));
}

export class MipMap {
  private computePass: GPUComputePassEncoder;
  private needEndPass: boolean;
  private downsampler: WebGPUSinglePassDownsampler;
  private finished: boolean = false;
  public commandEncoder?: GPUCommandEncoder;
  constructor(
    public device: GPUDevice,
    computePass?: GPUComputePassEncoder,
    public timeHelper?: TimeHelper
  ) {
    if (computePass) {
      this.computePass = computePass;
      this.needEndPass = false;
    } else {
      this.commandEncoder = device.createCommandEncoder({
        label: "mipmap command encoder",
      });
      this.computePass = this.commandEncoder.beginComputePass({
        ...this.timeHelper?.timestampWrites,
      });
      this.needEndPass = true;
    }
    this.downsampler = new WebGPUSinglePassDownsampler();
  }

  /* 因为这里是新开一个 command 和 computePass，改成使用已有的 computePass
     防止重复创建 encoder
    
     我们认为其的 dispatch 策略不比我们的差，因此也就不进行替换了

     注意点：MipMap 是一级接着一级生成的，没法一次到位，（至少目前不太清楚高效的一步到位生成某一个 level 的 mipmap）
     因此后面提取 mipmap filter 依赖于这一步
  */
  generateMipmaps(
    texture: GPUTexture,
    config?: SPDPassConfig & { closed?: boolean }
  ) {
    const pass = this.downsampler.preparePass(this.device, texture, config);
    if (!pass) {
      return false;
    } else {
      pass?.encode(this.computePass);
      this.tryEnd(config?.closed);
      return true;
    }
  }

  tryEnd(closed: boolean = false) {
    if (this.needEndPass && closed && !this.finished) {
      this.computePass.end();
      this.timeHelper?.end(this.commandEncoder!);
      this.device.queue.submit([this.commandEncoder!.finish()]);
      this.finished = true;
      Logger.log("closed mipmap pass");
    }
  }

  extractMipmap(
    texture: GPUTexture,
    target: { texture: GPUTexture; mipLevels: number[] },
    closed = true
  ) {
    const size = [texture.width, texture.height] as [number, number];
    const format = texture.format;
    if (format !== target.texture.format)
      throw new Error(
        "extractMipmap target format must same with src texture format"
      );
    if (size[0] !== target.texture.width || size[1] !== target.texture.height) {
      throw new Error(
        "extractMipmap target size must same with src texture size"
      );
    }
    const mipLevels: number[] = target.mipLevels;
    const { chunkSize, dispatchSize, order } = DispatchCompute.dispatch(
      this.device,
      size
    );
    const extract_mipmap_pipeline = createComputePipeline(
      extract_mimmap(format, chunkSize, order, mipLevels),
      this.device
    );
    dispatchSize[order[2]] = mipLevels.length;
    const extract_mipmap_bindGroup = this.device.createBindGroup({
      layout: extract_mipmap_pipeline.getBindGroupLayout(0),
      entries: [
        {
          binding: 0,
          resource: texture.createView(),
        },
        {
          binding: 1,
          resource: target.texture.createView({
            dimension: "2d-array",
          }),
        },
      ],
    });
    this.computePass.setPipeline(extract_mipmap_pipeline);
    this.computePass.setBindGroup(0, extract_mipmap_bindGroup);
    this.computePass.dispatchWorkgroups(
      dispatchSize[0],
      dispatchSize[1],
      dispatchSize[2]
    );
    this.tryEnd(closed);
  }
}

export * from "webgpu-spd";
