import { degToRad } from "../../tools/math";
import { GLTFLoaderV2 } from "../../tools/loaders/GLTFLoader-v2";
import { OrbitController, PerspectiveCamera } from "../../tools/camera";
import { ObjLoader } from "../../tools/loaders/ObjLoader";
import { GUI } from "dat.gui";
import { Scene } from "../../tools/scene";
import { DirectionLight } from "../../tools/lights";
import { WebGPURenderer } from "../../tools/renderer";
import { CreateAndSetRecord } from "../../tools/loaders";
import { LoaderBarDomElement } from "./loaderBar";

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
let changed = true;
const settings = {
  model_name: "stone_demon",
  mips: true,
  flux: 10.0,
};
const gui = new GUI();
gui
  .add(settings, "model_name", Object.keys(model_gltf_configs))
  .onChange(() => (changed = true));
gui.add(settings, "mips").onChange(() => (changed = true));
gui.add(settings, "flux", 1, 40);

const parentDom = document.createElement("div");
parentDom.id = "canvas-parent";
document.body.appendChild(parentDom);
const loadingBar = new LoaderBarDomElement(parentDom);

// 新建一个 WebGPURenderer
const renderer = (await new WebGPURenderer({
  parentID: parentDom.id,
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
  loadingBar.showLoading();
  const model = await loader.load(renderer.device, config.path, {
    bindGroupLayouts: [scene.bindGroupLayout],
    format: renderer.format,
    mips: settings.mips,
    record: new CreateAndSetRecord(),
    onProgress: (name: string, percentage: number) => {
      loadingBar.setPercentage(percentage, name);
    },
  });
  loadingBar.hiddenLoading();
  scene.add(model);
  return scene;
}

let recordDom = document.createElement("div");
recordDom.className = "record";
document.body.appendChild(recordDom);

let scene: Scene;
export async function frame() {
  if (changed) {
    scene = await init();
  }
  light.flux = settings.flux;
  renderer?.render(scene, (record) => {
    if (changed)
      recordDom.innerHTML = `
<div>pipelineCount: ${record.pipelineCount}</div>
<div>pipelineSets: ${record.pipelineSets}</div>
<div>bindGroupCount: ${record.bindGroupCount}</div>
<div>bindGroupSets: ${record.bindGroupSets}</div>
<div>bufferSets: ${record.bufferSets}</div>
<div>drawCount: ${record.drawCount}</div>
`;
  });
  changed = false;
  requestAnimationFrame(frame);
}
