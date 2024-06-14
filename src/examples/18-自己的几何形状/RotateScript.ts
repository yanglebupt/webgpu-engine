import { vec3 } from "wgpu-matrix";
import { EntityObjectComponent } from "../../tools/components/Component";
import { Mesh } from "../../tools/objects/Mesh";

export interface RotateScriptOptions {
  speed: number;
}

export class RotateScript
  extends EntityObjectComponent<RotateScriptOptions, Mesh>
  implements RotateScriptOptions
{
  speed: number = 1;
  stop: boolean = true;
  update(dt: number, t: number) {
    if (this.stop) return;
    this.transform.rotateOnAxis(vec3.create(1, 1, 0), dt * this.speed);
    this.transform.position[0] = Math.sin(t * this.speed);
  }
}
