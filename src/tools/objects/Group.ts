import { EntityObject } from "../entitys/EntityObject";

export class Group extends EntityObject {
  type = "Group";

  constructor(public children: EntityObject[]) {
    super();
    this.children.forEach((child) => (child.parent = this.transform));
  }
}
