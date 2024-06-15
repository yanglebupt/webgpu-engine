import { makeShaderDataDefinitions, makeStructuredView } from "webgpu-utils";
import { BuildOptions, Type } from "../scene/types";
import { GPUResource, GPUResourceView } from "../type";
import { ResourceBuffer } from "../textures/ResourceBuffer";
import { ShaderCodeWithContext } from "..";
import { ShaderCode } from "../shaders";

export abstract class Pass<
  P extends GPURenderPipeline | GPUComputePipeline =
    | GPURenderPipeline
    | GPUComputePipeline
> {
  texture!: GPUTexture;
  protected pipeline!: P;
  protected resources!: GPUResource[];
  protected addonBindGroupEntries: GPUBindGroupLayoutEntry[] = [];
  protected shaderCode: ShaderCodeWithContext;
  constructor(
    code: ShaderCodeWithContext | ShaderCode,
    // 自定义资源
    public resourceViews: Array<GPUResourceView> = [],
    startBinding: number,
    visibility: GPUShaderStageFlags
  ) {
    const shaderCode = Object.hasOwn(code, "context")
      ? (code as ShaderCodeWithContext)
      : { shaderCode: code as ShaderCode, context: {} };
    this.shaderCode = shaderCode;
    const defs = makeShaderDataDefinitions(
      shaderCode.shaderCode.DataDefinition
    );
    resourceViews.forEach((resourceView, idx) => {
      if (resourceView instanceof ResourceBuffer) {
        this.addonBindGroupEntries.push({
          binding: startBinding + idx,
          visibility,
          buffer: { type: resourceView.type },
        });
        resourceView.bufferView = makeStructuredView(
          defs.uniforms[resourceView.name]
        );
      } else {
        this.addonBindGroupEntries.push({
          binding: startBinding + idx,
          visibility,
          texture: { viewDimension: "2d" },
        });
      }
    });
  }

  build({ device, cached }: BuildOptions, descriptor: GPUTextureDescriptor) {
    this.resources = this.resourceViews.map((resourceView) => {
      if (resourceView instanceof ResourceBuffer) {
        resourceView.upload(device);
        return resourceView.buffer;
      } else {
        resourceView.upload(device, cached.sampler);
        return resourceView.texture.createView();
      }
    });
  }

  update(device: GPUDevice) {
    this.resourceViews.forEach((resourceView: any) => {
      if (Type.isUpdatable(resourceView)) resourceView.update(device);
    });
  }
}
