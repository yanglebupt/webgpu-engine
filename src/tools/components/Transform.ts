import { Mat3, Mat4, Quat, Vec3, mat4, quat, vec3 } from "wgpu-matrix";
import { EntityObjectComponent } from "./Component";
import { Euler } from "../maths/Euler";
import { Quaternion } from "../maths/Quaternion";
import { EntityObject } from "../entitys/EntityObject";
import { Direction, Space } from "../maths/Axis";

const _q1 = quat.create();
const _v1 = vec3.create();
const _matrix = mat4.create();

export class Transform extends EntityObjectComponent {
  position: Vec3 = vec3.zero();
  // quaternion 和 rotation 要同步
  rotation: Euler = new Euler();
  quaternion: Quaternion = new Quaternion();
  scale: Vec3 = vec3.create(1, 1, 1);
  matrix: Mat4 = mat4.identity();
  worldMatrix: Mat4 = mat4.identity();
  worldNormalMatrix: Mat4 = mat4.identity();

  getWroldPosition(v: Vec3) {
    const pp = this.object.parent?.worldMatrix; // 假设父节点已经是最新的了
    if (pp) vec3.transformMat4(this.position, pp, v);
    else vec3.copy(this.position, v);
    return v;
  }

  constructor(public object: EntityObject) {
    super(object);
    this.quaternion.onChange = () => {
      mat4.fromQuat(this.quaternion.elements, _matrix);
      this.rotation.setFromRotationMatrix(_matrix, this.rotation.order, false);
    };

    this.rotation.onChange = () =>
      this.quaternion.setFromEuler(this.rotation, false);

    this.updateWorldMatrix();
  }

  updateMatrix() {
    mat4.fromRotationTranslationScale(
      this.quaternion.elements,
      this.position,
      this.scale,
      this.matrix
    );
  }

  // apply 都是增量写入
  applyMatrix4(matrix: Mat4) {
    this.updateMatrix();

    mat4.multiply(matrix, this.matrix, this.matrix);

    mat4.decompose(
      this.matrix,
      this.quaternion.elements,
      this.position,
      this.scale
    );
    // 手动同步 quaternion 和 rotation
    this.quaternion.onChange();
    return this;
  }

  applyQuaternion(q: Quat) {
    quat.multiply(q, this.quaternion.elements, this.quaternion.elements);
    this.quaternion.onChange();
    return this;
  }

  // set 都是覆盖写，使用较少
  setRotationFromAxisAngle(axis: Vec3, angle: number) {
    // assumes axis is normalized
    quat.fromAxisAngle(axis, angle, this.quaternion.elements);
    this.quaternion.onChange();
    return this;
  }

  setRotationFromEuler(euler: Euler) {
    this.quaternion.setFromEuler(euler, true);
    return this;
  }

  setRotationFromMatrix(m: Mat3 | Mat4) {
    // assumes the upper 3x3 of m is a pure rotation matrix (i.e, unscaled)

    quat.fromMat(m, this.quaternion.elements);
    this.quaternion.onChange();
    return this;
  }

  setRotationFromQuaternion(q: Quat) {
    // assumes q is normalized
    quat.copy(q, this.quaternion.elements);
    this.quaternion.onChange();
    return this;
  }

