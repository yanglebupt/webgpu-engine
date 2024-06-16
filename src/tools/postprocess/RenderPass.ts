import {
  ShaderCodeWithContext,
  getBindGroupEntries,
  injectShaderCode,
} from "..";
import { BuildOptions } from "../scene/types";
import { ShaderCode } from "../shaders";
import vertex from "../shaders/vertex-wgsl/full-plane.wgsl";
import { GPUResourceView } from "../type";
import { Pass } from "./Pass";

export class RenderPass extends Pass<GPURenderPipeline> {
  static InjectShaderCode = /*wgsl*/ `
@group(0) @binding(0) var inputTexture: texture_2d<f32>;
@group(0) @binding(1) var _sampler: sampler;
`;
  static startBinding = 2;

  constructor(
    fragment: ShaderCodeWithContext,
    resourceViews?: Array<GPUResourceView>
  );
  constructor(fragment: ShaderCode, resourceViews?: Array<GPUResourceView>);
  constructor(
    fragment: ShaderCodeWithContext | ShaderCode,
    // 自定义资源
    resourceViews: Array<GPUResourceView> = []
  ) {
    super(
      fragment,
      resourceViews,
      RenderPass.startBinding,
      GPUShaderStage.FRAGMENT
    );
  }

  render(device: GPUDevice, encoder: GPUCommandEncoder, texture: GPUTexture) {
    super.render(device);

    const bindGroup = device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: getBindGroupEntries([texture.createView()], this.resources),
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
  }

  build(options: BuildOptions, descriptor: GPUTextureDescriptor) {
    super.build(options, descriptor);

    const { device, cached, format } = options;
    this.texture = device.createTexture({
      ...descriptor,
      usage: descriptor.usage | GPUTextureUsage.RENDER_ATTACHMENT,
    });

    const bindGroupLayout = cached.bindGroupLayout.get([
      {
        binding: 0,
        visibility: GPUShaderStage.FRAGMENT,
        texture: {
          viewDimension: "2d",
        },
      },
      {
        binding: 1,
        visibility: GPUShaderStage.FRAGMENT,
        sampler: { type: "filtering" },
      },
      ...this.addonBindGroupEntries,
    ]);

    this.resources.unshift(cached.sampler.default);

    this.pipeline = cached.pipeline.get(
      { code: vertex, context: { flipY: true } },
      injectShaderCode(this.shaderCode, RenderPass.InjectShaderCode),
      {
        format,
        primitive: { topology: "triangle-list" },
      },
      [bindGroupLayout]
    );
  }
}
