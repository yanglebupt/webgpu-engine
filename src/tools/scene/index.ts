import { Camera, OrbitController } from "../camera";
import { Light } from "../lights";
import { CreateAndSetRecord } from "../loaders";
import { WebGPURenderer } from "../renderer";
import { EnvMap } from "../utils/envmap";
import {
  BuildOptions,
  Buildable,
  Object3D,
  Renderable,
  Type,
  Updatable,
} from "./types";

export interface SceneOption {
  realtime?: boolean;
  envMap?: EnvMap;
}

export class Scene implements Renderable {
  public device: GPUDevice;
  public buildOptions: BuildOptions;
  public bindGroupLayout: GPUBindGroupLayout;
  public bindGroup: GPUBindGroup;
  public cameras: Camera[] = [];
  public mainCamera: Camera | null = null;
  public lights: Light[] = [];
  public buffers: (GPUBuffer | GPUTextureView | GPUSampler)[] = [];
  public children: Renderable[] = [];
  public updates: Updatable[] = [];
  public needUpdateLightBuffer: boolean = true;
  ////////////防止频繁更新light所在的bindgroup/////////////////
  public maxLight: number = 50;
  public lightCount: number = 0;
  constructor(public renderer: WebGPURenderer, public options?: SceneOption) {
    this.device = renderer.device;
    this.buildOptions = {
      device: this.device,
      format: this.renderer.format,
      depthFormat: this.renderer.depthFormat,
      scene: this,
    };

    const entries: GPUBindGroupLayoutEntry[] = [
      {
        binding: 0,
        visibility: GPUShaderStage.VERTEX,
        buffer: { type: "uniform" },
      },
      {
        binding: 1,
        visibility: GPUShaderStage.FRAGMENT,
        buffer: { type: "read-only-storage" },
      },
    ];

    const envMap = options?.envMap;
    if (envMap) {
      envMap.build(this.buildOptions);
      const f32SampleType = !envMap.polyfill ? "float" : "unfilterable-float";
      const f32Type = !envMap.polyfill ? "filtering" : "non-filtering";
      entries.push({
        binding: 2,
        visibility: GPUShaderStage.FRAGMENT,
        texture: { sampleType: f32SampleType },
      });
      entries.push({
        binding: 3,
        visibility: GPUShaderStage.FRAGMENT,
        texture: { viewDimension: "2d-array", sampleType: f32SampleType },
      });
      entries.push({
        binding: 4,
        visibility: GPUShaderStage.FRAGMENT,
        buffer: { type: "uniform" },
      });
      entries.push({
        binding: 5,
        visibility: GPUShaderStage.FRAGMENT,
        sampler: { type: f32Type },
      });
      this.buffers[2] = envMap.diffuseTexure.createView();
      this.buffers[3] = envMap.specularTexure.createView({
        dimension: "2d-array",
      });
      this.buffers[4] = this.device.createBuffer({
        size: EnvMap.view.arrayBuffer.byteLength,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM,
      });
      this.buffers[5] = this.device.createSampler();
    }

    this.bindGroupLayout = this.device.createBindGroupLayout({
      entries,
    });

    this.buffers[0] = this.device.createBuffer({
      size: Camera.view.arrayBuffer.byteLength,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM,
    });

    this.bindGroup = this.makeBindGroup(1);
  }

  add(obj: Object3D) {
    if (Type.isBuildable(obj)) {
      (obj as Buildable).build(this.buildOptions);
    }
    if (obj instanceof Camera) {
      this.cameras.push(obj);
      this.mainCamera = obj;
    } else if (obj instanceof Light) {
      this.lights.push(obj);
      this.lightCount++;
      /* 
        新加光源，需要更新 buffer size，优化手段
        以 this.maxLight 为间隔，当每次超过后再进行扩容，防止频繁更新
      */
      if (this.lightCount > 1 && this.lightCount % this.maxLight == 1) {
        this.bindGroup = this.makeBindGroup(
          Math.floor(this.lightCount / this.maxLight) + 1
        );
      }
    } else if (Type.isUpdatable(obj)) {
      if (obj instanceof OrbitController) this.add(obj.camera);
      this.updates.push(obj as Updatable);
    } else if (Type.isRenderable(obj)) {
      this.children.push(obj as Renderable);
    } else {
      throw new Error(`Unsupported object type: ${Type.getClassName(obj)}`);
    }
  }

  makeBindGroup(size: number) {
    this.buffers[1] = this.device.createBuffer({
      size: Light.getViewSize(this.maxLight * size),
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.STORAGE,
    });
    return this.device.createBindGroup({
      layout: this.bindGroupLayout,
      entries: this.buffers.map((buffer, binding) => {
        if (buffer instanceof GPUBuffer) {
          return {
            binding,
            resource: { buffer },
          };
        } else {
          return {
            binding,
            resource: buffer,
          };
        }
      }),
    });
  }

  setBuffers() {
    Camera.view.set(this.mainCamera!.getBufferView());
    this.device.queue.writeBuffer(
      this.buffers[0] as GPUBuffer,
      0,
      Camera.view.arrayBuffer
    );
    const lightCollectionView = Light.view(this.lights.length);
    lightCollectionView.set({
      lightNums: this.lights.length,
      lights: this.lights.map((light) => light.getBufferView()),
    });
    this.device.queue.writeBuffer(
      this.buffers[1] as GPUBuffer,
      0,
      lightCollectionView.arrayBuffer,
      0,
      lightCollectionView.arrayBuffer.byteLength
    );

    if (this.options?.envMap) {
      EnvMap.view.set(this.options?.envMap?.getBufferView());
      this.device.queue.writeBuffer(
        this.buffers[4] as GPUBuffer,
        0,
        EnvMap.view.arrayBuffer
      );
    }
  }

  render(renderPass: GPURenderPassEncoder): void;
  render(): void;
  render(renderPass?: GPURenderPassEncoder) {
    if (!renderPass) {
      this.renderer.render(this);
    } else {
      if (!this.mainCamera) return;
      this.updates.forEach((update) => update.update());
      this.options?.envMap?.render(renderPass, this.device, this.mainCamera);
      this.setBuffers();
      renderPass.setBindGroup(0, this.bindGroup);
      this.children.forEach((child) => child.render(renderPass, this.device));
    }
  }
}
