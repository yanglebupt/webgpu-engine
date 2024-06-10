import { BlendingPreset } from "../utils/Blend";
import { Material } from "./Material";

export abstract class MeshMaterial extends Material {
  ////////////// watch ///////////////////
  public wireframe: boolean = false;
  public blending?: GPUBlendState;
  public blendingPreset?: BlendingPreset;
  // 决定哪些属性的改变，需要 build 哪个部分
  watch: PropertyKey[] = ["wireframe", "blending", "blendingPreset"];
}
