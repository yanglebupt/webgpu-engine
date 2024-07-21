import { vec3 } from "wgpu-matrix";
import { EntityObjectComponent } from "../../tools/components/Component";
import { Mesh } from "../../tools/objects/Mesh";

export class RotateScript extends EntityObjectComponent<Mesh> {
  speed: number = 1;
  stop: boolean = true;
  startPosX: number = 0;
  offset: number = 0;
  protected update(dt: number, t: number) {
    if (this.stop) return;
    this.transform.rotateOnAxis(
      vec3.normalize(vec3.create(1, 1, 0)), // 注意轴要单位化
      dt * this.speed
    );
    // this.transform.rotateY(dt * this.speed);
    this.transform.position[0] =
      this.startPosX + Math.sin(t * this.speed + this.offset);
    for (let i = 0; i < 3; i++) {
      this.transform.scale[i] = 0.8 + 0.5 * Math.sin(t * this.speed);
    }
  }
}
