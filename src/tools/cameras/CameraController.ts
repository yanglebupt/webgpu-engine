import { Mat4, vec4 } from "wgpu-matrix";
import { Camera } from "./Camera";
import { CanvasController } from "./CanvasController";
import { Updatable } from "../scene/types";

export abstract class CameraController
  extends CanvasController
  implements Updatable
{
  abstract viewMatrix: Mat4;
  abstract invViewMatrix: Mat4;

  constructor(public camera: Camera, canvas: HTMLCanvasElement) {
    super(canvas);
    this.description();
  }

  description() {}

  eyePos() {
    return [
      this.invViewMatrix[12],
      this.invViewMatrix[13],
      this.invViewMatrix[14],
    ];
  }

  eyeDir() {
    var dir = vec4.set(0.0, 0.0, -1.0, 0.0);
    dir = vec4.transformMat4(dir, dir, this.invViewMatrix);
    dir = vec4.normalize(dir, dir);
    return [dir[0], dir[1], dir[2]];
  }

  upDir() {
    var dir = vec4.set(0.0, 1.0, 0.0, 0.0);
    dir = vec4.transformMat4(dir, dir, this.invViewMatrix);
    dir = vec4.normalize(dir, dir);
    return [dir[0], dir[1], dir[2]];
  }

  update() {
    this.camera.viewMatrix = this.viewMatrix;
    this.camera.cameraPosition = this.eyePos();
  }
}
