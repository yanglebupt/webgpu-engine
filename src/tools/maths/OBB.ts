import { Mat3, mat3, mat4, Mat4, quat, vec3, Vec3 } from "wgpu-matrix";
import { Box3 } from "./Box3";
import { clamp } from "../math";

const _v1 = vec3.create();
const _v2 = vec3.create();

const xAxis = vec3.create();
const yAxis = vec3.create();
const zAxis = vec3.create();

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

  copy(obb: OBB) {
    vec3.copy(obb.center, this.center);
    vec3.copy(obb.halfSize, this.halfSize);
    mat3.copy(obb.rotation, this.rotation);
    return this;
  }

  makeCopy() {
    return new OBB().copy(this);
  }

  extractBasis(xAxis: Vec3, yAxis: Vec3, zAxis: Vec3) {
    vec3.getAxis(this.rotation, 0, xAxis);
    vec3.getAxis(this.rotation, 1, yAxis);
    vec3.getAxis(this.rotation, 2, zAxis);
  }
  /**
   * Reference: Closest Point on OBB to Point in Real-Time Collision Detection
   * by Christer Ericson (chapter 5.1.4)
   */
  clampPoint(point: Vec3, target: Vec3) {
    // find the closest to point, then write to target
    const halfSize = this.halfSize;
    this.extractBasis(xAxis, yAxis, zAxis);
    vec3.sub(point, this.center, _v1);

    // start at the center position of the OBB

    vec3.copy(this.center, target);

    // project the target onto the OBB axes and walk towards that point

    const x = clamp(vec3.dot(_v1, xAxis), -halfSize[0], halfSize[0]);
    vec3.addScaled(target, xAxis, x, target);

    const y = clamp(vec3.dot(_v1, yAxis), -halfSize[1], halfSize[1]);
    vec3.addScaled(target, yAxis, y, target);

    const z = clamp(vec3.dot(_v1, zAxis), -halfSize[2], halfSize[2]);
    vec3.addScaled(target, zAxis, z, target);
  }
}
