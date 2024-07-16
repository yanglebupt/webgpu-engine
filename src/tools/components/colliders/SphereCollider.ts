import { vec3 } from "wgpu-matrix";
import { EntityObject } from "../../entitys/EntityObject";
import { Geometry } from "../../geometrys/Geometry";
import { SphereGeometry } from "../../geometrys/SphereGeometry";
import { Sphere } from "../../maths/Sphere";
import { Mesh } from "../../objects/Mesh";
import { Scene } from "../../scene";
import { Collider } from "./Collider";

export class SphereCollider extends Collider {
  sphere: Sphere;

  constructor(public object: EntityObject) {
    super(object);
    this.sphere = new Sphere();
    const { positions } = Reflect.get(object, "geometry") as Geometry;
    this.sphere.setFromBufferAttribute(positions);
    this.sphere.keepInit();
  }

  updateVisible() {
    if (!this.visibleObject) return;
    const r = this.sphere.radius;
    this.visibleObject.transform.scale = vec3.create(r, r, r);
    this.visibleObject.transform.position = this.sphere.center;
  }

  protected helper(scene: Scene) {
    if (!this.visible) return;
    this.visibleObject = new Mesh(new SphereGeometry(), Collider.material);
    scene.add(this.visibleObject);
  }

  protected update() {
    const tf = this.transform.worldMatrix;
    this.sphere.applyMatrix4(tf);
    super.update();
  }
}
