import { Mat3, mat3, mat4, Mat4, quat, vec3, Vec3 } from "wgpu-matrix";
import { Box3 } from "./Box3";

const _v1 = vec3.create();
const _v2 = vec3.create();
const _m = mat3.create();
const _q = quat.create();

export class OBBData {
  constructor(
    public center: Vec3 = vec3.create(),
    public halfSize: Vec3 = vec3.create(),
    public rotation: Mat3 = mat3.create()
  ) {}
}

export class OBB extends OBBData {
  init?: OBBData;
  constructor(center?: Vec3, halfSize?: Vec3, rotation?: Mat3) {
    super(center, halfSize, rotation);
  }

  keepInit() {
    this.init = new OBBData(
      vec3.copy(this.center),
      vec3.copy(this.halfSize),
      mat3.copy(this.rotation)
    );
  }

  getSize(vector: Vec3) {
    vec3.mulScalar(this.halfSize, 2.0, vector);
  }

  fromBox3(box3: Box3) {
    box3.getCenter(this.center);
    box3.getHalfSize(this.halfSize);
    mat3.identity(this.rotation);
  }

  applyMatrix4(matrix: Mat4) {
    const ori = this.init ?? this;
    mat4.decompose(matrix, _q, _v1, _v2);
    mat3.fromQuat(_q, _m);
    vec3.add(_v1, ori.center, this.center);
    vec3.mul(_v2, ori.halfSize, this.halfSize);
    mat3.multiply(_m, ori.rotation, this.rotation);
  }
}
