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
import { EffectComposer } from "../../tools/postprocess/EffectComposer";
import { RenderPass } from "../../tools/postprocess/RenderPass";
import fragment from "./shaders/fragments/test.wgssl";
import compute from "./shaders/computes/test.wgssl";
import { ComputePass } from "../../tools/postprocess/ComputePass";
import { Uniform } from "../../tools/textures/ResourceBuffer";
import { GlitchPass } from "../../tools/postprocess/GlitchPass";
import { ShaderMaterial } from "../../tools/materials/ShaderMaterial";
import m_vertex from "./material/vertex.wgssl";
import m_fragment from "./material/fragment.wgssl";

// 新建一个 WebGPURenderer
const renderer = (await new WebGPURenderer({
  canvasConfig: { config: { virtual: true } },
})
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
const model = await new ObjLoader().load("/standalone/mesh_StoneDeamon.obj");
model.material = new MeshPhysicalMaterial({
  baseColorTexture,
  normalTexture,
  metallicRoughnessTexture,
  emissiveTexture,
});
const mesh = new Mesh(new CubeGeometry(), new MeshBasicMaterial());
const cpn_1 = mesh.addComponent(RotateScript);
const cpn_2 = model.addComponent(RotateScript);
scene.add(mesh);
scene.add(model);

const plane = new Mesh(
  new PlaneGeometry({ width: 2, height: 2 }),
  new ShaderMaterial({
    vertex: m_vertex,
    fragment: { shaderCode: m_fragment, context: { useDefault: false } },
    resourceViews: {
      vertex: [new Uniform("uni", { color: [1, 1, 0, 1] })],
    },
  })
);
scene.add(plane);

const texture = await new Texture("/coins.jpg").load();
const composer = new EffectComposer(scene);

const pass = new RenderPass(fragment, [
  new Uniform("uni", { li: 0.2 }),
  texture,
]);

// const pass = new ComputePass(compute, [
//   new Uniform("uni", { li: 0.2 }),
//   texture,
// ]);

composer.addPass(pass);

const pass_2 = new GlitchPass();
composer.addPass(pass_2);

const settings = {
  color: [255, 0, 0, 255],
  wireframe: false,
  stop: true,
  metallicFactor: 1,
  roughnessFactor: 1,
  li: 0.2,
};
const gui = new GUI();
gui
  .addColor(settings, "color")
  .onChange(
    (c: number[]) =>
      ((mesh.material as MeshBasicMaterial).color = c.map((v) => v / 255))
  );
gui.add(settings, "wireframe").onChange((w) => {
  mesh.material.wireframe = w;
  model.material.wireframe = w;
});
gui
  .add(settings, "metallicFactor", 0, 1, 0.1)
  .onChange(
    (m) => ((model.material as MeshPhysicalMaterial).metallicFactor = m)
  );
gui
  .add(settings, "roughnessFactor", 0, 1, 0.1)
  .onChange(
    (r) => ((model.material as MeshPhysicalMaterial).roughnessFactor = r)
  );
gui.add(settings, "stop").onChange((s) => {
  cpn_1.stop = s;
  cpn_2.stop = s;
});

gui.add(settings, "li", 0.01, 2).onChange((l) => {
  (pass.resourceViews[0] as Uniform).value.li = l;
});

export function frame() {
  composer.render();
  // scene.render();
  requestAnimationFrame(frame);
}
