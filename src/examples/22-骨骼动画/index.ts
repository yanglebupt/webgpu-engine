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
import { Space } from "../../tools/maths/Axis";
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
camera.lookAt([2, 1, -5], [0, 0, 0]);
const arcball = new ArcballController(camera, renderer.canvas, 0.5);
scene.add(arcball);

const amb_light = new AmbientLight([1, 1, 1, 1], 10);
scene.add(amb_light);
scene.add(new GridController());

const makeLeg = (xPos: number = 0) => {
  const legs = [];
  const upperLeg = new Bone("upper leg");
  upperLeg.transform.position[0] = xPos;
  const lowerLeg = upperLeg.generateNextBone("lower leg");
  // const foot = lowerLeg.generateNextBone("foot", vec3.create(0, -0.5, -1), 0.5);
  legs.push(upperLeg, lowerLeg);
  return legs;
};

Skeleton.material.wireframe = false;
const skeleton = new Skeleton(
  { leftLeg: makeLeg(-0.3), rightLeg: makeLeg(0.3) },
  true
);
skeleton.addComponent(SkeletonWalk);
scene.add(skeleton);

export function frame() {
  scene.render();
  requestAnimationFrame(frame);
}
