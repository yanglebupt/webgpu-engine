import { TypedArray } from "webgpu-utils";

export function rand(min?: number, max?: number) {
  if (min === undefined) {
    min = 0;
    max = 1;
  } else if (max === undefined) {
    max = min;
    min = 0;
  }
  return min + Math.random() * (max - min);
}

export function normalize(vec: number[]) {
  const len = vec.reduce((p, c) => p + c, 0);
  return vec.map((v) => v / len);
}

export const xyzObj2Array = (obj: { x: number; y: number; z: number }) => [
  obj.x,
  obj.y,
  obj.z,
];

export const arrayProd = (arr: number[]) =>
  arr.reduce((a: number, b: number) => a * b);

export const degToRad = (d: number) => (d * Math.PI) / 180;
export function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}
export function mix(
  a: number[] | TypedArray,
  b: number[] | TypedArray,
  t: number
) {
  return a.map((v: number, i: number) => lerp(v, b[i], t));
}
export function max(a: number[] | TypedArray, b: number[] | TypedArray) {
  return a.map((v: number, i: number) => Math.max(v, b[i]));
}
export function min(a: number[] | TypedArray, b: number[] | TypedArray) {
  return a.map((v: number, i: number) => Math.min(v, b[i]));
}
export const smoothFn = (t: number) => 3 * Math.pow(t, 2) - 2 * Math.pow(t, 3);
export function bilinearFilter(
  tl: number[] | TypedArray,
  tr: number[] | TypedArray,
  bl: number[] | TypedArray,
  br: number[] | TypedArray,
  t1: number,
  t2: number,
  smooth: boolean = false
) {
  const _t1 = smooth ? smoothFn(t1) : t1;
  const _t2 = smooth ? smoothFn(t2) : t2;
  const t = mix(tl, tr, _t1);
  const b = mix(bl, br, _t1);
  return mix(t, b, _t2);
}

export function mod(x: number, a: number) {
  return x - a * Math.floor(x / a);
}
