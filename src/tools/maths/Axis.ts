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
  static readonly up = vec3.create(0, 1, 0);
  static readonly down = vec3.create(0, -1, 0);
  static readonly left = vec3.create(1, 0, 0);
  static readonly right = vec3.create(-1, 0, 0);
  static readonly forward = vec3.create(0, 0, 1);
  static readonly backward = vec3.create(0, 0, -1);
}
