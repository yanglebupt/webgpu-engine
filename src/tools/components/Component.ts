import { EntityObject } from "../entitys/EntityObject";
import { Transform } from "./Transform";

type ComponentConstructor = new () => Component;
// 与 build 无关，最简单的抽象，具体的 build 逻辑由 EntityObject 去写
export abstract class Component {
  transform!: Transform;
  isStarted = false;
  /* 实例化后立刻调用 */
  awake() {}
  /* 第一次帧更新之前调用 Start，在为任何脚本调用 Update 等函数之前，将在所有脚本上调用 Start 函数 */
  start() {}
  update(dt: number, t: number) {}
}

type EntityObjectComponentConstructor<
  P extends Object,
  O extends EntityObject
> = new (object: O, options?: Partial<P>) => EntityObjectComponent<P, O>;

export abstract class EntityObjectComponent<
  P extends Object = {},
  O extends EntityObject = EntityObject
> extends Component {
  constructor(public object: O, options?: Partial<P>) {
    super();
  }
}

export type ComponentConstructorType<
  P extends Object = any,
  O extends EntityObject = any
> = ComponentConstructor | EntityObjectComponentConstructor<P, O>;
