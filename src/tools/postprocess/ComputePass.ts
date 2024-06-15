import { createComputePipeline, getBindGroupEntries } from "..";
import { GPUShaderModuleCacheKey } from "../scene/cache";
import { BuildOptions } from "../scene/types";
import { GPUResourceView } from "../type";
import { DispatchCompute } from "../utils/Dispatch";
import { Pass } from "./Pass";

export const InputBindGroupShaderCode = (format: GPUTextureFormat) => /*wgsl*/ `
@group(0) @binding(0) var inputTexture: texture_2d<f32>;
@group(0) @binding(1) var outputTexture: texture_storage_2d<${format}, write>;
`;

export class ComputePass extends Pass {
  static features: GPUFeatureName[] = ["bgra8unorm-storage"];
  texture!: GPUTexture;
  pipeline!: GPUComputePipeline;
  dispatchSize!: number[];

  constructor(
    public compute: GPUShaderModuleCacheKey<any>,
    // 自定义资源
    resourceViews?: Array<{ [key: string]: GPUResourceView }>
  ) {
    super();
  }

  render(
    encoder: GPUCommandEncoder,
    device: GPUDevice,
    texture: GPUTexture,
    options: { isEnd: boolean; target?: GPUTexture }
  ) {
    const bindGroup = device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: getBindGroupEntries([
        texture.createView(),
        this.texture.createView(),
      ]),
    });
    const pass = encoder.beginComputePass();
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(
      this.dispatchSize[0],
      this.dispatchSize[1],
      this.dispatchSize[2]
    );
    pass.end();

    const { isEnd, target } = options;
    if (isEnd && target) {
      if (target.format === this.texture.format)
        encoder.copyTextureToTexture(
          { texture: this.texture },
          { texture: target },
          [target.width, target.height]
        );
      else {
        // 绘制
        console.log("draw compute results...");
      }
    }
  }

  build({ device, cached }: BuildOptions, descriptor: GPUTextureDescriptor) {
    const format =
      descriptor.format === "bgra8unorm" &&
      device.features.has("bgra8unorm-storage")
        ? descriptor.format
        : "rgba8unorm";
    this.texture = device.createTexture({
      ...descriptor,
      usage: descriptor.usage | GPUTextureUsage.STORAGE_BINDING,
      format,
    });

    const bindGroupLayout = cached.bindGroupLayout.get([
      {
        binding: 0,
        visibility: GPUShaderStage.COMPUTE,
        texture: {
          viewDimension: "2d",
        },
      },
      {
        binding: 1,
        visibility: GPUShaderStage.COMPUTE,
        storageTexture: {
          format,
          viewDimension: "2d",
        },
      },
    ]);

    const { chunkSize, dispatchSize, order } = DispatchCompute.dispatch(
      device,
      descriptor.size as number[]
    );
    this.dispatchSize = dispatchSize;
    this.pipeline = createComputePipeline(
      this.compute.code({ format, chunkSize, order, ...this.compute.context }),
      device,
      {
        layout: device.createPipelineLayout({
          bindGroupLayouts: [bindGroupLayout],
        }),
      }
    );
  }
}
