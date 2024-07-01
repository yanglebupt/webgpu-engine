import { GPUShaderModuleCacheKey } from "../scene/cache";
import { BuildOptions } from "../scene/types";
import { GPUResource } from "../type";
import { Observable, ObservableActionParams } from "../utils/Observable";

export interface ShaderBuildResult {
  bindGroupLayoutEntries: GPUBindGroupLayoutEntry[];
  resources: GPUResource[];
  shader: GPUShaderModuleCacheKey<any>;
}

export abstract class Material implements Observable {
  protected device!: GPUDevice;
  abstract onChange(p: ObservableActionParams): void;
  abstract build(options: BuildOptions): {
    vertex?: ShaderBuildResult;
    fragment: ShaderBuildResult;
  };
}
