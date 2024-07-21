import { EntityObject } from "../../entitys/EntityObject";
import { Geometry } from "../../geometrys/Geometry";
import { Object3D } from "../../objects/Object3D";
import { EntityObjectComponent } from "../Component";
import { MeshBasicMaterial } from "../../materials/MeshBasicMaterial";
import { Scene } from "../../scene";

// 所有的 Collider 可以共用一个 material
export abstract class Collider<T> extends EntityObjectComponent {
  static material: MeshBasicMaterial;
  static {
    Collider.material = new MeshBasicMaterial({
      color: [1, 1, 0, 1],
      wireframe: true,
    });
  }
  visible = false;
  // color: Vec4 = [1, 1, 0, 1];
  protected visibleObject: Object3D | null = null;
  abstract collisionPrimitive: T;

  constructor(public object: EntityObject) {
    super(object);
    const geometry = Reflect.get(object, "geometry") as Geometry;
    if (!geometry) {
      throw new Error("Can not add collider to an object without geometry!!");
    }
  }

  // protected start() {
  //   this.material.color = this.color;
  //   this.material.onChange();
  // }

  protected abstract helper(scene: Scene): void;

  abstract updateVisible(): void;

  protected update() {
    if (this.visible) this.updateVisible(); // 更新可视化碰撞体边框
  }
}
