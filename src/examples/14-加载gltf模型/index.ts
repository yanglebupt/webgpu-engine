import { degToRad } from "../../tools/math";
import { GLTFLoaderV2, GLTFScene } from "../../tools/loaders/GLTFLoader-v2";
import { PerspectiveCamera } from "../../tools/cameras/Camera";
import { GUI } from "dat.gui";
import { Scene } from "../../tools/scene";
import { DirectionLight, PointLight } from "../../tools/lights";
import { WebGPURenderer } from "../../tools/renderer";
import { LoaderBarDomElement } from "./loaderBar";
import { EnvMapLoader } from "../../tools/utils/envmap";
import { Logger } from "../../tools/helper";
import { ArcballController } from "../../tools/cameras/ArcballController";

const base = location.href;
Logger.production = false;

// 配置
const model_gltf_configs: Record<
  string,
  {
    path: string;
    near: number;
    far: number;
    eye: number[];
    target?: number[];
    zoomSpeed?: number;
  }
> = {
  avocado: {
    path: `${base}gltf/Avocado.glb`,
    near: 0.01,
    far: 1000,
    eye: [0, 0, 0.2],
    zoomSpeed: 0.5,
  },
  cylinder_engine: {
    path: `${base}gltf/2CylinderEngine.glb`,
    near: 0.01,
    far: 1000,
    eye: [0, 0, 700],
    zoomSpeed: 70,
  },
  stone_demon: {
    path: `${base}gltf/stone_demon.glb`,
    near: 0.01,
    far: 1000,
    eye: [0, 3, 3],
    zoomSpeed: 5,
  },
  antique_camera: {
    path: `${base}glTF-Sample-Models/2.0/AntiqueCamera/glTF-Binary/AntiqueCamera-Interleaved.glb`,
    near: 0.01,
    far: 100,
    eye: [0, 10, 5],
    target: [0, 4, 0],
    zoomSpeed: 5,
  },
  buggy: {
    path: `${base}glTF-Sample-Models/2.0/Buggy/glTF-Binary/Buggy.glb`,
    near: 0.01,
    far: 1000,
    eye: [100, 200, 0],
    target: [0, 0, 0],
    zoomSpeed: 30,
  },
  corset: {
    path: `${base}glTF-Sample-Models/2.0/Corset/glTF-Binary/Corset.glb`,
    near: 0.01,
    far: 1000,
    eye: [0.1, 0.1, 0],
    target: [0, 0.01, 0],
    zoomSpeed: 1,
  },
  damaged_helmet: {
    path: `${base}glTF-Sample-Models/2.0/DamagedHelmet/glTF-Binary/DamagedHelmet.glb`,
    near: 0.01,
    far: 100,
    eye: [0, 0, 5],
    target: [0, 0, 0],
    zoomSpeed: 30,
  },
  flight_helmet: {
    path: `${base}glTF-Sample-Models/2.0/FlightHelmet/glTF-Binary/FlightHelmet.glb`,
    near: 0.01,
    far: 100,
    eye: [1, 1, 0],
    target: [0, 0.5, 0],
    zoomSpeed: 5,
  },
  sponza: {
    path: `${base}glTF-Sample-Models/2.0/Sponza/glTF-Binary/Sponza.glb`,
    near: 0.01,
    far: 100,
    eye: [5, 10, 0],
    target: [0, 3, 0],
    zoomSpeed: 10,
  },
};

// settings
let changed = true;
const settings = {
  model_name: "stone_demon",
  flux: 10.0,
  posLightY: 2.2,
  hasEnvMap: true,
};
const gui = new GUI();
gui
  .add(settings, "model_name", Object.keys(model_gltf_configs))
  .onChange(() => (changed = true));
gui.add(settings, "flux", 1, 40);
gui.add(settings, "posLightY", 0, 5).name("点光源 Y 位置"); // 后面我们会将物体平移到原点，这样就能看清点光源的移动了
gui.add(settings, "hasEnvMap");

const parentDom = document.createElement("div");
parentDom.id = "canvas-parent";
document.body.appendChild(parentDom);
const loadingBar = new LoaderBarDomElement(parentDom);

// 新建一个 WebGPURenderer
const renderer = (await new WebGPURenderer({
  canvasConfig: { parentID: parentDom.id },
})
  .checkSupport()
  .catch(({ message }) => {
    const div = document.createElement("div");
    div.innerText = message;
    document.body.appendChild(div);
    throw new Error(message);
  })) as WebGPURenderer;

// 创建灯光
const light = new DirectionLight([-1, -1, -1], [1, 1, 1, 1], 10);
const light_2 = new PointLight([0, 2.2, 0], [1, 0, 0, 1], 100);

const hdr_filename = `${base}image_imageBlaubeurenNight1k.hdr`;
const envMap = await new EnvMapLoader().load(hdr_filename);

async function init() {
  // 重新开启 mipmap 生成通道
  renderer.cached.mipmap.reopen();

  // 选择加载哪个模型
  const config = model_gltf_configs[settings.model_name];

  // 创建场景对象，并指定环境贴图
  const scene = new Scene(renderer, {
    envMap: settings.hasEnvMap ? envMap : undefined,
  });
  scene.add(light);
  scene.add(light_2);

  // 创建相机和控制器
  const camera = new PerspectiveCamera(
    degToRad(75),
    renderer.aspect,
    config.near,
    config.far
  );
  camera.lookAt(config.eye, config.target);
  const arcball = new ArcballController(
    camera,
    renderer.canvas,
    config.zoomSpeed
  );
  scene.add(arcball);

  // 加载 gltf 模型 或者 obj 模型
  const loader = new GLTFLoaderV2();
  loadingBar.showLoading();
  const model = await loader.load(config.path, {
    mips: true,
    useEnvMap: true,
    onProgress: (name: string, percentage: number) => {
      loadingBar.setPercentage(percentage, name);
    },
  });
  loadingBar.hiddenLoading();
  scene.add(model);
  return { scene, model };
}

let recordDom = document.createElement("div");
recordDom.className = "record";
document.body.appendChild(recordDom);

let scene: Scene;
let model: GLTFScene;

export async function frame() {
  if (changed) {
    const res = await init();
    scene = res.scene;
    model = res.model;
  }
  light.flux = settings.flux;
  light_2.pos[1] = settings.posLightY;
  scene.hasEnvMap = settings.hasEnvMap;
  scene.render();
  changed = false;
  requestAnimationFrame(frame);
}
