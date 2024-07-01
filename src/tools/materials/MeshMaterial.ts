import { BlendingPreset } from "../utils/Blend";
import { Material } from "./Material";

export abstract class MeshMaterial extends Material {
  wireframe: boolean = false;
  blending?: GPUBlendState;
  blendingPreset?: BlendingPreset;
}
