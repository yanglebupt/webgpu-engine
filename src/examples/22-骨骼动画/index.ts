import { PerspectiveCamera } from "../../tools/cameras/Camera";
import { degToRad } from "../../tools/math";
import { WebGPURenderer } from "../../tools/renderer";
import { Scene } from "../../tools/scene";
import { AmbientLight } from "../../tools/lights";
import { Logger } from "../../tools/helper";
import { GridController } from "../../tools/toolkit/GridController";
import { ArcballController } from "../../tools/cameras/ArcballController";
import { Bone } from "../../tools/objects/Bone";
import { Skeleton } from "../../tools/objects/Skeleton";
import { mat4, quat, vec3 } from "wgpu-matrix";
import { Direction, Space } from "../../tools/maths/Axis";
import { SkeletonWalk } from "./SkeletonWalk";

Logger.production = true;

// 新建一个 WebGPURenderer
const renderer = (await new WebGPURenderer()
  .checkSupport()
  .catch(({ message }) => {
    const div = document.createElement("div");
    div.innerText = message;
    document.body.appendChild(div);
    throw new Error(message);
  })) as WebGPURenderer;

const scene = new Scene(renderer);

// 创建相机和控制器
const camera = new PerspectiveCamera(degToRad(75), renderer.aspect, 0.1, 100);
camera.lookAt([-2, 1, 5], [0, 0, 0]);
const arcball = new ArcballController(camera, renderer.canvas, 0.5);
scene.add(arcball);

const amb_light = new AmbientLight([1, 1, 1, 1], 10);
scene.add(amb_light);
scene.add(new GridController());

////////////// hip (root) ///////////////////
const hip = new Bone({
  name: "hip",
  direction: Direction.up,
  length: 0.2,
});

////////////// spine ///////////////////
const spines: Bone[] = [];
{
  const length = 0.5;
  const spine = hip.generateNextBone({
    name: "spine",
    direction: Direction.up,
    length,
  });
  const chest = spine.generateNextBone({
    name: "chest",
    direction: Direction.up,
    length,
  });
  const neck = chest.generateNextBone({
    name: "neck",
    direction: Direction.up,
    length: 0.25,
  });
  const head = neck.generateNextBone({
    name: "head",
    direction: Direction.up,
    length,
  });
  spines.push(spine, chest, neck, head);
}

//////////// Leg /////////////////
const _v = vec3.create(0, -0.5, 1);
vec3.normalize(_v, _v);
const createLeg = (xPos: number = 0) => {
  const legs = [];
  const length = 0.9;
  const upperLeg = new Bone({ name: "upper leg", length }, hip);
  upperLeg.transform.position[0] = xPos;
  upperLeg.transform.position[2] = 0;
  const lowerLeg = upperLeg.generateNextBone({ name: "lower leg", length });
  const foot = lowerLeg.generateNextBone({
    name: "foot",
    direction: _v,
    length: 0.5,
  });
  legs.push(upperLeg, lowerLeg, foot);
  return legs;
};

////////////// Arm ///////////////////
const createArm = (xPos: number = 0) => {
  const arms = [];
  const length = 0.7;
  const parent = spines.find((b) => b.name === "chest")!;
  const upperArm = new Bone({ name: "upper arm", length }, parent);
  upperArm.transform.position[0] = xPos;
  upperArm.transform.position[2] = parent.length;
  const lowerArm = upperArm.generateNextBone({
    name: "lower arm",
    length,
  });
  const palm = lowerArm.generateNextBone({ name: "palm", length: 0.3 });
  arms.push(upperArm, lowerArm, palm);
  return arms;
};

////////////// 变换一定要在添加骨骼之后 ///////////////////
// spines[0].transform.rotateY(Math.PI / 4);

const skeleton = new Skeleton(
  {
    hip,
    spines,
    leftLeg: createLeg(-0.3),
    rightLeg: createLeg(0.3),
    leftArm: createArm(-0.5),
    rightArm: createArm(0.5),
  },
  true
);
skeleton.addComponent(SkeletonWalk);
scene.add(skeleton);

export function frame() {
  scene.render();
  requestAnimationFrame(frame);
}
