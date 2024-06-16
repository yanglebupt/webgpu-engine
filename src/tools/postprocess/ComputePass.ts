import {
  ShaderCodeWithContext,
  createComputePipeline,
  getBindGroupEntries,
  injectShaderCode,
} from "..";
import { Logger } from "../helper";
import { GPUShaderModuleCacheKey } from "../scene/cache";
import { BuildOptions } from "../scene/types";
import { ShaderCode, ShaderContext } from "../shaders";
import { GPUResourceView } from "../type";
import { DispatchCompute, axis } from "../utils/Dispatch";
import { Pass } from "./Pass";

export function getChunkInfo(context: ShaderContext) {
  const { order, chunkSize } = context;
  const [width_idx, height_idx] = order;
  const wh = `${axis[width_idx]}${axis[height_idx]}`;
  return { wh, chunk_size: chunkSize.join(",") };
}

export class ComputePass extends Pass<GPUComputePipeline> {
  static features: GPUFeatureName[] = ["bgra8unorm-storage"];
  static InjectShaderCode = (format: GPUTextureFormat) => /*wgsl*/ `
@group(0) @binding(0) var inputTexture: texture_2d<f32>;
@group(0) @binding(1) var outputTexture: texture_storage_2d<${format}, write>;
`;
  static startBinding = 2;

  private customDispatch = false;
  private inject = true;
  private dispatchSize?: number[];

  constructor(
    compute: ShaderCodeWithContext,
    resourceViews?: Array<GPUResourceView>,
    parallel?: { dispatchSize?: number[]; inject?: boolean }
  );
  constructor(
    compute: ShaderCode,
    resourceViews?: Array<GPUResourceView>,
    parallel?: { dispatchSize?: number[]; inject?: boolean }
  );

  constructor(
    compute: ShaderCodeWithContext | ShaderCode,
    // 自定义资源
    resourceViews: Array<GPUResourceView> = [],
    // 自定义并行
    parallel?: { dispatchSize?: number[]; inject?: boolean }
  ) {
    super(
      compute,
      GPUShaderStage.COMPUTE,
      ComputePass.startBinding,
      resourceViews
    );
    const { dispatchSize, inject } = parallel ?? {};
    this.inject = inject ?? false;
    this.dispatchSize = dispatchSize;
    this.customDispatch = !(
      dispatchSize === null ||
      dispatchSize === undefined ||
      dispatchSize.length === 0
    );
  }

  render(device: GPUDevice, pass: GPUComputePassEncoder, texture: GPUTexture) {
    super.render(device);

    const bindGroup = device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: getBindGroupEntries(
        [texture.createView(), this.texture.createView()],
        this.resources
      ),
    });

    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(
      this.dispatchSize![0],
      this.dispatchSize![1],
      this.dispatchSize![2]
    );
  }

  build(options: BuildOptions, descriptor: GPUTextureDescriptor) {
    super.build(options, descriptor);

    const { device, cached } = options;
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
      ...this.addonBindGroupLayoutEntries,
    ]);

    const { chunkSize, dispatchSize, order } = DispatchCompute.dispatch(
      device,
      descriptor.size as number[]
    );

    if (!this.customDispatch) {
      this.dispatchSize = dispatchSize;
    }

    const compute = injectShaderCode(
      {
        shaderCode: this.shaderCode.shaderCode,
        context: { chunkSize, order, ...this.shaderCode.context },
      },
      ComputePass.InjectShaderCode,
      format
    );

    let codeStr = compute.code(compute.context);
    if (this.inject) {
      /* 
        注入一些变量 @inject(chunk_size) @inject(wh)
      */
      codeStr = this.injectCode(compute, getChunkInfo(compute.context));
      Logger.log("inject....");
    }

    this.pipeline = createComputePipeline(codeStr, device, {
      layout: device.createPipelineLayout({
        bindGroupLayouts: [bindGroupLayout],
      }),
    });
  }

  injectCode(compute: GPUShaderModuleCacheKey<any>, args: Record<string, any>) {
    const { code, context } = compute;
    const str = code(context);
    const fliterStr = str.replaceAll(/@inject\((.*?)\)/g, function () {
      const key = arguments[1];
      return args[key];
    });
    return fliterStr;
  }
}
