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
import { MeshPhysicalMaterial } from "../../tools/materials/MeshPhysicalMaterial";
import { Texture } from "../../tools/textures/Texture";
import { AmbientLight, DirectionLight } from "../../tools/lights";

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
const orbitController = new OrbitController(camera, renderer.canvas, {
  zoomSpeed: 0.5,
});
scene.add(orbitController);

const amb_light = new AmbientLight([1, 1, 1, 1], 10);
scene.add(amb_light);

const baseColorTexture = await new Texture(
  "/standalone/image_imageStoneDemonAlbedo1024.png"
).load();
const normalTexture = await new Texture(
  "/standalone/image_imageStoneDemonNormal1024.png"
).load();
const metallicRoughnessTexture = await new Texture(
  "/standalone/image_MergedTexturesmetallicRoughness.png",
  { flipY: false }
).load();
const emissiveTexture = await new Texture(
  "/standalone/image_imageStoneDemonEmissionColor1024.png"
).load();
const mesh = new Mesh(
  new CubeGeometry(),
  new MeshPhysicalMaterial({
    baseColorTexture,
    normalTexture,
    metallicRoughnessTexture,
    emissiveTexture,
  })
);
const cpn = mesh.addComponent(RotateScript);
scene.add(mesh);

const settings = {
  color: [255, 0, 0, 255],
  wireframe: false,
  stop: true,
  metallicFactor: 1,
  roughnessFactor: 1,
};
const gui = new GUI();
gui.addColor(settings, "color");
gui.add(settings, "wireframe");
gui.add(settings, "metallicFactor", 0, 1, 0.1);
// .onChange((m) => (mesh.material.metallicFactor = m));
gui.add(settings, "roughnessFactor", 0, 1, 0.1);
// .onChange((r) => (mesh.material.roughnessFactor = r));
gui.add(settings, "stop").onChange((s) => (cpn.stop = s));

export function frame() {
  mesh.material.wireframe = settings.wireframe;
  scene.render();
  requestAnimationFrame(frame);
}
