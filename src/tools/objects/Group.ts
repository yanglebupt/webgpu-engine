import { EntityObject } from "../entitys/EntityObject";
import { BuildOptions } from "../scene/types";

export class Group extends EntityObject {
  type = "Group";

  constructor(public objects: EntityObject[]) {
    super();
  }

  render(renderPass: GPURenderPassEncoder, device: GPUDevice) {
    this.objects.forEach((object) => object.render(renderPass, device));
  }

  build(options: BuildOptions) {
    this.objects.forEach((object) => object.build(options));
  }
}
