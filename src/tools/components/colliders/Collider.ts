import { EntityObject } from "../../entitys/EntityObject";
import { Geometry } from "../../geometrys/Geometry";
import { Object3D } from "../../objects/Object3D";
import { EntityObjectComponent } from "../Component";

export abstract class Collider extends EntityObjectComponent {
  visible = false;
  protected visibleObject: Object3D | null = null;

  constructor(public object: EntityObject) {
    super(object);
    const geometry = Reflect.get(object, "geometry") as Geometry;
    if (!geometry) {
      throw new Error("Can not add collider to an object without geometry!!");
    }
  }

  abstract updateVisible(): void;

  protected update() {
    if (this.visible) this.updateVisible(); // 更新可视化碰撞体边框
  }
}
