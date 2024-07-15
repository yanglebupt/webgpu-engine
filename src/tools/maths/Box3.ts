import { mat3, mat4, Mat4, vec3, Vec3 } from "wgpu-matrix";
import { BufferAttribute } from "../geometrys/Geometry";

const _vector = vec3.create();
const _m = mat3.create();

export class Box3Data {
  constructor(
    public min: Vec3 = vec3.create(+Infinity, +Infinity, +Infinity),
    public max: Vec3 = vec3.create(-Infinity, -Infinity, -Infinity)
  ) {}
}

export class Box3 extends Box3Data {
  init?: Box3Data;
  constructor(min?: Vec3, max?: Vec3) {
    super(min, max);
  }

  static getBoundaryFlattenPoints(min: Vec3 | number[], max: Vec3 | number[]) {
    return [
      min[0],
      min[1],
      min[2],
      min[0],
      max[1],
      min[2],
      max[0],
      min[1],
      min[2],
      max[0],
      max[1],
      min[2],
      min[0],
      min[1],
      max[2],
      min[0],
      max[1],
      max[2],
      max[0],
      min[1],
      max[2],
      max[0],
      max[1],
      max[2],
    ];
  }

  keepInit() {
    this.init = new Box3Data(vec3.copy(this.min), vec3.copy(this.max));
  }

  getCenter(vector: Vec3) {
    vec3.midpoint(this.min, this.max, vector);
  }

  getSize(vector: Vec3) {
    vec3.sub(this.max, this.min, vector);
  }

  getHalfSize(vector: Vec3) {
    vec3.sub(this.max, this.min, vector);
    vec3.mulScalar(vector, 0.5, vector);
  }

  setFromBufferAttribute(positions: BufferAttribute<Float32Array>) {
    for (let i = 0, n = positions.count; i < n; i++) {
      const pos = positions.get(i);
      this.expandByPoint(vec3.set(pos[0], pos[1], pos[2], _vector));
    }
  }

  setFromPoints(points: Vec3[]) {
    this.makeEmpty();

    for (const pos of points) {
      this.expandByPoint(pos);
    }
  }

  isEmpty() {
    return (
      this.max[0] < this.min[0] ||
      this.max[1] < this.min[1] ||
      this.max[2] < this.min[2]
    );
  }

  makeEmpty() {
    vec3.set(+Infinity, +Infinity, +Infinity, this.min);
    vec3.set(-Infinity, -Infinity, -Infinity, this.max);
  }

  expandByPoint(pos: Vec3) {
    vec3.max(this.max, pos, this.max);
    vec3.min(this.min, pos, this.min);
  }

  expandByVector(vec: Vec3) {
    vec3.add(this.max, vec, this.max);
    vec3.sub(this.min, vec, this.min);
  }

  expandByScalar(scalar: number) {
    this.max[0] += scalar;
    this.max[1] += scalar;
    this.max[2] += scalar;

    this.min[0] -= scalar;
    this.min[1] -= scalar;
    this.min[2] -= scalar;
  }

  union(box: Box3) {
    vec3.max(this.max, box.max, this.max);
    vec3.min(this.min, box.min, this.min);
  }

  applyMatrix4(matrix: Mat4) {
    if (this.isEmpty()) return;
    /*
      this.updateBoundaryPoints();
      
      注意这里不能重新从 min 和 max 中计算边界点 ！！！
      例如我们是对原物体进行旋转，在这里等价于对 box 的 8 个边界点进行旋转，也就是对 box 旋转
      然后重新计算 min 和 max。但是下一次旋转时，仍然要用之前的边界点，不能通过更新后的 min 和 max 重新计算边界点，
      因为重新计算后的边界点会往外偏移，对其旋转，相当于对更新后的 min 和 max 组成的 box 进行旋转，而非一开始的 box 了
      这样一直循环下去，会导致 box 越来越大
    */

    /* 
      对 8 个边界点进行物体变换，重新计算 min 和 max
      缺点: 需要记录 8 个点，8次矩阵-向量乘法
    */
    // this.makeEmpty();
    // for (let i = 0; i < 8; i++) {
    //   const pnt = this.points[i];
    //   vec3.transformMat4(pnt, matrix, pnt);
    //   this.expandByPoint(pnt);
    // }

    // https://x.com/Herschel/status/1188613724665335808/photo/2
    // https://www.realtimerendering.com/resources/GraphicsGems/gems/TransBox.c

    mat3.fromMat4(matrix, _m);
    mat4.getTranslation(matrix, _vector);
    const oriBox = this.init ?? this;
    const _min = oriBox.min;
    const _max = oriBox.max;

    /* Now find the extreme points by considering the product of the */
    /* min and max with each component of M.  */

    for (let i = 0; i < 3; i++) {
      this.min[i] = this.max[i] = _vector[i];
      for (let j = 0; j < 3; j++) {
        const a = _m[i + j * 4] * _min[j];
        const b = _m[i + j * 4] * _max[j];
        if (a < b) {
          this.min[i] += a;
          this.max[i] += b;
        } else {
          this.min[i] += b;
          this.max[i] += a;
        }
      }
    }
    /*
      但是物体变换，一定会导致 box 变化吗 ??  显然不一定, 例如球旋转
      如果此时将变换作用到 box 则会导致出现很多空隙，此时需要用其他例如 SphereCollider
    */
  }
}
