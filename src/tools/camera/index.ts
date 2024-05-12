import { Mat4, Vec3, mat4, vec3 } from "wgpu-matrix";
import ArcballCamera from "./arcball";
import {
  StructuredView,
  makeShaderDataDefinitions,
  makeStructuredView,
} from "webgpu-utils";
import { VPTransformationMatrixGroupBinding, VP_NAME } from "../shaders";
import { UpdateController } from "../scene";
import Controller from "./controller";

export interface Camera {
  eye: Vec3;
  target: Vec3;
  up: Vec3;
  matrix: Mat4;
  viewMatrix: Mat4;
  cameraPosition: Vec3;
  render(renderPass: GPURenderPassEncoder): void;
}

export class Camera {
  static defs = makeShaderDataDefinitions(VPTransformationMatrixGroupBinding);
  static view = makeStructuredView(Camera.defs.uniforms[VP_NAME]);
  constructor() {
    this.viewMatrix = mat4.identity();
    this.cameraPosition = vec3.zero();
  }
}
export class PerspectiveCamera extends Camera {
  eye: Vec3 = [0, 0, 0];
  target: Vec3 = [0, 0, 0];
  up: Vec3 = [0, 1, 0];

  constructor(
    fieldOfViewYInRadians: number,
    aspect: number,
    zNear: number,
    zFar: number
  ) {
    super();
    this.matrix = mat4.perspective(fieldOfViewYInRadians, aspect, zNear, zFar);
  }

  lookAt(eye: Vec3, target?: Vec3, up?: Vec3) {
    this.eye = eye;
    if (target) this.target = target;
    if (up) this.up = up;
    this.viewMatrix = mat4.lookAt(this.eye, this.target, this.up);
    this.cameraPosition = vec3.getTranslation(mat4.inverse(this.viewMatrix));
  }
}

export class OrbitController extends UpdateController {
  arcballController: ArcballCamera;
  id = "orbitcontroller-tips";
  constructor(
    public camera: Camera,
    public canvas: HTMLCanvasElement,
    public options?: { zoomSpeed?: number }
  ) {
    super();
    this.arcballController = this.createArcBallCamera(
      camera.eye,
      camera.target,
      camera.up
    );
  }

  createArcBallCamera(eye: Vec3, target: Vec3, up: Vec3) {
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
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
