import { vec3 } from "wgpu-matrix";
import { EntityObjectComponent } from "../../tools/components/Component";
import { Mesh } from "../../tools/objects/Mesh";

export class RotateScript extends EntityObjectComponent<Mesh> {
  speed: number = 1;
  stop: boolean = true;
  protected update(dt: number, t: number) {
    if (this.stop) return;
    this.transform.rotateOnAxis(vec3.create(1, 1, 0), dt * this.speed);
    this.transform.position[0] = Math.sin(t * this.speed);
  }
}
