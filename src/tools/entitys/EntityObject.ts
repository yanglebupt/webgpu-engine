import {
  Component,
  ComponentConstructorType,
  EntityObjectComponent,
} from "../components/Component";
import { Transform } from "../components/Transform";
import { BuildOptions, Buildable, Renderable } from "../scene/types";

export function callFunc(
  obj: any,
  name: PropertyKey,
  argumentsList: Readonly<any> = []
) {
  return Reflect.apply(Reflect.get(obj, name), obj, argumentsList);
}

let _objectId = 0;
export abstract class EntityObject
  implements
    Buildable,
    Renderable<(renderPass: GPURenderPassEncoder, device: GPUDevice) => void>
{
  abstract type: string;
  static = false; // 静态对象，不进行响应式，不会执行 update
  active = true; // 不绘制，不会执行生命周期函数
  name: string = "";
  description: string = "";
  id = _objectId++;
  transform: Transform;
  parent: Transform | null = null;
  children: EntityObject[] = [];
  private components: Record<string, Component> = {};
  constructor() {
    this.transform = new Transform(this);
    Reflect.set(this.components, Transform.name, this.transform);
  }

  abstract updateBuffers(device: GPUDevice): void;
  render(renderPass: GPURenderPassEncoder, device: GPUDevice) {
    if (!this.static) this.updateBuffers(device);
  }

  build(options: BuildOptions) {
    this.children.forEach((child) => child.build(options));
  }

  addComponent<C extends ComponentConstructorType>(
    construct: C,
    options?: Partial<InstanceType<C>>
  ) {
    const cpn = Reflect.construct(
      construct,
      construct.prototype instanceof EntityObjectComponent ? [this] : []
    ) as Component;
    Object.assign(cpn, options);
    Reflect.set(this.components, construct.name, cpn);
    if (cpn.active) callFunc(cpn, "awake");
    return cpn as InstanceType<C>;
  }

  removeComponent(construct: ComponentConstructorType) {
    return Reflect.deleteProperty(this.components, construct.name);
  }

  getComponent<C extends ComponentConstructorType>(construct: C) {
    return Reflect.get(this.components, construct.name) as InstanceType<C>;
  }

  addChildren(child: EntityObject) {
    child.parent = this.transform;
    this.children.push(child);
  }

  getChildren(idx: number) {
    return this.children[idx];
  }

  removeChildren() {}

  clearChildren() {}
}
