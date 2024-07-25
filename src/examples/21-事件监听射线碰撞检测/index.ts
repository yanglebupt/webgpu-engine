import { PerspectiveCamera } from "../../tools/cameras/Camera";
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
import { vec2, Vec3, vec3, vec4 } from "wgpu-matrix";
import { GridController } from "../../tools/toolkit/GridController";
import { ArcballController } from "../../tools/cameras/ArcballController";
import { Sphere } from "../../tools/maths/Sphere";
import { Plane } from "../../tools/maths/Plane";
import { Ray } from "../../tools/maths/Ray";
import { Box3 } from "../../tools/maths/Box3";
import { Intersection } from "../../tools/maths/Intersection";
import { Collider } from "../../tools/components/colliders/Collider";

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
camera.lookAt([0, 1, -5], [0, 0, 0]);
const arcball = new ArcballController(camera, renderer.canvas, 0.5);
scene.add(arcball);

const amb_light = new AmbientLight([1, 1, 1, 1], 10);
scene.add(amb_light);

scene.add(new GridController());

// //////////////// 各种 Collider 可视化 ////////////////
// const mesh = new Mesh(
//   new TorusGeometry(),
//   new MeshBasicMaterial({ wireframe: false })
// );
// mesh.addComponent(RotateScript, { stop: false });
// mesh.addComponent(Box3Collider, { visible: true });
// mesh.addComponent(OBBCollider, { visible: true });
// mesh.addComponent(SphereCollider, { visible: true });
// scene.add(mesh);

//////////////// 射线 ////////////////
// const mesh = new Mesh(new CubeGeometry(), new MeshBasicMaterial());
// mesh.material.wireframe = true;
// mesh.transform.rotateY(Math.PI / 4);
// const box = mesh.addComponent(OBBCollider).obb;
// scene.add(mesh);

// const input = new Input({
//   click: (evt) => {
//     const { offsetX, offsetY } = evt as MouseEvent;
//     const ray = camera.screenPointToRay(offsetX, offsetY);

//     // const ray = new Ray(vec3.create(0, -2, 0));
//     // ray.passPoint(vec3.create(-3, 3, 0));

//     const start = vec3.addScaled(ray.origin, ray.direction, 0);
//     const end = vec3.addScaled(ray.origin, ray.direction, 50);
//     const v = vec3.create(start[0], start[1], start[2]);
//     Intersection.intersectRayOBB(ray, box, end);
//     if (Intersection.intersectsRayOBB(ray, box)) {
//       mesh.material.color = [0, 1, 0, 1];
//       console.log("inter");
//     } else {
//       mesh.material.color = [1, 0, 0, 1];
//     }
//     scene.debugInstance?.drawLines([start, end], [start, v]);
//   },
// })
//   .targetAt(renderer.canvas)
//   .listen();

//////////////// Collider 碰撞测试 ////////////////
const createMesh = <C extends new (...argList: any) => Collider<any>>(
  collider: C,
  position: Vec3,
  offset: number
) => {
  const mesh = new Mesh(new CubeGeometry(), new MeshBasicMaterial());
  // @ts-ignore
  const cpn = mesh.addComponent(collider, { visible: true });
  mesh.addComponent(RotateScript, {
    stop: false,
    startPosX: position[0],
    offset,
  });
  mesh.transform.scale = vec3.create(0.5, 0.5, 0.5);
  mesh.transform.position = position;
  mesh.transform.rotateY(Math.PI / 4);
  scene.add(mesh);
  return [cpn as InstanceType<C>, mesh.material] as const;
};

const [c1, m1] = createMesh(Box3Collider, vec3.create(2, 0, 0), Math.PI / 4);
const [c2, m2] = createMesh(OBBCollider, vec3.create(0, 0, 0), 0);
const [c3, m3] = createMesh(SphereCollider, vec3.create(-2, 0, 0), Math.PI / 4);

const tryIntersection = () => {
  let i = Intersection.intersects(c1, c2) || Intersection.intersects(c1, c3);
  m1.color = i ? [0, 1, 0, 1] : [1, 0, 0, 1];

  i = Intersection.intersects(c1, c2) || Intersection.intersects(c3, c2);
  m2.color = i ? [0, 1, 0, 1] : [1, 0, 0, 1];

  i = Intersection.intersects(c3, c2) || Intersection.intersects(c1, c3);
  m3.color = i ? [0, 1, 0, 1] : [1, 0, 0, 1];
};

export function frame() {
  scene.render();
  tryIntersection();
  requestAnimationFrame(frame);
}
