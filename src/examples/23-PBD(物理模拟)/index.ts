import { PerspectiveCamera } from "../../tools/cameras/Camera";
import { degToRad } from "../../tools/math";
import { WebGPURenderer } from "../../tools/renderer";
import { Scene } from "../../tools/scene";
import { AmbientLight } from "../../tools/lights";
import { Logger } from "../../tools/helper";
import { ArcballController } from "../../tools/cameras/ArcballController";
import { Mesh } from "../../tools/objects/Mesh";
import { CubeGeometry } from "../../tools/geometrys/CubeGeometry";
import { MeshBasicMaterial } from "../../tools/materials/MeshBasicMaterial";
import { RigidBody } from "../../tools/components/physics/RigidBody";
import { GridController } from "../../tools/toolkit/GridController";
import { vec3 } from "wgpu-matrix";
import { GUI } from "dat.gui";

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
camera.lookAt([5, 5, -10], [0, 0, 0]);
const arcball = new ArcballController(camera, renderer.canvas, 0.5);
scene.add(arcball);
scene.add(new GridController());

const amb_light = new AmbientLight([1, 1, 1, 1], 10);
scene.add(amb_light);

const mesh = new Mesh(
  new CubeGeometry(),
  new MeshBasicMaterial({ wireframe: true })
);
mesh.transform.position[1] = 5;
mesh.transform.rotateOnAxis(vec3.normalize(vec3.create(1, 1, 1)), Math.PI / 4);
const rig = mesh.addComponent(RigidBody, {
  velocity: vec3.create(0, -9.8, 0),
});
scene.add(mesh);

const setting = {
  stiffness: rig.stiffness,
  substeps: rig.substeps,
  restart() {},
};
const gui = new GUI();
gui.add(setting, "stiffness", 0, 1).onChange((s) => (rig.stiffness = s));
gui.add(setting, "substeps", 1, 5).onChange((s) => (rig.substeps = s));
gui.add(setting, "restart");

export function frame() {
  scene.render();
  requestAnimationFrame(frame);
}
