import { vec3, Vec3 } from "wgpu-matrix";

export class PlaneData {
  constructor(
    public normal: Vec3 = vec3.create(0, 1, 0),
    public constant: number = 0
  ) {}
}

// 全屏幕，有限制的平面就是 box 了
export class Plane extends PlaneData {
  constructor(normal?: Vec3, constant?: number) {
    super(normal, constant);
  }

  distanceToPoint(point: Vec3) {
    return vec3.dot(this.normal, point) + this.constant;
  }
}
