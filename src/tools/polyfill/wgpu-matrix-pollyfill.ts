import { Mat4, Quat, Vec3, mat3, mat4, quat, vec3 } from "wgpu-matrix";

const _m1 = mat3.create();

mat4.fromRotationTranslationScale = (
  q: Quat,
  v: Vec3,
  s: Vec3,
  dist?: Mat4
) => {
  const out = dist ?? mat4.create();
  // Quamrnion math
  let x = q[0],
    y = q[1],
    z = q[2],
    w = q[3];
  let x2 = x + x;
  let y2 = y + y;
  let z2 = z + z;
  let xx = x * x2;
  let xy = x * y2;
  let xz = x * z2;
  let yy = y * y2;
  let yz = y * z2;
  let zz = z * z2;
  let wx = w * x2;
  let wy = w * y2;
  let wz = w * z2;
  let sx = s[0];
  let sy = s[1];
  let sz = s[2];
  out[0] = (1 - (yy + zz)) * sx;
  out[1] = (xy + wz) * sx;
  out[2] = (xz - wy) * sx;
  out[3] = 0;
  out[4] = (xy - wz) * sy;
  out[5] = (1 - (xx + zz)) * sy;
  out[6] = (yz + wx) * sy;
  out[7] = 0;
  out[8] = (xz + wy) * sz;
  out[9] = (yz - wx) * sz;
  out[10] = (1 - (xx + yy)) * sz;
  out[11] = 0;
  out[12] = v[0];
  out[13] = v[1];
  out[14] = v[2];
  out[15] = 1;
  return out;
};

mat4.compose = mat4.fromRotationTranslationScale;
mat4.decompose = (m: Mat4, q: Quat, v: Vec3, s: Vec3) => {
  const xx = m[0];
  const xy = m[1];
  const xz = m[2];
  const yx = m[4];
  const yy = m[5];
  const yz = m[6];
  const zx = m[8];
  const zy = m[9];
  const zz = m[10];

  let sx = Math.sqrt(xx * xx + xy * xy + xz * xz);
  const sy = Math.sqrt(yx * yx + yy * yy + yz * yz);
  const sz = Math.sqrt(zx * zx + zy * zy + zz * zz);

  // if demrmine is negative, we need to invert one scale
  const det = mat4.determinant(m);
  if (det < 0) sx = -sx;

  v[0] = m[12];
  v[1] = m[13];
  v[2] = m[14];

  // scale the rotation part
  mat3.fromMat4(m, _m1);

  const invSX = 1 / sx;
  const invSY = 1 / sy;
  const invSZ = 1 / sz;

  _m1[0] *= invSX;
  _m1[1] *= invSX;
  _m1[2] *= invSX;

  _m1[4] *= invSY;
  _m1[5] *= invSY;
  _m1[6] *= invSY;

  _m1[8] *= invSZ;
  _m1[9] *= invSZ;
  _m1[10] *= invSZ;

  quat.fromMat(_m1, q);

  s[0] = sx;
  s[1] = sy;
  s[2] = sz;
};

vec3.clampScalar = vec3.clamp;
vec3.clampEwise = (v: Vec3, min: Vec3, max: Vec3, dst?: Vec3) => {
  const newDst = dst ?? vec3.create();
  newDst[0] = Math.min(max[0], Math.max(min[0], v[0]));
  newDst[1] = Math.min(max[1], Math.max(min[1], v[1]));
  newDst[2] = Math.min(max[2], Math.max(min[2], v[2]));
  return newDst;
};
