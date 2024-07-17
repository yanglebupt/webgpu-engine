import { OrbitController, PerspectiveCamera } from "../../tools/camera";
import { degToRad } from "../../tools/math";
import { WebGPURenderer } from "../../tools/renderer";
import { Scene } from "../../tools/scene";
import { AmbientLight } from "../../tools/lights";
import { Logger } from "../../tools/helper";
import { Input } from "../../tools/utils/Input";
import { SphereGeometry } from "../../tools/geometrys/SphereGeometry";
import { MeshBasicMaterial } from "../../tools/materials/MeshBasicMaterial";
import { Mesh } from "../../tools/objects/Mesh";
import { Box3Collider } from "../../tools/components/colliders/Box3Collider";
import { RotateScript } from "../18-自己的几何形状/RotateScript";
import { CubeGeometry } from "../../tools/geometrys/CubeGeometry";
import { TorusGeometry } from "../../tools/geometrys/TorusGeometry";
import { PlaneGeometry } from "../../tools/geometrys/PlaneGeometry";
import { CylinderGeometry } from "../../tools/geometrys/CylinderGeometry";
import { CircleGeometry } from "../../tools/geometrys/CircleGeometry";
import { Component } from "../../tools/components/Component";
import { OBBCollider } from "../../tools/components/colliders/OBBCollider";
import { SphereCollider } from "../../tools/components/colliders/SphereCollider";
import { vec3 } from "wgpu-matrix";
import { GridController } from "../../tools/toolkit/GridController";

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

const scene = new Scene(renderer, { development: true, debug: true });

// 创建相机和控制器
const camera = new PerspectiveCamera(degToRad(75), renderer.aspect, 0.1, 100);
camera.lookAt([0, 5, -5], [0, 0, 0]);
const orbitController = new OrbitController(camera, renderer.canvas, {
  zoomSpeed: 0.5,
});
scene.add(orbitController);

const amb_light = new AmbientLight([1, 1, 1, 1], 10);
scene.add(amb_light);

scene.add(new GridController());

// const mesh = new Mesh(new TorusGeometry(), new MeshBasicMaterial());
// mesh.addComponent(RotateScript, { stop: false });
// mesh.addComponent(Box3Collider, { visible: true });
// mesh.addComponent(OBBCollider, { visible: true });
// mesh.addComponent(SphereCollider, { visible: true });
// scene.add(mesh);

const mesh = new Mesh(new PlaneGeometry(), new MeshBasicMaterial());
mesh.transform.rotateX(-Math.PI / 2);
scene.add(mesh);

const mesh2 = new Mesh(new PlaneGeometry(), new MeshBasicMaterial());
mesh2.transform.rotateX(-Math.PI / 2);
scene.add(mesh2);

const input = new Input({
  click: (evt) => {
    const { offsetX, offsetY } = evt as MouseEvent;
    const ray = camera.screenPointToRay(offsetX, offsetY);
    const start = vec3.addScaled(ray.origin, ray.direction, 10);
    const end = vec3.addScaled(ray.origin, ray.direction, 50);
    mesh.transform.position = start;
    mesh2.transform.position = end;
    scene.debugInstance?.drawLines([start, end]);
  },
})
  .targetAt(renderer.canvas)
  .listen();

export function frame() {
  scene.render();
  requestAnimationFrame(frame);
}
