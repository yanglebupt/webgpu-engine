import { Mat4, Vec2, Vec3, mat4, vec2, vec3 } from "wgpu-matrix";
import ArcballCamera from "./arcball";
import {
  ShaderDataDefinitions,
  StructuredView,
  makeShaderDataDefinitions,
  makeStructuredView,
} from "webgpu-utils";
import { VPTransformationMatrixGroupBinding, VP_NAME } from "../shaders";
import { Updatable, VirtualView } from "../scene/types";
import Controller from "./controller";
import { Ray } from "../maths/Ray";

export interface Camera {
  eye: Vec3;
  target: Vec3;
  up: Vec3;
  matrix: Mat4;
  viewMatrix: Mat4;
  cameraPosition: Vec3;
  near: number;
  far: number;
}

const _v = vec3.create();
const _m = mat4.create();

export class Camera implements VirtualView {
  static defs: ShaderDataDefinitions;
  static view: StructuredView;
  static {
    try {
      Camera.defs = makeShaderDataDefinitions(
        VPTransformationMatrixGroupBinding
      );
      Camera.view = makeStructuredView(Camera.defs.uniforms[VP_NAME]);
    } catch (error) {}
  }

  // 渲染画布的宽高
  renderResolution?: { width: number; height: number };

  constructor() {
    this.eye = [0, 0, 0];
    this.target = [0, 0, 0];
    this.up = [0, 1, 0];
    this.viewMatrix = mat4.identity();
    this.cameraPosition = vec3.zero();
  }

  lookAt(eye: Vec3, target?: Vec3, up?: Vec3) {
    this.eye = eye;
    if (target) this.target = target;
    if (up) this.up = up;
    this.viewMatrix = mat4.lookAt(this.eye, this.target, this.up);
    this.cameraPosition = vec3.getTranslation(mat4.inverse(this.viewMatrix));
  }

  getBufferView() {
    return {
      projectionMatrix: this.matrix,
      viewMatrix: this.viewMatrix,
      cameraPosition: this.cameraPosition,
    };
  }

  screenToViewportPoint(x: number, y: number) {
    if (!this.renderResolution)
      throw new Error(
        "can not get viewport point without resolution, you must add your camera to a scene"
      );
    const vx = 2 * (x / this.renderResolution.width) - 1;
    const vy = 1 - 2 * (y / this.renderResolution.height);
    return [vx, vy];
  }

  viewportToScreenPoint(vx: number, vy: number) {
    if (!this.renderResolution)
      throw new Error(
        "can not transform without resolution, you must add your camera to a scene"
      );
    const x = 0.5 * (vx + 1) * this.renderResolution.width;
    const y = 0.5 * (1 - vy) * this.renderResolution.height;
    return [x, y];
  }

  screenToWorldPoint(x: number, y: number, z = 1) {
    vec3.set(0, 0, z, _v);
    this.project(_v);

    const [vx, vy] = this.screenToViewportPoint(x, y);

    _v[0] = vx;
    _v[1] = vy;

    this.unproject(_v);
    _v[2] = z;

    return vec3.copy(_v);
  }

  worldToViewportPoint(pos: Vec3) {
    vec3.copy(pos, _v);
    this.project(_v);
    return vec2.create(_v[0], _v[1]);
  }

  worldToScreenPoint(pos: Vec3) {
    const vp = this.worldToViewportPoint(pos);
    const [x, y] = this.viewportToScreenPoint(vp[0], vp[1]);
    vp[0] = x;
    vp[1] = y;
    return vp;
  }

  project(pos: Vec3) {
    mat4.multiply(this.matrix, this.viewMatrix, _m);
    vec3.transformMat4(pos, _m, pos);
  }

  unproject(pos: Vec3) {
    mat4.multiply(this.matrix, this.viewMatrix, _m);
    mat4.inverse(_m, _m);
    vec3.transformMat4(pos, _m, pos);
  }

  // 从相机中心发射一条指向屏幕位置的射线
  screenPointToRay(x: number, y: number) {
    // 注意想要可视化，origin 不能是相机位置，必须要让 origin 移动到近平面上，防止被裁剪掉，从而无法绘制线段
    const [vx, vy] = this.screenToViewportPoint(x, y);
    vec3.set(vx, vy, 1, _v); // 无穷远处
    // --> 相机坐标系下就是相机坐标系下的 dir
    mat4.inverse(this.matrix, _m);
    vec3.transformMat4(_v, _m, _v);
    vec3.normalize(_v, _v);

    // _v[3] = 0; // 代表是方向，而不是点，后面变换到世界坐标，不受平移的影响

    // 计算射线和近平面的交点
    const near = this.near;
    const t = -near / _v[2]; // 相机是看向 -Z 的
    const origin = vec3.mulScalar(_v, t);

    mat4.inverse(this.viewMatrix, _m);

    vec3.transformMat3(_v, _m, _v); // 注意是 Mat3
    const direction = vec3.normalize(_v);

    vec3.transformMat4(origin, _m, origin);

    return new Ray(origin, direction);
  }
}

export class PerspectiveCamera extends Camera {
  constructor(
    public fieldOfViewYInRadians: number,
    public aspect: number,
    public near: number,
    public far: number
  ) {
    super();
    this.matrix = mat4.perspective(fieldOfViewYInRadians, aspect, near, far);
  }
}

export class OrbitController implements Updatable {
  arcballController: ArcballCamera;
  id = "orbitcontroller-tips";
  constructor(
    public camera: Camera,
    public canvas: HTMLCanvasElement,
    public options?: { zoomSpeed?: number }
  ) {
    this.arcballController = this.createArcBallCamera(
      camera.eye,
      camera.target,
      camera.up
    );
  }

  createArcBallCamera(eye: Vec3, target: Vec3, up: Vec3) {
    const width = this.canvas.clientWidth || parseInt(this.canvas.style.width);
    const height =
      this.canvas.clientHeight || parseInt(this.canvas.style.height);
    const { zoomSpeed } = this.options ?? {};
    const orbitController = new ArcballCamera(
      eye,
      target,
      up,
      zoomSpeed ?? 0.5,
      [width, height]
    );
    const controller = new Controller();
    controller.mousemove = (prev, cur, evt) => {
      if (evt.buttons == 1) {
        orbitController.rotate(prev, cur);
      } else if (evt.buttons == 2) {
        orbitController.pan([cur[0] - prev[0], prev[1] - cur[1]]);
      }
    };
    controller.wheel = (amt) => {
      orbitController.zoom(amt * 0.5);
    };
    controller.registerForCanvas(this.canvas);
    if (!document.getElementById(this.id)) {
      const div = document.createElement("div");
      div.innerText =
        "Controls: left-click to drag, right-click to pan, scroll to zoom.";
      document.body.insertBefore(div, document.body.firstChild);
      div.id = this.id;
    }
    return orbitController;
  }

  update() {
    this.camera.viewMatrix = this.arcballController.camera;
    this.camera.cameraPosition = vec3.getTranslation(
      mat4.inverse(this.camera.viewMatrix)
    );
  }
}
