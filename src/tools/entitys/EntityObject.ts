import {
  Component,
  ComponentConstructorType,
  EntityObjectComponent,
} from "../components/Component";
import { Transform } from "../components/Transform";

export abstract class EntityObject {
  abstract name: string;
  description: string = "";
  transform: Transform;
  private components: Record<string, Component> = {};
  constructor() {
    this.transform = new Transform();
    Reflect.set(this.components, Transform.name, this.transform);
  }

  addComponent<C extends ComponentConstructorType, P extends Object = {}>(
    construct: C,
    options?: Partial<P>
  ) {
    const cpn = Reflect.construct(
      construct,
      construct.prototype instanceof EntityObjectComponent
        ? [this, options]
        : []
    ) as Component;
    cpn.awake();
    cpn.transform = this.transform;
    Reflect.set(this.components, construct.name, cpn);
    return cpn as InstanceType<C>;
  }

  removeComponent(construct: ComponentConstructorType) {
    return Reflect.deleteProperty(this.components, construct.name);
  }

  getComponent<C extends ComponentConstructorType>(construct: C) {
    return Reflect.get(this.components, construct.name) as InstanceType<C>;
  }
}
