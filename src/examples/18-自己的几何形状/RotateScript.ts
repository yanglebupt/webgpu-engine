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
  stop: boolean = false;
  update(dt: number, t: number) {
    if (this.stop) return;
    this.transform.rotation[1] = t * this.speed;
  }
}
