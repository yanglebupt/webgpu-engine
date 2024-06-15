import { makeShaderDataDefinitions, makeStructuredView } from "webgpu-utils";
import { getBindGroupEntries } from "..";
import { GPUShaderModuleCacheKey } from "../scene/cache";
import { BuildOptions } from "../scene/types";
import vertex from "../shaders/vertex-wgsl/full-plane.wgsl";
import { GPUResource, GPUResourceView } from "../type";
import { Pass } from "./Pass";

export const InputBindGroupShaderCode = /*wgsl*/ `
@group(0) @binding(0) var _sampler: sampler;
@group(0) @binding(1) var inputTexture: texture_2d<f32>;
`;

export class RenderPass extends Pass {
  texture!: GPUTexture;
  pipeline!: GPURenderPipeline;
  resources!: GPUResource[];

  constructor(
    public fragment: GPUShaderModuleCacheKey<any>,
    // 自定义资源
    resourceViews?: Array<{ [key: string]: GPUResourceView }>
  ) {
    super();
    const fragmentStr = fragment.code(fragment.context);
    const defs = makeShaderDataDefinitions(fragmentStr);
  }

  render(
    encoder: GPUCommandEncoder,
    device: GPUDevice,
    texture: GPUTexture,
    options: { isEnd: boolean; target?: GPUTexture }
  ) {
    const bindGroup = device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: getBindGroupEntries([...this.resources, texture.createView()]),
    });
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          loadOp: "clear",
          storeOp: "store",
          view: this.texture.createView(),
        },
      ],
    });
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.draw(3);
    pass.end();

    const { isEnd, target } = options;
    if (isEnd && target) {
      encoder.copyTextureToTexture(
        { texture: this.texture },
        { texture: target },
        [target.width, target.height]
      );
    }
  }

  build(
    { device, cached, format }: BuildOptions,
    descriptor: GPUTextureDescriptor
  ) {
    this.texture = device.createTexture({
      ...descriptor,
      usage: descriptor.usage | GPUTextureUsage.RENDER_ATTACHMENT,
    });
    const bindGroupLayout = cached.bindGroupLayout.get([
      {
        binding: 0,
        visibility: GPUShaderStage.FRAGMENT,
        sampler: { type: "filtering" },
      },
      {
        binding: 1,
        visibility: GPUShaderStage.FRAGMENT,
        texture: {
          viewDimension: "2d",
        },
      },
    ]);
    this.resources = [cached.sampler.default];
    this.pipeline = cached.pipeline.get(
      { code: vertex, context: { flipY: true } },
      this.fragment,
      {
        format,
        primitive: { topology: "triangle-list" },
      },
      [bindGroupLayout]
    );
  }
}
