import { Material } from "./Material";

export abstract class MeshMaterial extends Material {
  ////////////// watch ///////////////////
  public wireframe: boolean = false;
  watch: PropertyKey[] = ["wireframe"];
}
