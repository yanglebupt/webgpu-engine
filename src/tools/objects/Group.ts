import { EntityObject } from "../entitys/EntityObject";

export class Group extends EntityObject {
  type = "Group";

  updateBuffers(device: GPUDevice) {}

  constructor(public children: EntityObject[] = []) {
    super();
    this.children.forEach((child) => (child.parent = this.transform));
  }
}
