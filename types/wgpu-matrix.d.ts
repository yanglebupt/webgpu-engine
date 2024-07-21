import { Quat, Mat4, Vec3 } from "wgpu-matrix";
declare module "wgpu-matrix/dist/2.x/mat4-impl" {
  export function fromRotationTranslationScale(
    q: Quat,
    v: Vec3,
    s: Vec3,
    dist?: Mat4
  ): Mat4;
  export function compose(q: Quat, v: Vec3, s: Vec3, dist?: Mat4): Mat4;
  export function decompose(m: Mat4, q: Quat, v: Vec3, s: Vec3): void;
}

declare module "wgpu-matrix/dist/2.x/vec3-impl" {
  export function clampScalar(v: Vec3, min = 0, max = 1, dst?: Vec3): Vec3;
  export function clampEwise(v: Vec3, min: Vec3, max: Vec3, dst?: Vec3): Vec3;
}
