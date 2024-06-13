import { GPUShaderModuleCacheKey } from "../scene/cache";
import { GPUResource } from "../type";
import { Observable } from "../utils/Observable";

export enum WatchAction {
  Geometry = "buildGeometry",
  Material = "buildMaterial",
  Pipeline = "buildPipeline",
  Component = "buildComponent",
}

export interface WatchPropertyKey {
  [key: PropertyKey]: WatchAction[];
}

export abstract class Material implements Observable {
  abstract watch: WatchPropertyKey;
  abstract update(device: GPUDevice): void;
  abstract build(device: GPUDevice): {
    bindGroupLayoutEntries: GPUBindGroupLayoutEntry[];
    resources: GPUResource[];
    fragment: GPUShaderModuleCacheKey<any>;
  };
}
