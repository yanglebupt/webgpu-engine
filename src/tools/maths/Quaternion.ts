import { Quat, quat } from "wgpu-matrix";
import { Euler } from "./Euler";

export class Quaternion {
  elements: Quat;
  constructor(x = 0, y = 0, z = 0, w = 1) {
    this.elements = quat.create(x, y, z, w);
  }
  get x() {
    return this.elements[0];
  }

  set x(v: number) {
    this.elements[0] = v;
    this.onChange();
  }

  get y() {
    return this.elements[1];
  }

  set y(v: number) {
    this.elements[1] = v;
    this.onChange();
  }

  get z() {
    return this.elements[2];
  }

  set z(v: number) {
    this.elements[2] = v;
    this.onChange();
  }

  get w() {
    return this.elements[3];
  }

  set w(v: number) {
    this.elements[3] = v;
    this.onChange();
  }

  setFromEuler(rotation: Euler, update = true) {
    quat.fromEuler(
      rotation.x,
      rotation.y,
      rotation.z,
      rotation.order,
      this.elements
    );
    if (update) this.onChange();
  }

  set(x: number, y: number, z: number, w: number) {
    this.elements[0] = x;
    this.elements[1] = y;
    this.elements[2] = z;
    this.elements[3] = w;

    this.onChange();
  }

  onChange() {}

  *[Symbol.iterator]() {
    yield this.elements[0];
    yield this.elements[1];
    yield this.elements[2];
    yield this.elements[3];
  }
}
