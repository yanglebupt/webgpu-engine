import { Vec4 } from "wgpu-matrix";
import fragment, {
  BasicUnifom,
} from "../shaders/fragment-wgsl/mesh/basic.wgsl";
import {
  ShaderDataDefinitions,
  StructuredView,
  makeShaderDataDefinitions,
  makeStructuredView,
} from "webgpu-utils";
import { MeshMaterial } from "./MeshMaterial";
import { BuildOptions } from "../scene/types";

export interface MeshBasicMaterial {
  color: Vec4;
}

/**
 * TODO: 对于 MeshBasicMaterial，可以在 shader 中补充更多内容
 */
export class MeshBasicMaterial extends MeshMaterial {
  static defs: ShaderDataDefinitions;
  static {
    try {
      MeshBasicMaterial.defs = makeShaderDataDefinitions(BasicUnifom);
    } catch (error) {}
  }
  private uniformValue: StructuredView;
  private uniform!: GPUBuffer;
  constructor(options?: Partial<MeshBasicMaterial>) {
    super();
    Object.assign(this, { color: [1, 0, 0, 1], ...options });
    this.uniformValue = makeStructuredView(MeshBasicMaterial.defs.uniforms.uni);
  }

  update(device: GPUDevice) {
    this.uniformValue.set({
      color: this.color,
    });
    device.queue.writeBuffer(this.uniform, 0, this.uniformValue.arrayBuffer);
  }

  build({ device }: BuildOptions) {
    const bindGroupLayoutEntries: GPUBindGroupLayoutEntry[] = [
      {
        binding: 0,
        visibility: GPUShaderStage.FRAGMENT,
        buffer: { type: "uniform" },
      },
    ];
    this.uniform = device.createBuffer({
      size: this.uniformValue.arrayBuffer.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    this.update(device);
    return {
      fragment: {
        resources: [this.uniform],
        bindGroupLayoutEntries,
        shader: { code: fragment, context: {} },
      },
    };
  }
}
