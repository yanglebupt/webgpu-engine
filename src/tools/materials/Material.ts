import { GPUShaderModuleCacheKey } from "../scene/cache";
import { BuildOptions, Buildable, Updatable } from "../scene/types";
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

export abstract class Material implements Buildable, Updatable, Observable {
  abstract watch: WatchPropertyKey;
  abstract update(device: GPUDevice): void;
  abstract build(
    options: BuildOptions,
    bindGroupLayoutEntries?: GPUBindGroupLayoutEntry[]
  ): {
    bindGroupIndex: number;
    bindGroupLayout: GPUBindGroupLayout;
    bindGroupLayouts: GPUBindGroupLayout[];
    resources: GPUResource[];
    fragment: GPUShaderModuleCacheKey<any>;
  };
}
