import { PerspectiveCamera } from "../../tools/cameras/Camera";
import { degToRad } from "../../tools/math";
import { WebGPURenderer } from "../../tools/renderer";
import { Scene } from "../../tools/scene";
import { AmbientLight } from "../../tools/lights";
import { Logger } from "../../tools/helper";
import { GridController } from "../../tools/toolkit/GridController";
import { ArcballController } from "../../tools/cameras/ArcballController";

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

const scene = new Scene(renderer, { development: true, debug: true });

// 创建相机和控制器
const camera = new PerspectiveCamera(degToRad(75), renderer.aspect, 0.1, 100);
camera.lookAt([0, 1, -5], [0, 0, 0]);
const arcball = new ArcballController(camera, renderer.canvas, 0.5);
scene.add(arcball);

const amb_light = new AmbientLight([1, 1, 1, 1], 10);
scene.add(amb_light);

scene.add(new GridController());

export function frame() {
  scene.render();
  requestAnimationFrame(frame);
}
