import { vec3 } from "wgpu-matrix";
import { EntityObject } from "../../entitys/EntityObject";
import { Geometry } from "../../geometrys/Geometry";
import { SphereGeometry } from "../../geometrys/SphereGeometry";
import { Sphere } from "../../maths/Sphere";
import { Mesh } from "../../objects/Mesh";
import { Scene } from "../../scene";
import { Collider } from "./Collider";

export class SphereCollider extends Collider<Sphere> {
  collisionPrimitive: Sphere;

  constructor(public object: EntityObject) {
    super(object);
    const { positions } = Reflect.get(object, "geometry") as Geometry;
    this.collisionPrimitive = new Sphere();
    this.collisionPrimitive.setFromBufferAttribute(positions);
    this.collisionPrimitive.keepInit();
  }

  updateVisible() {
    if (!this.visibleObject) return;
    const r = this.collisionPrimitive.radius;
    this.visibleObject.transform.scale = vec3.create(r, r, r);
    this.visibleObject.transform.position = this.collisionPrimitive.center;
  }

  protected helper(scene: Scene) {
    if (!this.visible) return;
    this.visibleObject = new Mesh(new SphereGeometry(), Collider.material);
    scene.add(this.visibleObject);
  }

  protected update() {
    this.collisionPrimitive.applyMatrix4(this.transform.worldMatrix);
    super.update();
  }
}
