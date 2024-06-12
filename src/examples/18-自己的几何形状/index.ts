import { GUI } from "dat.gui";
import { OrbitController, PerspectiveCamera } from "../../tools/camera";
import { degToRad } from "../../tools/math";
import { WebGPURenderer } from "../../tools/renderer";
import { Scene } from "../../tools/scene";
import { Mesh } from "../../tools/objects/Mesh";
import { PlaneGeometry } from "../../tools/geometrys/PlaneGeometry";
import { MeshBasicMaterial } from "../../tools/materials/MeshBasicMaterial";
import { CircleGeometry } from "../../tools/geometrys/CircleGeometry";
import { SphereGeometry } from "../../tools/geometrys/SphereGeometry";
import { CylinderGeometry } from "../../tools/geometrys/CylinderGeometry";
import { TorusGeometry } from "../../tools/geometrys/TorusGeometry";
import { CubeGeometry } from "../../tools/geometrys/CubeGeometry";
import { BlendingPreset } from "../../tools/utils/Blend";
import "./index.css";
import { Clock } from "../../tools/utils/Clock";
import { RotateScript, RotateScriptOptions } from "./RotateScript";
import { ObjLoader } from "../../tools/loaders/ObjLoader";

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
camera.lookAt([0, 1, -2], [0, 0, 0]);
const orbitController = new OrbitController(camera, renderer.canvas, {
  zoomSpeed: 0.5,
});
scene.add(orbitController);

const mesh = new Mesh(new CubeGeometry(), new MeshBasicMaterial());
// const mesh = await new ObjLoader().load("bunny/bunny.obj");
const cpn = mesh.addComponent(RotateScript);
scene.add(mesh);

const settings = {
  color: [255, 0, 0, 255],
  wireframe: false,
  stop: false,
};
const gui = new GUI();
gui
  .addColor(settings, "color")
  .onChange(
    (color: number[]) => (mesh.material.color = color.map((v) => v / 255))
  );
gui.add(settings, "wireframe");
gui.add(settings, "stop").onChange((s) => (cpn.stop = s));

export function frame() {
  mesh.material.wireframe = settings.wireframe;
  scene.render();
  requestAnimationFrame(frame);
}
