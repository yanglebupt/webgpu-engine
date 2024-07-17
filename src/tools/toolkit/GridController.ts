import { mat4 } from "wgpu-matrix";
import { Camera } from "../cameras/Camera";
import { Buildable, BuildOptions, RenderableFirst } from "../scene/types";
import vertex from "./shaders/grid-controller/grid-controller-vert.wgsl";
import fragment, {
  GridUniform,
} from "./shaders/grid-controller/grid-controller-frag.wgsl";
import { ToolKit } from "./ToolKit";
import {
  makeShaderDataDefinitions,
  makeStructuredView,
  ShaderDataDefinitions,
  StructuredView,
} from "webgpu-utils";
import { BlendingPreset, getBlendFromPreset } from "../utils/Blend";

export interface GridController {
  renderPipeline: GPURenderPipeline;
  vertexBuffer: GPUBuffer;
  vertexValue: Float32Array;
  fragmentBuffer: GPUBuffer;
  fragmentValue: StructuredView;
  bindGroup: GPUBindGroup;
}
// https://zhuanlan.zhihu.com/p/647926704?utm_id=0
export class GridController
  extends ToolKit
  implements RenderableFirst, Buildable
{
  static defs: ShaderDataDefinitions;
  static {
    try {
      GridController.defs = makeShaderDataDefinitions(GridUniform);
    } catch (error) {}
  }

  distance = 2;
  gridIntensity = 0.5;
  constructor() {
    super();
    this.vertexValue = new Float32Array(4 * 4 * 2);
    this.fragmentValue = makeStructuredView(GridController.defs.uniforms.uni);

    const logDistance = Math.log2(this.distance);
    const upperDistance = Math.pow(2, Math.floor(logDistance) + 1);
    const lowerDistance = Math.pow(2, Math.floor(logDistance));
    const fade =
      (this.distance - lowerDistance) / (upperDistance - lowerDistance);

    const level = -Math.floor(logDistance);
    const primaryScale = Math.pow(2, level);
    const secondaryScale = Math.pow(2, level + 1);
    const axisIntensity = 0.3 / primaryScale;

    this.fragmentValue.set({
      fade,
      flipProgress: 0,
      primaryScale,
      secondaryScale,
      gridIntensity: this.gridIntensity,
      axisIntensity,
    });
  }

  build({ device, format, depthFormat, cached }: BuildOptions) {
    const blending = getBlendFromPreset(BlendingPreset.Additive); // 添加 Blending
    this.renderPipeline = cached.pipeline.get(
      { code: vertex, context: {} },
      { code: fragment, context: {} },
      {
        format,
        primitive: { topology: "triangle-list" },
        depthStencil: {
          format: depthFormat,
          depthWriteEnabled: true,
          depthCompare: "less-equal",
        },
        blending,
      },
      [
        cached.bindGroupLayout.get([
          {
            binding: 0,
            visibility: GPUShaderStage.VERTEX,
            buffer: { type: "uniform" },
          },
          {
            binding: 1,
            visibility: GPUShaderStage.FRAGMENT,
            buffer: { type: "uniform" },
          },
        ]),
      ]
    );

    this.vertexBuffer = device.createBuffer({
      size: 4 * 4 * 4 * 2,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM,
    });
    this.fragmentBuffer = device.createBuffer({
      size: 4 * 4 * 4 * 2,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM,
    });

    this.bindGroup = device.createBindGroup({
      layout: this.renderPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.vertexBuffer } },
        { binding: 1, resource: { buffer: this.fragmentBuffer } },
      ],
    });
  }

  render(renderPass: GPURenderPassEncoder, device: GPUDevice, camera: Camera) {
    const pv = mat4.multiply(camera.matrix, camera.viewMatrix);
    const pvInverse = mat4.inverse(pv); // inverse(projection * view) 进行顶点变换，（clip space 转 世界坐标）作为 cubemap 采样的坐标
    this.vertexValue.subarray(0, 16).set(pv);
    this.vertexValue.subarray(16).set(pvInverse);
    device.queue.writeBuffer(this.vertexBuffer, 0, this.vertexValue);

    this.fragmentValue.set({
      near: camera.near,
      far: camera.far,
    });
    device.queue.writeBuffer(
      this.fragmentBuffer,
      0,
      this.fragmentValue.arrayBuffer
    );

    renderPass.setPipeline(this.renderPipeline);
    renderPass.setBindGroup(0, this.bindGroup);
    renderPass.draw(6);
  }
}