  /* 
    围绕局部坐标轴，局部坐标轴会随着物体旋转而改变
    围绕世界坐标轴

    Tips: 如何判断旋转所绕的轴，绕着轴旋转 180 度，与起点和终点连线垂直的就是旋转轴
    有这个很容易判断是否绕局部还是世界旋转
  */
  rotateOnAxis(axis: Vec3, angle: number, space = Space.Local) {
    // rotate object on axis in object space
    // axis is assumed to be normalized

    if (space === Space.Local) {
      quat.fromAxisAngle(axis, angle, _q1);
      // 围绕局部坐标轴
      quat.multiply(this.quaternion.elements, _q1, this.quaternion.elements);
    }
    // 围绕世界坐标轴
    else {
      vec3.copy(axis, _v1);
      const parentWorldMatrix = this.object.parent?.worldMatrix; // 假设父节点已经是最新的了
      if (parentWorldMatrix) {
        mat4.inverse(parentWorldMatrix, _matrix);
        vec3.transformMat4Upper3x3(axis, _matrix, _v1);
        if (mat4.determinant(parentWorldMatrix) < 0) {
          angle *= -1;
        }
      }
      quat.fromAxisAngle(_v1, angle, _q1);
      quat.multiply(_q1, this.quaternion.elements, this.quaternion.elements);
    }

    this.quaternion.onChange();

    /* So what happen in here

      _q1 * this.quaternion 代表先绕 this.quaternion 旋转，然后再绕 _q1 旋转，两个轴默认都是世界坐标轴和物体的局部坐标轴无关

      但现在我想要绕物体的局部坐标轴旋转该咋办呢，也就是 _q1 和局部坐标轴有关 ？？？

      https://stackoverflow.com/questions/24681490/quaternion-rotations-trying-to-rotate-an-object-around-his-axis

      As for applying a local axis rotation using quaternions 
      1. you could simply transform the local axis into world space (use current this.quaternion)
      2. then use world axis construct new quaternion _q1
      3. finnally apply the new quaternion _q1 in current this.quaternion as world rotation

      below code follow this steps
    */

    // if (space === Space.Local)
    //   vec3.transformQuat(axis, this.quaternion.elements, _v1);
    // else vec3.copy(axis, _v1);
    // quat.fromAxisAngle(_v1, angle, _q1);
    // quat.multiply(_q1, this.quaternion.elements, this.quaternion.elements);

    return this;
  }

  rotateX(angle: number, space = Space.Local) {
    return this.rotateOnAxis(Direction.left, angle, space);
  }

  rotateY(angle: number, space = Space.Local) {
    return this.rotateOnAxis(Direction.up, angle, space);
  }

  rotateZ(angle: number, space = Space.Local) {
    return this.rotateOnAxis(Direction.forward, angle, space);
  }

  translateOnAxis(axis: Vec3, distance: number, space = Space.Local) {
    // translate object by distance along axis in object space
    // axis is assumed to be normalized

    // 通过变换轴的思路
    if (space === Space.Local)
      vec3.transformQuat(axis, this.quaternion.elements, _v1);
    else {
      vec3.copy(axis, _v1);
      const parentWorldMatrix = this.object.parent?.worldMatrix; // 假设父节点已经是最新的了
      if (parentWorldMatrix) {
        mat4.inverse(parentWorldMatrix, _matrix);
        vec3.transformMat4Upper3x3(axis, _matrix, _v1);
        if (mat4.determinant(parentWorldMatrix) < 0) {
          distance *= -1;
        }
      }
    }

    vec3.addScaled(this.position, _v1, distance, this.position);

    // babylonjs 的方法
    // const displacementVector = vec3.mulScalar(axis, distance, _v1);
    // if (space === Space.Local) {
    //   const tempV3 =
    //     this.getPositionExpressedInLocalSpace().add(displacementVector);
    //   this.setPositionWithLocalVector(tempV3);
    // } else {
    //   this.setAbsolutePosition(
    //     this.getAbsolutePosition().add(displacementVector)
    //   );
    // }

    return this;
  }

  translateX(distance: number, space = Space.Local) {
    return this.translateOnAxis(Direction.left, distance, space);
  }

  translateY(distance: number, space = Space.Local) {
    return this.translateOnAxis(Direction.up, distance, space);
  }

  translateZ(distance: number, space = Space.Local) {
    return this.translateOnAxis(Direction.forward, distance, space);
  }

  scaleOnAxis(size: Vec3) {
    vec3.mul(this.scale, size, this.scale);
    return this;
  }

  scaleX(size: number) {
    this.scale[0] *= size;
    return this;
  }

  scaleY(size: number) {
    this.scale[1] *= size;
    return this;
  }

  scaleZ(size: number) {
    this.scale[2] *= size;
    return this;
  }

  // 多次change，一次更新，属于编译优化
  batchChange(changeFunc: () => void) {
    changeFunc();
    this.updateInChildren();
  }

  updateInChildren(_target?: Transform) {
    const target = _target ?? this;
    target.update();
    target.object.children.forEach((child) =>
      this.updateInChildren(child.transform)
    );
  }

  update() {
    this.updateMatrix();
    this.updateWorldMatrix();
  }

  updateWorldMatrix() {
    const parentWorldMatrix = this.object.parent?.worldMatrix;
    if (parentWorldMatrix) {
      mat4.multiply(parentWorldMatrix, this.matrix, this.worldMatrix);
    } else mat4.copy(this.matrix, this.worldMatrix);
    mat4.inverse(this.worldMatrix, _matrix);
    mat4.transpose(_matrix, this.worldNormalMatrix);
  }
}
