import { Transform } from "../components/Transform";

export class EntityObject {
  transform: Transform;
  constructor() {
    this.transform = new Transform();
  }
  addComponent() {}
  removeComponent() {}
  getComponent() {}
}
