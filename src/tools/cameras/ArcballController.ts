import { Mat4, Vec2, mat3, mat4, quat, vec2, vec3, vec4 } from "wgpu-matrix";
import { BtnEvent, MousePoint } from "./CanvasController";
import { Camera } from "./Camera";
import { CameraController } from "./CameraController";
import { clamp } from "../math";

/* The arcball camera will be placed at the position 'eye', rotating
 * around the point 'center', with the up vector 'up'. 'screenDims'
 * should be the dimensions of the canvas or region taking mouse input
 * so the mouse positions can be normalized into [-1, 1] from the pixel
 * coordinates.
 */
export class ArcballController extends CameraController {
  invScreen: [number, number];
  centerTranslation: Mat4;
  translation: Mat4;
  rotation;
  viewMatrix: Mat4;
  invViewMatrix: Mat4;
  zoomSpeed: number;

  id = "arcball-controller-tips";

  constructor(
    camera: Camera,
    canvas: HTMLCanvasElement,
    zoomSpeed: number = 0.5
  ) {
    super(camera, canvas);

    const width = canvas.clientWidth || parseInt(canvas.style.width);
    const height = canvas.clientHeight || parseInt(canvas.style.height);

    const screenDims = [width, height];
    const { eye, target: center, up } = camera;

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

    this.viewMatrix = mat4.create();
    this.invViewMatrix = mat4.create();
    this.updateCameraMatrix();
  }

  description() {
    if (!document.getElementById(this.id)) {
      const div = document.createElement("div");
      div.innerText =
        "Controls: left-click to drag, right-click to pan, scroll to zoom.";
      document.body.insertBefore(div, document.body.firstChild);
      div.id = this.id;
    }
  }

  mousemove(prev: MousePoint, cur: MousePoint, evt: BtnEvent): void {
    if (evt.buttons == 1) {
      this.rotate(prev, cur);
    } else if (evt.buttons == 2) {
      this.pan([cur[0] - prev[0], prev[1] - cur[1]]);
    }
  }

  wheel(amount: number): void {
    this.zoom(amount * 0.5);
  }

  screenToArcball(p: Vec2) {
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

  rotate(prevMouse: Vec2, curMouse: Vec2) {
    var mPrev = vec2.set(
      clamp(prevMouse[0] * 2.0 * this.invScreen[0] - 1.0, -1.0, 1.0),
      clamp(1.0 - prevMouse[1] * 2.0 * this.invScreen[1], -1.0, 1.0)
    );

    var mCur = vec2.set(
      clamp(curMouse[0] * 2.0 * this.invScreen[0] - 1.0, -1.0, 1.0),
      clamp(1.0 - curMouse[1] * 2.0 * this.invScreen[1], -1.0, 1.0)
    );

    var mPrevBall = this.screenToArcball(mPrev);
    var mCurBall = this.screenToArcball(mCur);
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
    var worldDelta = vec4.transformMat4(delta, this.invViewMatrix);
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
    this.viewMatrix = mat4.mul(rotMat, this.centerTranslation, this.viewMatrix);
    this.viewMatrix = mat4.mul(
      this.translation,
      this.viewMatrix,
      this.viewMatrix
    );
    this.invViewMatrix = mat4.invert(this.viewMatrix, this.invViewMatrix);
  }
}
