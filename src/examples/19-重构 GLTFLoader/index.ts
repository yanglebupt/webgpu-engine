import { degToRad } from "../../tools/math";
import { GLTFLoaderV2 } from "../../tools/loaders/GLTFLoader-v2";
import { OrbitController, PerspectiveCamera } from "../../tools/camera";
import { Scene } from "../../tools/scene";
import { DirectionLight } from "../../tools/lights";
import { WebGPURenderer } from "../../tools/renderer";
import { Logger } from "../../tools/helper";
import { RotateScript } from "../18-自己的几何形状/RotateScript";

const base = location.href;
Logger.production = false;

// 配置
const config = {
  path: `${base}glTF-Sample-Models/2.0/Sponza/glTF-Binary/Sponza.glb`,
  near: 0.01,
  far: 100,
  eye: [5, 10, 0],
  target: [0, 3, 0],
  zoomSpeed: 10,
};

// 新建一个 WebGPURenderer
const renderer = (await new WebGPURenderer()
  .checkSupport()
  .catch(({ message }) => {
    const div = document.createElement("div");
    div.innerText = message;
    document.body.appendChild(div);
    throw new Error(message);
  })) as WebGPURenderer;

// 创建灯光
const light = new DirectionLight([-1, -1, -1], [1, 1, 1, 1], 8);

// 创建场景对象，并指定环境贴图
const scene = new Scene(renderer);
scene.add(light);

// 创建相机和控制器
const camera = new PerspectiveCamera(
  degToRad(75),
  renderer.aspect,
  config.near,
  config.far
);
camera.lookAt(config.eye);
const orbitController = new OrbitController(camera, renderer.canvas, {
  zoomSpeed: config.zoomSpeed,
});
scene.add(orbitController);

let recordDom = document.createElement("div");
recordDom.className = "record";
document.body.appendChild(recordDom);

// 加载 gltf 模型 或者 obj 模型
const loader = new GLTFLoaderV2();
const model = await loader.load(config.path, { mips: true });
model.addComponent(RotateScript, { stop: false });
scene.add(model);

export async function frame() {
  scene.render();
  requestAnimationFrame(frame);
}
