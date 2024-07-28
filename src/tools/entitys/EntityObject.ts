import { mat4 } from "wgpu-matrix";
import { Transform } from "../components/Transform";
import { EmptyObject } from "./EmptyObject";

export abstract class EntityObject extends EmptyObject {
  transform: Transform;
  instancesTransform: Transform[] = []; // support for instance draw
  parent: Transform | null = null;

  constructor(public instanceCount = 1) {
    super();
    this.transform = new Transform(this);
    Reflect.set(this.components, Transform.name, this.transform);
  }

  updateBuffers(device: GPUDevice) {}

  render(renderPass: GPURenderPassEncoder, device: GPUDevice) {
    if (!this.static) this.updateBuffers(device);
  }

  attachChildren(child: EntityObject) {
    this.transform.update();
    // 不考虑原来的父组件
    child.transform.applyMatrix4(mat4.inverse(this.transform.worldMatrix));
    this.addChildren(child);
  }

  addChildren(child: EntityObject) {
    // 不考虑原来的父组件
    child.parent = this.transform;
    super.addChildren(child);
  }
}
