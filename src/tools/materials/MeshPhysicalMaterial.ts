import { Vec4 } from "wgpu-matrix";
import { BuildOptions } from "../scene/types";
import fragment, {
  DataDefinitions,
} from "../shaders/fragment-wgsl/mesh/basic.wgsl";
import {
  ShaderDataDefinitions,
  StructuredView,
  makeShaderDataDefinitions,
  makeStructuredView,
} from "webgpu-utils";
import { MeshMaterial } from "./MeshMaterial";

export interface MeshPhysicalMaterial {
  color: Vec4;
}

/**
 * TODO: 对于 MeshBasicMaterial，可以在 shader 中补充更多内容
 */
export class MeshPhysicalMaterial extends MeshMaterial {
  static defs: ShaderDataDefinitions;
  static {
    try {
      MeshPhysicalMaterial.defs = makeShaderDataDefinitions(DataDefinitions());
    } catch (error) {}
  }
  private uniformValue: StructuredView;
  private uniform!: GPUBuffer;
  constructor(options?: Partial<MeshPhysicalMaterial>) {
    super();
    Object.assign(this, { color: [1, 0, 0, 1], ...options });
    this.uniformValue = makeStructuredView(
      MeshPhysicalMaterial.defs.uniforms.uni
    );
  }

  update(device: GPUDevice) {
    this.uniformValue.set({
      color: this.color,
    });
    device.queue.writeBuffer(this.uniform, 0, this.uniformValue.arrayBuffer);
  }

  build(
    { device, cached, scene }: BuildOptions,
    bindGroupLayoutEntries: GPUBindGroupLayoutEntry[]
  ) {
    const bindingStart = bindGroupLayoutEntries.length;
    const bindGroupLayout = cached.bindGroupLayout.get([
      ...bindGroupLayoutEntries,
      {
        binding: bindingStart,
        visibility: GPUShaderStage.FRAGMENT,
        buffer: { type: "uniform" },
      },
    ]);
    this.uniform = device.createBuffer({
      size: this.uniformValue.arrayBuffer.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    return {
      bindGroupIndex: 1,
      resources: [this.uniform],
      bindGroupLayout: bindGroupLayout,
      bindGroupLayouts: [scene.bindGroupLayout, bindGroupLayout],
      fragment: { code: fragment, context: { bindingStart } },
    };
  }
}
