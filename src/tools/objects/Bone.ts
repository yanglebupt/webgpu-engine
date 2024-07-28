import { mat4, Mat4, vec3, Vec3 } from "wgpu-matrix";
import { EntityObject } from "../entitys/EntityObject";
import { Direction } from "../maths/Axis";

const _v = vec3.create();
const _m = mat4.create();

export interface BoneOptions {
  name: string;
  direction: Vec3;
  length: number;
}

export class Bone extends EntityObject {
  readonly direction: Vec3;
  readonly length: number;
  type: string = "Bone";
  bindMatrix: Mat4 = mat4.identity(); // bind 的初始变换矩阵
  deltaMatrix: Mat4 = mat4.identity(); // 相对于 bind 的变换矩阵

  constructor(options: Partial<BoneOptions>, public parentBone?: Bone) {
    super();
    this.name = options.name ?? "Bone";
    this.length = options.length ?? 1;
    this.direction = options.direction ?? vec3.create(0, -1, 0);
    // 指向 direction
    const up =
      vec3.equals(this.direction, Direction.up) ||
      vec3.equals(this.direction, Direction.down)
        ? Direction.forward
        : Direction.up;
    const pos = this.transform.position;
    vec3.addScaled(pos, this.direction, this.length, _v);
    mat4.aim(pos, _v, up, _m);
    this.transform.applyMatrix4(_m);
    if (this.parentBone) {
      this.transform.position = vec3.addScaled(
        this.parentBone.transform.getWroldPosition(_v), // 获取父节点的世界 position
        this.parentBone.direction,
        this.parentBone.length
      ); // move to parent bone end
      this.parentBone.attachChildren(this);
    }
    this.transform.update();
    this.bindMatrix = this.transform.worldMatrix;
  }

  generateNextBone(options: Partial<BoneOptions>) {
    return new Bone(options, this);
  }
}
