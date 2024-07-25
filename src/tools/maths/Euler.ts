import { Mat4, Vec3, vec3 } from "wgpu-matrix";
import { RotationOrder } from "wgpu-matrix/dist/2.x/quat-impl";
import { clamp } from "../math";
import { Axis } from "./Axis";

export class Euler {
  elements: Vec3;

  constructor(x = 0, y = 0, z = 0, public order: RotationOrder = "xyz") {
    this.elements = vec3.create(x, y, z);
  }

  // proxy for elements make sure can call onChange
  get [Axis.X]() {
    return this.elements[0];
  }

  set [Axis.X](v: number) {
    this.elements[0] = v;
    this.onChange();
  }

  get [Axis.Y]() {
    return this.elements[1];
  }

  set [Axis.Y](v: number) {
    this.elements[1] = v;
    this.onChange();
  }

  get [Axis.Z]() {
    return this.elements[2];
  }

  set [Axis.Z](v: number) {
    this.elements[2] = v;
    this.onChange();
  }

  setFromRotationMatrix(m: Mat4, order = this.order, update = true) {
    // assumes the upper 3x3 of m is a pure rotation matrix (i.e, unscaled)
    const m11 = m[0],
      m12 = m[4],
      m13 = m[8];
    const m21 = m[1],
      m22 = m[5],
      m23 = m[9];
    const m31 = m[2],
      m32 = m[6],
      m33 = m[10];

    switch (order) {
      case "xyz":
        this.elements[1] = Math.asin(clamp(m13, -1, 1));

        if (Math.abs(m13) < 0.9999999) {
          this.elements[0] = Math.atan2(-m23, m33);
          this.elements[2] = Math.atan2(-m12, m11);
        } else {
          this.elements[0] = Math.atan2(m32, m22);
          this.elements[2] = 0;
        }

        break;

      case "yxz":
        this.elements[0] = Math.asin(-clamp(m23, -1, 1));

        if (Math.abs(m23) < 0.9999999) {
          this.elements[1] = Math.atan2(m13, m33);
          this.elements[2] = Math.atan2(m21, m22);
        } else {
          this.elements[1] = Math.atan2(-m31, m11);
          this.elements[2] = 0;
        }

        break;

      case "zxy":
        this.elements[0] = Math.asin(clamp(m32, -1, 1));

        if (Math.abs(m32) < 0.9999999) {
          this.elements[1] = Math.atan2(-m31, m33);
          this.elements[2] = Math.atan2(-m12, m22);
        } else {
          this.elements[1] = 0;
          this.elements[2] = Math.atan2(m21, m11);
        }

        break;

      case "zyx":
        this.elements[1] = Math.asin(-clamp(m31, -1, 1));

        if (Math.abs(m31) < 0.9999999) {
          this.elements[0] = Math.atan2(m32, m33);
          this.elements[2] = Math.atan2(m21, m11);
        } else {
          this.elements[0] = 0;
          this.elements[2] = Math.atan2(-m12, m22);
        }

        break;

      case "yzx":
        this.elements[2] = Math.asin(clamp(m21, -1, 1));

        if (Math.abs(m21) < 0.9999999) {
          this.elements[0] = Math.atan2(-m23, m22);
          this.elements[1] = Math.atan2(-m31, m11);
        } else {
          this.elements[0] = 0;
          this.elements[1] = Math.atan2(m13, m33);
        }

        break;

      case "xzy":
        this.elements[2] = Math.asin(-clamp(m12, -1, 1));

        if (Math.abs(m12) < 0.9999999) {
          this.elements[0] = Math.atan2(m32, m22);
          this.elements[1] = Math.atan2(m13, m11);
        } else {
          this.elements[0] = Math.atan2(-m23, m33);
          this.elements[1] = 0;
        }

        break;

      default:
        console.warn(
          "THREE.Euler: .setFromRotationMatrix() encountered an unknown order: " +
            order
        );
    }

    this.order = order;

    if (update === true) this.onChange();

    return this;
  }

  set(x: number, y: number, z: number, order = this.order) {
    this.elements[0] = x;
    this.elements[1] = y;
    this.elements[2] = z;

    this.order = order;

    this.onChange();
  }

  onChange() {}

  *[Symbol.iterator]() {
    yield this.elements[0];
    yield this.elements[1];
    yield this.elements[2];
  }
}
