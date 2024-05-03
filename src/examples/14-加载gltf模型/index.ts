import { checkWebGPUSupported, createCanvas } from "../../tools";
import { degToRad } from "../../tools/math";
import { StaticTextureUtils } from "../../tools/utils";
import { GLTFLoaderV2 } from "../../tools/loaders/GLTFLoader-v2";
import { CreateAndSetRecord } from "../../tools/loaders";
import { OrbitController, PerspectiveCamera } from "../../tools/camera";
import { ObjLoader } from "../../tools/loaders/ObjLoader";
import { GUI } from "dat.gui";

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
  model_name: "buggy",
};
const gui = new GUI();
gui
  .add(settings, "model_name", Object.keys(model_gltf_configs))
  .onChange(() => (changed = true));

// 初始化 GPUDevice 和 canvas
const { device, format } = await checkWebGPUSupported();
const { ctx, canvas, aspect } = createCanvas(500, 500, { device, format });

async function init() {
  // 选择加载哪个模型
  const model_name = settings.model_name;
  const config = model_gltf_configs[model_name];

  // 设置记录
  const record = new CreateAndSetRecord();

  const bindGroupLayouts = [];

  // 创建相机
  const camera = new PerspectiveCamera(
    device,
    degToRad(75),
    aspect,
    config.near,
    config.far
  );
  camera.lookAt(config.eye, config.target);
  const orbitController = new OrbitController(camera, canvas, {
    zoomSpeed: config.zoomSpeed,
  });
  bindGroupLayouts.push(camera.bindGrouplayout);

  // 加载 gltf 模型 或者 obj 模型
  const loader = model_name === "bunny" ? new ObjLoader() : new GLTFLoaderV2();
  const scene = await loader.load(device, config.path, {
    bindGroupLayouts,
    format,
    record,
  });

  return { orbitController, scene };
}

let print = false;
let renderObj = await init();

export async function frame() {
  if (changed) {
    renderObj = await init();
    print = false;
    changed = false;
  }
  const { orbitController, scene } = renderObj;
  const canvasTexture = ctx.getCurrentTexture();
  const depthTexture = StaticTextureUtils.createDepthTexture(device, [
    canvasTexture.width,
    canvasTexture.height,
  ]);
  const encoder = device.createCommandEncoder();
  const pass = encoder.beginRenderPass({
    colorAttachments: [
      {
        loadOp: "clear",
        storeOp: "store",
        view: canvasTexture.createView(),
      },
    ],
    depthStencilAttachment: {
      depthClearValue: 1.0,
      depthLoadOp: "clear",
      depthStoreOp: "store",
      view: depthTexture.createView(),
    },
  });
  // 渲染
  orbitController.render(pass, device);
  const record = scene.render(pass);
  pass.end();
  device.queue.submit([encoder.finish()]);
  requestAnimationFrame(frame);
  if (!print) {
    console.log(record);
    print = true;
  }
}
