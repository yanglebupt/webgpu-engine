import { Quat, quat } from "wgpu-matrix";
import { Euler } from "./Euler";
import { Axis } from "./Axis";

export class Quaternion {
  elements: Quat;

  constructor(x = 0, y = 0, z = 0, w = 1) {
    this.elements = quat.create(x, y, z, w);
  }

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

  get [Axis.W]() {
    return this.elements[3];
  }

  set [Axis.W](v: number) {
    this.elements[3] = v;
    this.onChange();
  }

  setFromEuler(rotation: Euler, update = true) {
    quat.fromEuler(
      rotation[0],
      rotation[1],
      rotation[2],
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
