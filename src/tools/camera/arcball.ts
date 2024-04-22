import {
  Mat4,
  Vec2,
  Vec3,
  mat3,
  mat4,
  quat,
  vec2,
  vec3,
  vec4,
} from "wgpu-matrix";

/* The arcball camera will be placed at the position 'eye', rotating
 * around the point 'center', with the up vector 'up'. 'screenDims'
 * should be the dimensions of the canvas or region taking mouse input
 * so the mouse positions can be normalized into [-1, 1] from the pixel
 * coordinates.
 */
export default class ArcballCamera {
  invScreen: [number, number];
  centerTranslation: Mat4;
  translation: Mat4;
  rotation;
  camera: Mat4;
  invCamera: Mat4;
  constructor(
    public eye: Vec3,
    public center: Vec3,
    public up: Vec3,
    public zoomSpeed: number,
    public screenDims: [number, number]
  ) {
    var veye = vec3.set(eye[0], eye[1], eye[2]);
    var vcenter = vec3.set(center[0], center[1], center[2]);
    var vup = vec3.set(up[0], up[1], up[2]);
    vec3.normalize(vup, vup);

    var zAxis = vec3.sub(vcenter, veye);
    var viewDist = vec3.len(zAxis);
    vec3.normalize(zAxis, zAxis);

    var xAxis = vec3.cross(zAxis, vup);
    vec3.normalize(xAxis, xAxis);

    var yAxis = vec3.cross(xAxis, zAxis);
    vec3.normalize(yAxis, yAxis);

    vec3.cross(xAxis, zAxis, yAxis);
    vec3.normalize(xAxis, xAxis);

    this.zoomSpeed = zoomSpeed;
    this.invScreen = [1.0 / screenDims[0], 1.0 / screenDims[1]];

    this.centerTranslation = mat4.translation(center);
    mat4.inverse(this.centerTranslation, this.centerTranslation);

    var vt = vec3.set(0, 0, -1.0 * viewDist);
    this.translation = mat4.translation(vt);

    var rotMat = mat3.create(
      xAxis[0],
      xAxis[1],
      xAxis[2],
      yAxis[0],
      yAxis[1],
      yAxis[2],
      -zAxis[0],
      -zAxis[1],
      -zAxis[2]
    );
    mat3.transpose(rotMat, rotMat);
    this.rotation = quat.fromMat(rotMat);
    quat.normalize(this.rotation, this.rotation);

    this.camera = mat4.create();
    this.invCamera = mat4.create();
    this.updateCameraMatrix();
  }

  rotate(prevMouse: Vec2, curMouse: Vec2) {
    var mPrev = vec2.set(
      clamp(prevMouse[0] * 2.0 * this.invScreen[0] - 1.0, -1.0, 1.0),
      clamp(1.0 - prevMouse[1] * 2.0 * this.invScreen[1], -1.0, 1.0)
    );

    var mCur = vec2.set(
      clamp(curMouse[0] * 2.0 * this.invScreen[0] - 1.0, -1.0, 1.0),
      clamp(1.0 - curMouse[1] * 2.0 * this.invScreen[1], -1.0, 1.0)
    );

    var mPrevBall = screenToArcball(mPrev);
    var mCurBall = screenToArcball(mCur);
    // rotation = curBall * prevBall * rotation
    this.rotation = quat.mul(this.rotation, mPrevBall, this.rotation);
    this.rotation = quat.mul(this.rotation, mCurBall, this.rotation);

    this.updateCameraMatrix();
  }

  zoom(amount: number) {
    var vt = vec3.set(0.0, 0.0, amount * this.invScreen[1] * this.zoomSpeed);
    var t = mat4.translation(vt);
    this.translation = mat4.mul(this.translation, t, this.translation);
    if (this.translation[14] >= -0.2) {
      this.translation[14] = -0.2;
    }
    this.updateCameraMatrix();
  }

  pan(mouseDelta: Vec2) {
    var delta = vec4.set(
      mouseDelta[0] * this.invScreen[0] * Math.abs(this.translation[14]),
      mouseDelta[1] * this.invScreen[1] * Math.abs(this.translation[14]),
      0,
      0
    );
    var worldDelta = vec4.transformMat4(delta, this.invCamera);
    var translation = mat4.translation(worldDelta);
    this.centerTranslation = mat4.mul(
      this.centerTranslation,
      translation,
      this.centerTranslation
    );
    this.updateCameraMatrix();
  }
  updateCameraMatrix() {
    // camera = translation * rotation * centerTranslation
    var rotMat = mat4.fromQuat(this.rotation);
    this.camera = mat4.mul(rotMat, this.centerTranslation, this.camera);
    this.camera = mat4.mul(this.translation, this.camera, this.camera);
    this.invCamera = mat4.invert(this.camera, this.invCamera);
  }
  eyePos() {
    return [this.invCamera[12], this.invCamera[13], this.invCamera[14]];
  }
  eyeDir() {
    var dir = vec4.set(0.0, 0.0, -1.0, 0.0);
    dir = vec4.transformMat4(dir, dir, this.invCamera);
    dir = vec4.normalize(dir, dir);
    return [dir[0], dir[1], dir[2]];
  }
  upDir() {
    var dir = vec4.set(0.0, 1.0, 0.0, 0.0);
    dir = vec4.transformMat4(dir, dir, this.invCamera);
    dir = vec4.normalize(dir, dir);
    return [dir[0], dir[1], dir[2]];
  }
}

export function screenToArcball(p: Vec2) {
  const dist = vec2.dot(p, p);
  if (dist <= 1.0) {
    return quat.set(p[0], p[1], Math.sqrt(1.0 - dist), 0);
  } else {
    const unitP = vec2.normalize(p);
    // cgmath is w, x, y, z
    // glmatrix is x, y, z, w
    return quat.set(unitP[0], unitP[1], 0, 0);
  }
}
export function clamp(a: number, min: number, max: number) {
  return a < min ? min : a > max ? max : a;
}
