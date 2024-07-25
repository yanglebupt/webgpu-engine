import {
  Component,
  ComponentConstructorType,
  EntityObjectComponent,
} from "../components/Component";
import { BuildOptions, Buildable, Renderable } from "../scene/types";

export function callFunc(
  obj: any,
  name: PropertyKey,
  argumentsList: Readonly<any> = []
) {
  return Reflect.apply(Reflect.get(obj, name), obj, argumentsList);
}

let _objectId = 0;

type EmptyObjectConstructorType = new (...argumentsList: any[]) => EmptyObject;

export abstract class EmptyObject
  implements
    Buildable,
    Renderable<(renderPass: GPURenderPassEncoder, device: GPUDevice) => void>
{
  abstract type: string;
  private __static = false; // 静态对象，不进行响应式，不会执行 update
  active = true; // 不绘制，不会执行生命周期函数
  name: string = "";
  description: string = "";
  id = _objectId++;
  children: EmptyObject[] = [];
  protected components: Record<string, Component> = {};

  get static() {
    return this.__static;
  }

  set static(__static: boolean) {
    this.__static = __static;
  }

  abstract render(renderPass: GPURenderPassEncoder, device: GPUDevice): void;

  build(options: BuildOptions) {
    this.children.forEach((child) => child.build(options));
  }

  addChildren(child: EmptyObject) {
    this.children.push(child);
  }

  getChildrenByIndex(idx: number) {
    return this.children[idx];
  }

  getChildrenByType<C extends EmptyObjectConstructorType>(construct: C) {
    return this.children.filter(
      (child) => child.constructor.name == construct.name
    ) as InstanceType<C>[];
  }

  getFirstChildByType<C extends EmptyObjectConstructorType>(construct: C) {
    return this.getChildrenByType(construct)[0] as InstanceType<C>;
  }

  removeChildren() {}

  clearChildren() {}

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

  destroy() {
    this.children.forEach((child) => child.destroy());
  }
}
