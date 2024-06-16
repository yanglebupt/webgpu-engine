import { BuildOptions } from "../scene/types";
import {
  EnvMapGroupBinding,
  LightGroupBinding,
  MTransformationMatrixGroupBinding,
  M_INSTANCE_NAME,
  ShaderCode,
  VPTransformationMatrixGroupBinding,
  VP_NAME,
} from "../shaders";
import { GPUResourceView } from "../type";
import { MeshMaterial } from "./MeshMaterial";
import {
  ShaderCodeWithContext,
  getAddonBindGroupLayoutEntries,
  getResourcesfromViews,
  injectShaderCode,
  updateResourceViews,
} from "..";
import { ShaderBuildResult } from "./Material";
import { GPUSamplerCache } from "../scene/cache";

// need inject in main function
export const Transform = /*wgsl*/ `
let projectionMatrix = ${VP_NAME}.projectionMatrix;
let viewMatrix = ${VP_NAME}.viewMatrix;
let modelTransform = ${M_INSTANCE_NAME}[instanceIndex];
let modelMatrix = modelTransform.modelMatrix;
let normalMatrix = modelTransform.normalMatrix;`;

export interface ShaderMaterial {
  envmap: boolean;
  lighting: boolean;
  // 自定义资源
  resourceViews?: {
    vertex?: Array<GPUResourceView>;
    fragment?: Array<GPUResourceView>;
  };
}

export class ShaderMaterial extends MeshMaterial {
  static InjectVertexShaderCode = /*wgsl*/ `
  ${VPTransformationMatrixGroupBinding}
  ${MTransformationMatrixGroupBinding}
  `;

  static InjectFragmentShaderCode = /*wgsl*/ `
  ${LightGroupBinding}
  ${EnvMapGroupBinding}
  `;

  private vertex: ShaderCodeWithContext;
  private fragment: ShaderCodeWithContext;
  private vertexBuildResult: ShaderBuildResult;
  private fragmentBuildResult: ShaderBuildResult;

  constructor(
    options: Partial<ShaderMaterial> & {
      vertex: ShaderCodeWithContext | ShaderCode;
      fragment: ShaderCodeWithContext | ShaderCode;
    }
  ) {
    super();
    this.vertex = this.contextShaderCode(options.vertex);
    this.fragment = this.contextShaderCode(options.fragment);
    this.envmap = options.envmap ?? false;
    this.lighting = options.lighting ?? false;
    this.resourceViews = options.resourceViews;

    this.vertexBuildResult = this.injectShaderCode(
      this.vertex,
      ShaderMaterial.InjectVertexShaderCode
    );

    let fragmentInject = this.envmap
      ? `
    ${EnvMapGroupBinding}`
      : "";
    fragmentInject += this.lighting
      ? `
    ${LightGroupBinding}`
      : "";
    this.fragmentBuildResult = this.injectShaderCode(
      this.fragment,
      fragmentInject
    );
  }

  contextShaderCode(code: ShaderCodeWithContext | ShaderCode) {
    const shaderCode = Object.hasOwn(code, "context")
      ? (code as ShaderCodeWithContext)
      : { shaderCode: code as ShaderCode, context: {} };
    return shaderCode;
  }

  injectShaderCode(
    code: ShaderCodeWithContext,
    inject: string | Function = "",
    ...injectContext: any[]
  ) {
    return {
      bindGroupLayoutEntries: [],
      resources: [],
      shader: injectShaderCode(code, inject, ...injectContext),
    };
  }

  update(device: GPUDevice) {
    updateResourceViews(device, this.resourceViews?.vertex);
    updateResourceViews(device, this.resourceViews?.fragment);
  }

  buildShader(
    shaderCode: ShaderCode,
    visibility: GPUShaderStageFlags,
    startBinding: number,
    device: GPUDevice,
    cached: { sampler: GPUSamplerCache },
    resourceViews?: Array<GPUResourceView>
  ) {
    const bindGroupLayoutEntries = getAddonBindGroupLayoutEntries(
      shaderCode,
      visibility,
      startBinding,
      resourceViews
    );

    const resources = getResourcesfromViews(
      device,
      { sampler: cached.sampler },
      resourceViews
    );

    return { bindGroupLayoutEntries, resources };
  }
  build({ device, cached }: BuildOptions, vertexBindingStart: number) {
    const { vertex, fragment } = this.resourceViews ?? {};

    Object.assign(
      this.vertexBuildResult,
      this.buildShader(
        this.vertex.shaderCode,
        GPUShaderStage.VERTEX,
        vertexBindingStart,
        device,
        { sampler: cached.sampler },
        vertex
      )
    );

    Object.assign(
      this.fragmentBuildResult,
      this.buildShader(
        this.fragment.shaderCode,
        GPUShaderStage.FRAGMENT,
        0,
        device,
        { sampler: cached.sampler },
        fragment
      )
    );

    return {
      fragment: this.fragmentBuildResult,
      vertex: this.vertexBuildResult,
    };
  }
}
