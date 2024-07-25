import { EntityObject } from "../../entitys/EntityObject";
import { Geometry } from "../../geometrys/Geometry";
import { BufferGeometry } from "../../geometrys/BufferGeometry";
import { Scene } from "../../scene";
import { Line } from "../../objects/Line";
import { Box3 } from "../../maths/Box3";
import { OBB } from "../../maths/OBB";
import { Collider } from "./Collider";

const _box3 = new Box3();

// OBB 包围盒
export class OBBCollider extends Collider<OBB> {
  collisionPrimitive: OBB;

  constructor(public object: EntityObject) {
    super(object);
    const { positions } = Reflect.get(object, "geometry") as Geometry;
    this.collisionPrimitive = new OBB();
    _box3.setFromBufferAttribute(positions);
    this.collisionPrimitive.fromBox3(_box3);
    this.collisionPrimitive.keepInit();
  }

  updateVisible() {
    if (!this.visibleObject) return;
    this.visibleObject.transform.scale = this.collisionPrimitive.halfSize;
    this.visibleObject.transform.setRotationFromMatrix(
      this.collisionPrimitive.rotation
    );
    this.visibleObject.transform.position = this.collisionPrimitive.center;
  }

  // same as Box3Collider
  protected helper(scene: Scene) {
    if (!this.visible) return;
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
}
