import { Vec3 } from "wgpu-matrix";

export class Ray {
  constructor(public origin: Vec3, public direction: Vec3) {}
}
