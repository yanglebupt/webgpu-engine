import { Scene } from ".";
import { Camera } from "../cameras/Camera";
import { MipMap } from "../utils/mipmaps";
import {
  GPUBindGroupLayoutCache,
  GPURenderPipelineCache,
  GPUSamplerCache,
  SolidColorTextureCache,
} from "./cache";

export const REDNDER_FIRST = Symbol("REDNDER_FIRST");

export class Type {
  static getClassName(obj: Object) {
    return obj.constructor.name;
  }
  static is(obj: Addable, name: string) {
    return Reflect.has(obj, name);
  }
  static isRenderable(obj: Addable) {
    return Type.is(obj, "render");
  }
  static isBuildable(obj: Addable) {
    return Type.is(obj, "build");
  }
  static isUpdatable(obj: Addable) {
    return Type.is(obj, "update");
  }
  static isComputable(obj: Addable) {
    return Type.is(obj, "compute");
  }
}

export type Addable =
  | VirtualView
  | Buildable
  | Updatable
  | Renderable
  | Computable;

/* 
  只包含数据，例如 uniform storage buffer，而没有实体
  examples: Light、Camera
*/
export interface VirtualView {
  getBufferView(): Record<string, any>;
}

/*
  需要构建 pipeline 的对象，包括 render 和 compute pipeline，在添加的时候，由 scene 负责调用构建
  examples: EnvMap, GLTFScene
*/
export interface BuildCache {
  sampler: GPUSamplerCache;
  solidColorTexture: SolidColorTextureCache;
  bindGroupLayout: GPUBindGroupLayoutCache;
  pipeline: GPURenderPipelineCache;
  mipmap: MipMap;
}
export interface BuildOptions {
  device: GPUDevice;
  format: GPUTextureFormat;
  depthFormat: GPUTextureFormat;
  cached: BuildCache;
  scene: Scene;
  antialias: boolean;
  alphaMode: GPUCanvasAlphaMode;
}
export interface Buildable {
  build(options: BuildOptions): void;
}

/*
  需要更新数据的对象，一般用于同步一些控制器 Controller 和 Helper
  examples: OrbitController
*/
export interface Updatable {
  update(device?: GPUDevice): void;
}

/*
  需要执行渲染的对象，一般是 3D 模型
  examples: EnvMap, GLTFScene
*/
export interface Renderable<
  RenderFunc extends Function = (
    renderPass: GPURenderPassEncoder,
    device?: GPUDevice
  ) => void
> {
  render: RenderFunc;
}

export interface RenderableFirst
  extends Renderable<
    (
      renderPass: GPURenderPassEncoder,
      device: GPUDevice,
      camera: Camera
    ) => void
  > {}

/*
  需要执行计算的对象，一般是进行额外的任务 compute shader
  examples: EnvMap
*/
export interface Computable {
  compute(computePass: GPUComputePassEncoder, device?: GPUDevice): void;
}
