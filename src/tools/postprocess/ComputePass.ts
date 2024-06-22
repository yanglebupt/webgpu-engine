import {
  InjectShaderOption,
  createComputePipeline,
  getBindGroupEntries,
  injectShaderCode,
} from "..";
import { Logger } from "../helper";
import { GPUShaderModuleCacheKey } from "../scene/cache";
import { BuildOptions } from "../scene/types";
import {
  ShaderCode,
  ShaderCodeWithContext,
  ShaderContext,
  WGSSLPosition,
} from "../shaders";
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
  static InjectShaderCode = (
    format: GPUTextureFormat,
    bindingStart: number
  ) => /*wgsl*/ `
@group(0) @binding(${bindingStart}) var inputTexture: texture_2d<f32>;
@group(0) @binding(${
    bindingStart + 1
  }) var outputTexture: texture_storage_2d<${format}, write>;
`;

  private customDispatch = false;
  public dispatchSize?: number[];
  public chunkSize: number[];

  constructor(
    compute: ShaderCodeWithContext,
    resourceViews?: Array<GPUResourceView>,
    dispatchSize?: number[]
  );
  constructor(
    compute: ShaderCode,
    resourceViews?: Array<GPUResourceView>,
    dispatchSize?: number[]
  );
  constructor(
    compute: ShaderCodeWithContext | ShaderCode,
    // 自定义资源
    resourceViews: Array<GPUResourceView> = [],
    // 自定义并行
    dispatchSize?: number[]
  ) {
    super(compute, GPUShaderStage.COMPUTE, resourceViews);
    this.dispatchSize = dispatchSize;
    this.chunkSize = [1];
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
      entries: getBindGroupEntries(this.resources, [
        texture.createView(),
        this.texture.createView(),
      ]),
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

    const bindingStart = this.addonBindGroupLayoutEntries.length;
    const bindGroupLayout = cached.bindGroupLayout.get([
      ...this.addonBindGroupLayoutEntries,
      {
        binding: bindingStart,
        visibility: GPUShaderStage.COMPUTE,
        texture: {
          viewDimension: "2d",
        },
      },
      {
        binding: bindingStart + 1,
        visibility: GPUShaderStage.COMPUTE,
        storageTexture: {
          format,
          viewDimension: "2d",
        },
      },
    ]);

    const injects: InjectShaderOption[] = [
      {
        inject: ComputePass.InjectShaderCode(format, bindingStart),
      },
    ];

    const { chunkSize, dispatchSize, order } = DispatchCompute.dispatch(
      device,
      descriptor.size as number[]
    );

    let _wh = "xy";

    if (!this.customDispatch) {
      // 如果用户没有指定 dispatchSize，则使用默认的
      this.dispatchSize = dispatchSize;
      this.chunkSize = chunkSize;
    }

    // 是否注入默认的 @workgroup_size()
    const workgroupSize = this.shaderCode.shaderCode.Info.Addon.find((a) =>
      a.includes("@workgroup_size")
    );
    const entry = this.shaderCode.shaderCode.Entry;
    if (workgroupSize) {
      // 有则更新
      const res = workgroupSize.match(/@workgroup_size\((.*)\)/)!;
      this.chunkSize = res[1].split(",").map((s) => Number(s));
    } else {
      // 没有则注入默认 chunkSize
      const { chunk_size, wh } = getChunkInfo({
        chunkSize: this.chunkSize,
        order,
      });
      _wh = wh;
      injects.push({
        inject: `@workgroup_size(${chunk_size})`,
        position: WGSSLPosition.Addon,
      });
    }

    this.shaderCode.shaderCode.Entry = entry.replaceAll(".wh", `.${_wh}`);
    const compute = injectShaderCode(
      {
        shaderCode: this.shaderCode.shaderCode,
        context: { chunkSize, order, ...this.shaderCode.context },
      },
      injects
    );

    let codeStr = compute.code(compute.context);

    this.pipeline = createComputePipeline(codeStr, device, {
      layout: device.createPipelineLayout({
        bindGroupLayouts: [bindGroupLayout],
      }),
    });
  }
}
