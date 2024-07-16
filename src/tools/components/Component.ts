import { EntityObject } from "../entitys/EntityObject";
import { Scene } from "../scene";
import { Transform } from "./Transform";

type ComponentConstructor = new () => Component;
// 与 build 无关，最简单的抽象，具体的 build 逻辑由 EntityObject 去写
export abstract class Component {
  private __active = true;
  protected isStarted = false;
  /* 实例化后立刻调用 */
  protected awake() {}
  /* 第一次帧更新之前调用 Start，在为任何脚本调用 Update 等函数之前，将在所有脚本上调用 Start 函数 */
  protected start() {}
  protected update(dt: number, t: number) {}
  protected enable() {}
  protected disable() {}
  protected helper(
    scene: Scene
  ) {} /* start 之后调用，方便为场景添加辅助对象，生成环境关闭 */

  get active() {
    return this.__active;
  }

  set active(active: boolean) {
    if (active !== this.__active) return;
    this.__active = active;
    active ? this.enable() : this.disable();
  }
}

type EntityObjectComponentConstructor<O extends EntityObject> = new (
  object: O
) => EntityObjectComponent<O>;

export abstract class EntityObjectComponent<
  O extends EntityObject = EntityObject
> extends Component {
  public transform: Transform;
  constructor(public object: O) {
    super();
    this.transform = object.transform;
  }
}

export type ComponentConstructorType<O extends EntityObject = any> =
  | ComponentConstructor
  | EntityObjectComponentConstructor<O>;
