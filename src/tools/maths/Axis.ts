import { vec3 } from "wgpu-matrix";

export enum Space {
  Local,
  World,
}

export enum Axis {
  X = 0,
  Y = 1,
  Z = 2,
  W = 3,
}

export class Direction {
  static up = vec3.create(0, 1, 0);
  static down = vec3.create(0, -1, 0);
  static left = vec3.create(1, 0, 0);
  static right = vec3.create(-1, 0, 0);
  static forward = vec3.create(0, 0, 1);
  static backward = vec3.create(0, 0, -1);
}
