import { PerspectiveCamera } from "../../tools/cameras/Camera";
import { degToRad } from "../../tools/math";
import { WebGPURenderer } from "../../tools/renderer";
import { Scene } from "../../tools/scene";
import { Mesh } from "../../tools/objects/Mesh";
import { MeshBasicMaterial } from "../../tools/materials/MeshBasicMaterial";
import { CubeGeometry } from "../../tools/geometrys/CubeGeometry";
import { AmbientLight } from "../../tools/lights";
import { RotateScript } from "../18-自己的几何形状/RotateScript";
import { Logger } from "../../tools/helper";
import { GUI } from "dat.gui";
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

const scene = new Scene(renderer);

// 创建相机和控制器
const camera = new PerspectiveCamera(degToRad(75), renderer.aspect, 0.1, 100);
camera.lookAt([0, 1, -5], [0, 0, 0]);
const arcball = new ArcballController(camera, renderer.canvas, 0.5);
scene.add(arcball);

const amb_light = new AmbientLight([1, 1, 1, 1], 10);
scene.add(amb_light);

const mesh = new Mesh(new CubeGeometry(), new MeshBasicMaterial());
const cpn = mesh.addComponent(RotateScript, { speed: 1, stop: false });
scene.add(mesh);

const setting = {
  color: [255, 0, 0, 255],
  wireframe: false,
  active: true,
};
const gui = new GUI();
gui.addColor(setting, "color").onChange((v: number[]) => {
  mesh.material.color = v.map((v) => v / 255);
});

gui.add(setting, "wireframe").onChange((v) => {
  mesh.material.wireframe = v;
});
gui.add(setting, "active").onChange((v) => {
  mesh.active = v;
});

export function frame() {
  scene.render();
  requestAnimationFrame(frame);
}
