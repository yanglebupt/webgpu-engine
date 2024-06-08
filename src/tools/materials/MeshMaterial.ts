import { BlendingPreset } from "../utils/Blend";
import { Material } from "./Material";

export abstract class MeshMaterial extends Material {
  ////////////// watch ///////////////////
  public wireframe: boolean = false;
  public blending?: GPUBlendState;
  public blendingPreset?: BlendingPreset;
  watch: PropertyKey[] = ["wireframe", "blending", "blendingPreset"];
}
