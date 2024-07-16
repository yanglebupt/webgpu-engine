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
camera.lookAt([0, 0, -10], [0, 0, 0]);
const orbitController = new OrbitController(camera, renderer.canvas, {
  zoomSpeed: 0.5,
});
scene.add(orbitController);

const amb_light = new AmbientLight([1, 1, 1, 1], 10);
scene.add(amb_light);

const mesh = new Mesh(new TorusGeometry(), new MeshBasicMaterial());
mesh.addComponent(RotateScript, { stop: false });
mesh.addComponent(Box3Collider, { visible: true });
mesh.addComponent(OBBCollider, { visible: true });
mesh.addComponent(SphereCollider, { visible: true });

scene.add(mesh);

const input = new Input({
  click: (evt) => {
    const { offsetX, offsetY } = evt as MouseEvent;
    const x = 2 * (offsetX / renderer.width) - 1;
    const y = 1 - 2 * (offsetY / renderer.height);

    const worldPos = camera.screenToWorldPoint(x, y, 0);
    mesh.transform.position = worldPos;
  },
}).targetAt(renderer.canvas);
// .listen();

export function frame() {
  scene.render();
  requestAnimationFrame(frame);
}
