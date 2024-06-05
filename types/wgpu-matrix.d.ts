import Mat4 from "wgpu-matrix/dist/2.x/mat4-impl";
declare module "wgpu-matrix/dist/2.x/mat4-impl" {
  export function fromRotationTranslationScale(
    q: number[],
    v: number[],
    s: number[],
    dist?: Mat4
  ): Mat4;
}
