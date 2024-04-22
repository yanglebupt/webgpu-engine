import { Mat4, Vec3, mat4 } from "wgpu-matrix";
import ArcballCamera from "./arcball";
import Controller from "./controller";
import {
  StructuredView,
  makeShaderDataDefinitions,
  makeStructuredView,
} from "webgpu-utils";
import { VPTransformationMatrixGroupBinding } from "../loaders/shaders";

export interface Camera {
  eye: Vec3;
  target: Vec3;
  up: Vec3;
  matrix: Mat4;
  trfView: StructuredView;
  trfBuffer: GPUBuffer;
  render(renderPass: GPURenderPassEncoder): void;
}

export class PerspectiveCamera implements Camera {
  eye: Vec3 = [0, 0, 0];
  target: Vec3 = [0, 0, 0];
  up: Vec3 = [0, 1, 0];
  matrix: Mat4;
  trfView: StructuredView;
  trfBuffer: GPUBuffer;
  bindGrouplayout: GPUBindGroupLayout;
  bindGroup: GPUBindGroup;

  constructor(
    device: GPUDevice,
    fieldOfViewYInRadians: number,
    aspect: number,
    zNear: number,
    zFar: number
  ) {
    this.matrix = mat4.perspective(fieldOfViewYInRadians, aspect, zNear, zFar);

    const defs = makeShaderDataDefinitions(VPTransformationMatrixGroupBinding);
    this.trfView = makeStructuredView(defs.uniforms.trf);
    this.trfView.set({
      projectionMatrix: this.matrix,
    });

    const { bindGrouplayout, bindGroup, trfBuffer } =
      this.makeBindGroup(device);
    this.bindGroup = bindGroup;
    this.bindGrouplayout = bindGrouplayout;
    this.trfBuffer = trfBuffer;
  }

  makeBindGroup(device: GPUDevice) {
    const trfBuffer = device.createBuffer({
      size: this.trfView.arrayBuffer.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    const bindGrouplayout = device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX,
          buffer: { type: "uniform" },
        },
      ],
    });
    const bindGroup = device.createBindGroup({
      layout: bindGrouplayout,
      entries: [{ binding: 0, resource: { buffer: trfBuffer } }],
    });

    return { bindGroup, bindGrouplayout, trfBuffer };
  }

  lookAt(eye: Vec3, target?: Vec3, up?: Vec3) {
    this.eye = eye;
    if (target) this.target = target;
    if (up) this.up = up;
  }

  render(renderPass: GPURenderPassEncoder) {
    renderPass.setBindGroup(0, this.bindGroup);
  }
}

export class OrbitController {
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

  update() {}

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

  render(renderPass: GPURenderPassEncoder, device: GPUDevice) {
    this.camera.trfView.set({
      viewMatrix: this.arcballController.camera,
    });
    device.queue.writeBuffer(
      this.camera.trfBuffer,
      0,
      this.camera.trfView.arrayBuffer
    );
    this.camera.render(renderPass);
  }
}
