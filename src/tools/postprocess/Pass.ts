import { BuildOptions } from "../scene/types";
import { GPUResource, GPUResourceView } from "../type";
import {
  getAddonBindGroupLayoutEntries,
  getResourcesfromViews,
  updateResourceViews,
} from "..";
import { ShaderCode, ShaderCodeWithContext } from "../shaders";

export abstract class Pass<
  P extends GPURenderPipeline | GPUComputePipeline =
    | GPURenderPipeline
    | GPUComputePipeline
> {
  texture!: GPUTexture;
  protected pipeline!: P;
  protected resources!: GPUResource[];
  protected addonBindGroupLayoutEntries: GPUBindGroupLayoutEntry[];
  protected shaderCode: ShaderCodeWithContext;
  constructor(
    code: ShaderCodeWithContext | ShaderCode,
    visibility: GPUShaderStageFlags,
    startBinding: number = 0,
    // 自定义资源
    public resourceViews: Array<GPUResourceView> = []
  ) {
    const shaderCode = Object.hasOwn(code, "context")
      ? (code as ShaderCodeWithContext)
      : { shaderCode: code as ShaderCode, context: {} };
    this.shaderCode = shaderCode;

    this.addonBindGroupLayoutEntries = getAddonBindGroupLayoutEntries(
      shaderCode.shaderCode,
      visibility,
      startBinding,
      resourceViews
    );
  }

  build({ device, cached }: BuildOptions, descriptor: GPUTextureDescriptor) {
    this.resources = getResourcesfromViews(
      device,
      { sampler: cached.sampler },
      this.resourceViews
    );
  }

  render(
    device: GPUDevice,
    encoder?: GPUCommandEncoder | GPUComputePassEncoder,
    texture?: GPUTexture
  ) {
    this.update();
    updateResourceViews(device, this.resourceViews);
  }

  update() {}
}
