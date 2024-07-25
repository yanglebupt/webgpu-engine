import { mat4, Mat4, vec3, Vec3 } from "wgpu-matrix";
import { EntityObject } from "../entitys/EntityObject";
import { Direction } from "../maths/Axis";

const _v = vec3.create();
const _m = mat4.create();

export class Bone extends EntityObject {
  type: string = "Bone";
  bindMatrix: Mat4 = mat4.identity(); // bind 的初始变换矩阵
  deltaMatrix: Mat4 = mat4.identity(); // 相对于 bind 的变换矩阵

  constructor(
    public name: string = "Bone",
    public direction = vec3.create(0, -1, 0),
    public length = 1,
    public parentBone?: Bone
  ) {
    super();
    this.direction = vec3.normalize(this.direction, this.direction);
    // 指向 direction
    const up =
      vec3.equals(this.direction, Direction.up) ||
      vec3.equals(this.direction, Direction.down)
        ? Direction.left
        : Direction.up;
    const pos = this.transform.position;
    vec3.addScaled(pos, this.direction, this.length, _v);
    mat4.aim(pos, _v, up, _m);
    this.transform.applyMatrix4(_m);
    this.transform.scale[2] *= this.length;
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

  generateNextBone(
    name: string = "Bone",
    direction: Vec3 = vec3.create(0, -1, 0),
    length: number = 1
  ) {
    return new Bone(name, direction, length, this);
  }
}
