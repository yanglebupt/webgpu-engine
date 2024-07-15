// import { Vec3 } from "wgpu-matrix";
// import { EntityObject } from "../../entitys/EntityObject";
// import { Geometry } from "../../geometrys/Geometry";
// import { EntityObjectComponent } from "../Component";

// export class SphereCollider extends EntityObjectComponent {
//   visible = false;
//   center: Vec3;
//   radius: number;
//   constructor(public object: EntityObject) {
//     super(object);
//     const geometry = Reflect.get(object, "geometry") as Geometry;
//     if (!geometry) {
//       throw new Error("Can not add collider to an object without geometry!!");
//     }
//   }
// }
