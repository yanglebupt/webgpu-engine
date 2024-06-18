import { BlendingPreset } from "../utils/Blend";
import { Material, WatchAction } from "./Material";

export abstract class MeshMaterial extends Material {
  ////////////// watch ///////////////////
  wireframe: boolean = false;
  blending?: GPUBlendState;
  blendingPreset?: BlendingPreset;
  // 决定哪些属性的改变，需要 build 哪个部分
  watch = {
    wireframe: [WatchAction.Geometry, WatchAction.Pipeline],
    blending: [WatchAction.Pipeline],
    blendingPreset: [WatchAction.Pipeline],
  };
}
