import { Mat4, vec3, Vec3 } from "wgpu-matrix";

const _vector = vec3.create();

export class Ray {
  constructor(
    public origin: Vec3 = vec3.create(),
    public direction: Vec3 = vec3.create(0, 0, 1)
  ) {}

  // 从原点出发，经过某个点
  passPoint(end: Vec3) {
    vec3.sub(end, this.origin, _vector);
    vec3.normalize(_vector, this.direction);
  }

  // 射线前进 t 长度的点
  at(t: number, target: Vec3) {
    vec3.addScaled(this.origin, this.direction, t, target);
    return target;
  }

  /* 
    点到射线的最短距离，注意
      - 如果射线在起点后面，则最短距离就是点到射线起点的距离
      - 否则最短距离就是点到该线的垂直距离
  */
  distanceSqToPoint(point: Vec3) {
    vec3.sub(point, this.origin, _vector);
    const p = vec3.dot(_vector, this.direction); // _vector 在射线上的投影长度
    if (p < 0) return vec3.distanceSq(point, this.origin);
    this.at(p, _vector);
    return vec3.distanceSq(point, _vector);
  }

  applyMatrix4(matrix: Mat4) {
    vec3.transformMat4(this.origin, matrix, this.origin);
    vec3.transformMat4Upper3x3(this.direction, matrix, this.direction);
    vec3.normalize(this.direction, this.direction);
  }

  copy(ray: Ray) {
    vec3.copy(ray.origin, this.origin);
    vec3.copy(ray.direction, this.direction);
    return this;
  }

  makeCopy() {
    return new Ray().copy(this);
  }
}
