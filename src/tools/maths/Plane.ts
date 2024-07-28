import { Mat4, vec3, Vec3 } from "wgpu-matrix";

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
    // 点在 normal 同侧，距离为正，否则距离为负
    return vec3.dot(this.normal, point) + this.constant;
  }

  copy(plane: Plane) {
    vec3.copy(plane.normal, this.normal);
    this.constant = plane.constant;
    return this;
  }

  makeCopy() {
    return new Plane().copy(this);
  }

  applyMatrix4(matrix: Mat4) {}
}
