import { Mat4, Quat, Vec3, mat4, quat, vec3 } from "wgpu-matrix";
import { Component } from "./Component";

export class Transform extends Component {
  position: Vec3 = vec3.zero();
  rotation: Vec3 = vec3.zero();
  quaternion: Quat = quat.create();
  scale: Vec3 = vec3.create(1, 1, 1);
  matrix: Mat4 = mat4.identity();

  get normalMatrix() {
    return mat4.transpose(mat4.inverse(this.matrix));
  }

  update() {
    quat.fromEuler(
      this.rotation[0],
      this.rotation[1],
      this.rotation[2],
      "xyz",
      this.quaternion
    );
    mat4.fromRotationTranslationScale(
      this.quaternion,
      this.position,
      this.scale,
      this.matrix
    );
  }
}
