import { EntityObject } from "../../entitys/EntityObject";
import { Geometry } from "../../geometrys/Geometry";
import { BufferGeometry } from "../../geometrys/BufferGeometry";
import { Scene } from "../../scene";
import { Line } from "../../objects/Line";
import { Box3 } from "../../maths/Box3";
import { Collider } from "./Collider";

// AABB 轴对齐包围盒
export class Box3Collider extends Collider<Box3> {
  collisionPrimitive: Box3;

  constructor(public object: EntityObject) {
    super(object);
    const { positions } = Reflect.get(object, "geometry") as Geometry;
    this.collisionPrimitive = new Box3();
    this.collisionPrimitive.setFromBufferAttribute(positions);
    this.collisionPrimitive.keepInit();
  }

  updateVisible() {
    if (!this.visibleObject) return;
    // 由于是轴对齐，因此只需要设置 position 和 scale，注意不需要重新计算顶点
    this.collisionPrimitive.getCenter(this.visibleObject.transform.position);
    this.collisionPrimitive.getHalfSize(this.visibleObject.transform.scale);
  }

  protected helper(scene: Scene) {
    if (!this.visible || this.collisionPrimitive.isEmpty()) return;

    this.visibleObject = new Line(
      new BufferGeometry({
        vertices: Box3.getBoundaryFlattenPoints([-1, -1, -1], [1, 1, 1]),
        indices: [
          0, 1, 1, 3, 3, 2, 2, 0, 4, 5, 5, 7, 7, 6, 6, 4, 1, 5, 3, 7, 0, 4, 2,
          6,
        ],
      }),
      Collider.material
    );
    scene.add(this.visibleObject);
  }

  protected update() {
    this.collisionPrimitive.applyMatrix4(this.transform.worldMatrix);
    super.update();
  }
}
