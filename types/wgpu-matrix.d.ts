import { Quat, Mat4, Vec3 } from "wgpu-matrix";
declare module "wgpu-matrix/dist/2.x/mat4-impl" {
  export function fromRotationTranslationScale(
    q: Quat,
    v: Vec3,
    s: Vec3,
    dist?: Mat4
  ): Mat4;
}
