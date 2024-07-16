import { Mat4, vec3, Vec3 } from "wgpu-matrix";
import { Box3 } from "./Box3";
import { BufferAttribute } from "../geometrys/Geometry";

const _v = vec3.create();
const _box3 = new Box3();

export class SphereData {
  constructor(
    public center: Vec3 = vec3.create(),
    public radius: number = -1
  ) {}
}

export class Sphere extends SphereData {
  init?: SphereData;
  constructor(center?: Vec3, radius?: number) {
    super(center, radius);
  }

  keepInit() {
    this.init = new SphereData(vec3.copy(this.center), this.radius);
  }

  fromBox3(box3: Box3) {
    box3.getCenter(this.center);
    box3.getHalfSize(_v);
    /* 
      用 box3 的 half size 作为半径，此时为外切圆，不准确，因为大多数情况都是内切圆
      因此这个时候还需要引入一次遍历全部点，然后计算点到中心的距离，取最大
    */
    this.radius = vec3.length(_v);
  }

  setFromBufferAttribute(positions: BufferAttribute<Float32Array>) {
    this.makeEmpty();

    const center = this.center;

    _box3.setFromBufferAttribute(positions);
    _box3.getCenter(center);

    let radius = 0;
    for (let i = 0, n = positions.count; i < n; i++) {
      const pos = positions.get(i);
      radius = Math.max(radius, vec3.distance(pos, center));
    }

    this.radius = radius;
  }

  setFromPoints(points: Vec3[]) {
    this.makeEmpty();

    const center = this.center;

    _box3.setFromPoints(points);
    _box3.getCenter(center);

    let radius = 0;
    for (const pos of points) {
      radius = Math.max(radius, vec3.distance(pos, center));
    }

    this.radius = radius;
  }

  makeEmpty() {
    this.center = vec3.create();
    this.radius = -1;
  }

  isEmpty() {
    return this.radius < 0;
  }

  // Welzl 算法是一种随机增量算法，它通过递归地选择点来构建最小包围球
  expandByPoint(pos: Vec3) {
    if (this.isEmpty()) {
      vec3.copy(pos, this.center);
      this.radius = 0;
    }

    // 新加的点到圆心的距离
    vec3.sub(pos, this.center, _v);
    const len = vec3.length(_v);
    if (len > this.radius) {
      const delta = 0.5 * (len - this.radius); // 需要平移多出距离的一般
      vec3.addScaled(this.center, _v, delta / len, this.center);
      this.radius += delta;
    }
  }

  applyMatrix4(matrix: Mat4) {
    const ori = this.init ?? this;
    vec3.transformMat4(ori.center, matrix, this.center);
    vec3.getScaling(matrix, _v);
    this.radius = ori.radius * Math.max(..._v);
  }
}
