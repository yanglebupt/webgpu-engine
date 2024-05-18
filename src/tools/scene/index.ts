import { Camera, OrbitController } from "../camera";
import { Light } from "../lights";
import { CreateAndSetRecord } from "../loaders";
import { GLTFScene } from "../loaders/GLTFLoader-v2";
import { ExtendModel } from "../loaders/ObjLoader";
import { vec3 } from "wgpu-matrix";
import { EnvMap, EnvMapOptions } from "../utils/envmap";

export type Object3D = ExtendModel | GLTFScene;
export class UpdateController {
  update() {}
}

export interface SceneOption {
  realtime?: boolean;
  envMap?: EnvMap;
  envMapOptions?: EnvMapOptions;
}

export class Scene {
  public bindGroupLayout: GPUBindGroupLayout;
  public bindGroup: GPUBindGroup | null = null;
  public cameras: Camera[] = [];
  public mainCamera: Camera | null = null;
  public lights: Light[] = [];
  public buffers: GPUBuffer[] = [];
  public children: Object3D[] = [];
  public updates: UpdateController[] = [];
  public needUpdateBindGroup: boolean = false;
  constructor(public device: GPUDevice, public options?: SceneOption) {
    this.bindGroupLayout = device.createBindGroupLayout({
      entries: [
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
      ],
    });
    this.buffers[0] = device.createBuffer({
      size: Camera.view.arrayBuffer.byteLength,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM,
    });
  }

  add(obj: Object3D | UpdateController | Camera | Light) {
    if (obj instanceof Camera) {
      this.cameras.push(obj);
      this.mainCamera = obj;
    } else if (obj instanceof UpdateController) {
      if (obj instanceof OrbitController) this.add(obj.camera);
      this.updates.push(obj);
    } else if (obj instanceof Light) {
      this.lights.push(obj);
      this.needUpdateBindGroup = true;
    } else {
      this.children.push(obj);
    }
  }

  makeBindGroup() {
    this.buffers[1] = this.device.createBuffer({
      size: Light.elementByteSize * this.lights.length,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.STORAGE,
    });
    return this.device.createBindGroup({
      layout: this.bindGroupLayout,
      entries: this.buffers.map((buffer, binding) => ({
        binding,
        resource: { buffer },
      })),
    });
  }

  setBuffers() {
    Camera.view.set({
      projectionMatrix: this.mainCamera!.matrix,
      viewMatrix: this.mainCamera!.viewMatrix,
      cameraPosition: this.mainCamera!.cameraPosition,
    });
    this.device.queue.writeBuffer(this.buffers[0], 0, Camera.view.arrayBuffer);
    const lightCollectionView = Light.view(this.lights.length);
    lightCollectionView.set(
      this.lights.map((light) => {
        return {
          dir: light.dir ?? vec3.zero(),
          pos: light.pos ?? vec3.zero(),
          color: light.color,
          flux: light.flux,
          ltype: light.type,
        };
      })
    );
    this.device.queue.writeBuffer(
      this.buffers[1],
      0,
      lightCollectionView.arrayBuffer
    );
  }

  render(
    renderPass: GPURenderPassEncoder,
    print?: (record: CreateAndSetRecord) => void
  ) {
    if (!this.mainCamera) return;
    if (!this.bindGroup || this.needUpdateBindGroup) {
      this.bindGroup = this.makeBindGroup();
      this.needUpdateBindGroup = false;
    }
    this.updates.forEach((update) => update.update());
    this.setBuffers();
    renderPass.setBindGroup(0, this.bindGroup);
    this.children.forEach((child) => child.render(renderPass, print));
  }
}
