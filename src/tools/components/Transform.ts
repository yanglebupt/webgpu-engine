import { Mat3, Mat4, Quat, Vec3, mat4, quat, vec3 } from "wgpu-matrix";
import { EntityObjectComponent } from "./Component";
import { Euler } from "../maths/Euler";
import { Quaternion } from "../maths/Quaternion";
import { EntityObject } from "../entitys/EntityObject";

const _q1 = quat.create();
const _v1 = vec3.create();
const _xAxis = vec3.create(1, 0, 0);
const _yAxis = vec3.create(0, 1, 0);
const _zAxis = vec3.create(0, 0, 1);
const _matrix = mat4.create();

export class Transform extends EntityObjectComponent {
  position: Vec3 = vec3.zero();
  // quaternion 和 rotation 要同步
  rotation: Euler = new Euler();
  quaternion: Quaternion = new Quaternion();
  scale: Vec3 = vec3.create(1, 1, 1);
  matrix: Mat4 = mat4.identity();
  worldMatrix: Mat4 = mat4.identity();
  worldNormalMatrix: Mat4 = mat4.identity();

  constructor(public object: EntityObject) {
    super(object);
    this.quaternion.onChange = () => {
      mat4.fromQuat(this.quaternion.elements, _matrix);
      this.rotation.setFromRotationMatrix(_matrix, this.rotation.order, false);
    };

    this.rotation.onChange = () =>
      this.quaternion.setFromEuler(this.rotation, false);

    this.updateWorldMatrix();
  }

  applyMatrix4(matrix: Mat4, updateWorldMatrix: boolean = false) {
    mat4.multiply(matrix, this.matrix, this.matrix);

    mat4.decompose(
      this.matrix,
      this.quaternion.elements,
      this.position,
      this.scale
    );

    if (updateWorldMatrix) this.updateWorldMatrix();

    return this;
  }

  applyQuaternion(q: Quat) {
    quat.multiply(q, this.quaternion.elements, this.quaternion.elements);

    return this;
  }

  setRotationFromAxisAngle(axis: Vec3, angle: number) {
    // assumes axis is normalized
    quat.fromAxisAngle(axis, angle, this.quaternion.elements);

    return this;
  }

  setRotationFromEuler(euler: Euler) {
    quat.fromEuler(
      euler.x,
      euler.y,
      euler.z,
      euler.order,
      this.quaternion.elements
    );

    return this;
  }

  setRotationFromMatrix(m: Mat3 | Mat4) {
    // assumes the upper 3x3 of m is a pure rotation matrix (i.e, unscaled)

    quat.fromMat(m, this.quaternion.elements);

    return this;
  }

  setRotationFromQuaternion(q: Quat) {
    // assumes q is normalized
    quat.copy(q, this.quaternion.elements);

    return this;
  }

  rotateOnAxis(axis: Vec3, angle: number) {
    // rotate object on axis in object space
    // axis is assumed to be normalized

    quat.fromAxisAngle(axis, angle, _q1);

    return this.applyQuaternion(_q1);
  }

  rotateX(angle: number) {
    return this.rotateOnAxis(_xAxis, angle);
  }

  rotateY(angle: number) {
    return this.rotateOnAxis(_yAxis, angle);
  }

  rotateZ(angle: number) {
    return this.rotateOnAxis(_zAxis, angle);
  }

  translateOnAxis(axis: Vec3, distance: number) {
    // translate object by distance along axis in object space
    // axis is assumed to be normalized

    vec3.copy(axis, _v1);
    vec3.transformQuat(_v1, this.quaternion.elements, _v1);
    vec3.mulScalar(_v1, distance, _v1);
    vec3.add(this.position, _v1, this.position);

    return this;
  }

  translateX(distance: number) {
    return this.translateOnAxis(_xAxis, distance);
  }

  translateY(distance: number) {
    return this.translateOnAxis(_yAxis, distance);
  }

  translateZ(distance: number) {
    return this.translateOnAxis(_zAxis, distance);
  }

  update() {
    mat4.fromRotationTranslationScale(
      this.quaternion.elements,
      this.position,
      this.scale,
      this.matrix
    );
    this.updateWorldMatrix();
  }

  updateWorldMatrix() {
    const parent = this.object.parent?.matrix;
    parent
      ? mat4.multiply(parent, this.matrix, this.worldMatrix)
      : mat4.copy(this.matrix, this.worldMatrix);
    mat4.inverse(this.worldMatrix, _matrix);
    mat4.transpose(_matrix, this.worldNormalMatrix);
  }
}
