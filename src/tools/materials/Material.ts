import { GPUShaderModuleCacheKey } from "../scene/cache";
import { BuildOptions } from "../scene/types";
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

export interface ShaderBuildResult {
  bindGroupLayoutEntries: GPUBindGroupLayoutEntry[];
  resources: GPUResource[];
  shader: GPUShaderModuleCacheKey<any>;
}

export abstract class Material implements Observable {
  abstract watch: WatchPropertyKey;
  abstract update(device: GPUDevice): void;
  abstract build(
    options: BuildOptions,
    vertexBindingStart?: number
  ): {
    vertex?: ShaderBuildResult;
    fragment: ShaderBuildResult;
  };
}
