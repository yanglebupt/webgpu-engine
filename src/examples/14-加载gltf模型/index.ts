import { checkWebGPUSupported, createCanvas } from "../../tools";
import { degToRad } from "../../tools/math";
import { StaticTextureUtils } from "../../tools/utils";
import { GLTFLoaderV2 } from "../../tools/loaders/GLTFLoader-v2";
import { OrbitController, PerspectiveCamera } from "../../tools/camera";
import { ObjLoader } from "../../tools/loaders/ObjLoader";
import { GUI } from "dat.gui";
import { Scene } from "../../tools/scene";
import { DirectionLight, PointLight } from "../../tools/lights";
import { WebGPURenderer } from "../../tools/renderer";

const base = location.href;

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
  bunny: {
    path: `${base}bunny/bunny-export.obj`,
    near: 1,
    far: 100,
    eye: [0, 2, 5],
    target: [0, 0, 0],
  },
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
let changed = false;
const settings = {
  model_name: "stone_demon",
  mips: false,
  flux: 10.0,
};
const gui = new GUI();
gui
  .add(settings, "model_name", Object.keys(model_gltf_configs))
  .onChange(() => (changed = true));
gui.add(settings, "mips").onChange(() => (changed = true));
gui.add(settings, "flux", 1, 40);

// 新建一个 WebGPURenderer
const renderer = await new WebGPURenderer().checkSupport(({ message }) => {
  const div = document.createElement("div");
  div.innerText = message;
  document.body.appendChild(div);
});

// 创建灯光
const light = new DirectionLight([-1, -1, -1], [1, 1, 1, 1], 10);

async function init() {
  // 选择加载哪个模型
  const config = model_gltf_configs[settings.model_name];

  // 创建场景对象
  const scene = new Scene(renderer.device);
  scene.add(light);

  // 创建相机和控制器
  const camera = new PerspectiveCamera(
    degToRad(75),
    renderer.aspect,
    config.near,
    config.far
  );
  camera.lookAt(config.eye, config.target);
  const orbitController = new OrbitController(camera, renderer.canvas, {
    zoomSpeed: config.zoomSpeed,
  });
  scene.add(orbitController);

  // 加载 gltf 模型 或者 obj 模型
  const loader = config.path.endsWith(".obj")
    ? new ObjLoader()
    : new GLTFLoaderV2();
  const model = await loader.load(renderer.device, config.path, {
    bindGroupLayouts: [scene.bindGroupLayout],
    format: renderer.format,
    mips: settings.mips,
  });
  scene.add(model);
  return scene;
}

let scene = await init();

export async function frame() {
  if (changed) {
    scene = await init();
    changed = false;
  }
  light.flux = settings.flux;
  renderer.render(scene);
  requestAnimationFrame(frame);
}
