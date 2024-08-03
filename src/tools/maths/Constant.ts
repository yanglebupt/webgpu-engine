import { vec3 } from "wgpu-matrix";

export const gravity = vec3.create(0, -9.8, 0);
export const EPSILON = 1e-4;
