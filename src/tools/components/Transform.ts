import { Mat4, Vec3, mat4, quat, vec3 } from "wgpu-matrix";
import { Updatable } from "../scene/types";
import { Component } from "./Component";

export class Transform extends Component implements Updatable {
  position: Vec3 = vec3.zero();
  rotation: Vec3 = vec3.zero();
  scale: Vec3 = vec3.create(1, 1, 1);
  matrix: Mat4 = mat4.identity();

  get normalMatrix() {
    return mat4.transpose(mat4.inverse(this.matrix));
  }

  update() {
    const q = quat.fromEuler(
      this.rotation[0],
      this.rotation[1],
      this.rotation[2],
      "xyz"
    );
    mat4.fromRotationTranslationScale(
      [...q],
      [...this.position],
      [...this.scale],
      this.matrix
    );
  }
}
