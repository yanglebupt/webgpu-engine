import { getBindGroupEntries, injectShaderCode } from "..";
import { BuildOptions } from "../scene/types";
import { ShaderCode, ShaderCodeWithContext } from "../shaders";
import vertex from "../shaders/vertex-wgsl/full-plane.wgsl";
import { GPUResourceView } from "../type";
import { Pass } from "./Pass";

export class RenderPass extends Pass<GPURenderPipeline> {
  static InjectShaderCode = (bindingStart: number) => /*wgsl*/ `
@group(0) @binding(${bindingStart}) var _sampler: sampler;
@group(0) @binding(${bindingStart + 1}) var inputTexture: texture_2d<f32>;
`;

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
    super(fragment, GPUShaderStage.FRAGMENT, resourceViews);
  }

  render(device: GPUDevice, encoder: GPUCommandEncoder, texture: GPUTexture) {
    super.render(device);

    const bindGroup = device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: getBindGroupEntries(this.resources, [texture.createView()]),
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

    const bindingStart = this.addonBindGroupLayoutEntries.length;
    const bindGroupLayout = cached.bindGroupLayout.get([
      ...this.addonBindGroupLayoutEntries,
      {
        binding: bindingStart,
        visibility: GPUShaderStage.FRAGMENT,
        sampler: { type: "filtering" },
      },
      {
        binding: bindingStart + 1,
        visibility: GPUShaderStage.FRAGMENT,
        texture: {
          viewDimension: "2d",
        },
      },
    ]);

    this.resources.push(cached.sampler.default);

    this.pipeline = cached.pipeline.get(
      { code: vertex, context: { flipY: true } },
      injectShaderCode(this.shaderCode, [
        { inject: RenderPass.InjectShaderCode(bindingStart) },
      ]),
      {
        format,
        primitive: { topology: "triangle-list" },
      },
      [bindGroupLayout]
    );
  }
}
