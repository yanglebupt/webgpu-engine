import { Camera, OrbitController } from "../camera";
import { Light } from "../lights";
import { WebGPURenderer } from "../renderer";
import {
  EnvMap,
  createSamplerByPolyfill,
  getFilterType,
} from "../utils/envmap";
import { GPUSamplerCache, SolidColorTextureCache } from "./cache";
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
  showEnvMap?: boolean;
}

export class Scene implements Renderable {
  public polyfill: boolean;
  public options: SceneOption;
  public device: GPUDevice;
  public buildOptions: BuildOptions;
  public bindGroupLayout: GPUBindGroupLayout;
  public bindGroup!: GPUBindGroup;
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
  constructor(public renderer: WebGPURenderer, options?: SceneOption) {
    this.options = { showEnvMap: true, ...options };
    this.device = renderer.device;
    this.buildOptions = {
      device: this.device,
      format: this.renderer.format,
      depthFormat: this.renderer.depthFormat,
      scene: this,
      cached: {
        sampler: new GPUSamplerCache(this.device),
        solidColorTexture: new SolidColorTextureCache(this.device),
      },
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

    const hasEnvMap = !!this.options.envMap;
    if (hasEnvMap) this.options.envMap?.build(this.buildOptions);
    this.polyfill = !this.device.features.has(EnvMap.features[0]);
    const { sampleType, type } = getFilterType(this.polyfill);
    entries.push({
      binding: 2,
      visibility: GPUShaderStage.FRAGMENT,
      texture: { sampleType },
    });
    entries.push({
      binding: 3,
      visibility: GPUShaderStage.FRAGMENT,
      texture: { sampleType },
    });
    entries.push({
      binding: 4,
      visibility: GPUShaderStage.FRAGMENT,
      buffer: { type: "uniform" },
    });
    entries.push({
      binding: 5,
      visibility: GPUShaderStage.FRAGMENT,
      sampler: { type },
    });
    this.buffers[2] = hasEnvMap
      ? this.options.envMap!.diffuseTexure.createView()
      : this.buildOptions.cached.solidColorTexture.default.createView();
    this.buffers[3] = hasEnvMap
      ? this.options.envMap!.specularTexure.createView()
      : this.buildOptions.cached.solidColorTexture.default.createView();
    this.buffers[4] = this.device.createBuffer({
      size: EnvMap.view.arrayBuffer.byteLength,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM,
    });
    this.buffers[5] = createSamplerByPolyfill(
      this.polyfill,
      this.buildOptions.cached.sampler
    );

    this.bindGroupLayout = this.device.createBindGroupLayout({
      entries,
    });

    this.buffers[0] = this.device.createBuffer({
      size: Camera.view.arrayBuffer.byteLength,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM,
    });

    this.makeBindGroup(1);
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
        this.makeBindGroup(Math.floor(this.lightCount / this.maxLight) + 1);
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
    this.bindGroup = this.device.createBindGroup({
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

    EnvMap.view.set(this.options?.envMap?.getBufferView());
    this.device.queue.writeBuffer(
      this.buffers[4] as GPUBuffer,
      0,
      EnvMap.view.arrayBuffer
    );
  }

  set hasEnvMap(hasEnvMap: boolean) {
    if (hasEnvMap == this.options.showEnvMap) {
      return;
    }
    this.options.showEnvMap = hasEnvMap;
    this.buffers[2] = hasEnvMap
      ? this.options.envMap!.diffuseTexure.createView()
      : this.buildOptions.cached.solidColorTexture.default.createView();
    this.buffers[3] = hasEnvMap
      ? this.options.envMap!.specularTexure.createView()
      : this.buildOptions.cached.solidColorTexture.default.createView();
    this.makeBindGroup(1);
  }

  render(renderPass: GPURenderPassEncoder): void;
  render(): void;
  render(renderPass?: GPURenderPassEncoder) {
    if (!renderPass) {
      this.renderer.render(this);
    } else {
      if (!this.mainCamera) return;
      this.updates.forEach((update) => update.update());
      if (this.options.showEnvMap)
        this.options.envMap?.render(renderPass, this.device, this.mainCamera);
      this.setBuffers();
      renderPass.setBindGroup(0, this.bindGroup);
      this.children.forEach((child) => child.render(renderPass, this.device));
    }
  }
}
