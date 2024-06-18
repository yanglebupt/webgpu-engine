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
  static InjectVertexShaderCode = (bindingStart: number) => /*wgsl*/ `
  ${VPTransformationMatrixGroupBinding}
  ${MTransformationMatrixGroupBinding(bindingStart)}
  `;

  private vertex: ShaderCodeWithContext;
  private fragment: ShaderCodeWithContext;
  private vertexBuildResult!: ShaderBuildResult;
  private fragmentBuildResult!: ShaderBuildResult;

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
  }

  contextShaderCode(code: ShaderCodeWithContext | ShaderCode) {
    const shaderCode = Object.hasOwn(code, "context")
      ? (code as ShaderCodeWithContext)
      : { shaderCode: code as ShaderCode, context: {} };
    return shaderCode;
  }

  update(device: GPUDevice) {
    updateResourceViews(device, this.resourceViews?.vertex);
    updateResourceViews(device, this.resourceViews?.fragment);
  }

  buildShader(
    shader: ShaderCodeWithContext,
    visibility: GPUShaderStageFlags,
    startBinding: number,
    device: GPUDevice,
    cached: { sampler: GPUSamplerCache },
    resourceViews?: Array<GPUResourceView>
  ) {
    const bindGroupLayoutEntries = getAddonBindGroupLayoutEntries(
      shader.shaderCode,
      visibility,
      startBinding,
      resourceViews
    );

    const resources = getResourcesfromViews(
      device,
      { sampler: cached.sampler },
      resourceViews
    );

    let _shader;
    if (visibility === GPUShaderStage.FRAGMENT) {
      let fragmentInject = this.envmap
        ? `
    ${EnvMapGroupBinding}`
        : "";
      fragmentInject += this.lighting
        ? `
    ${LightGroupBinding}`
        : "";
      _shader = injectShaderCode(shader, fragmentInject);
    } else {
      _shader = injectShaderCode(
        shader,
        ShaderMaterial.InjectVertexShaderCode(bindGroupLayoutEntries.length)
      );
    }

    return { bindGroupLayoutEntries, resources, shader: _shader };
  }

  build({ device, cached }: BuildOptions) {
    const { vertex, fragment } = this.resourceViews ?? {};

    this.vertexBuildResult = this.buildShader(
      this.vertex,
      GPUShaderStage.VERTEX,
      0,
      device,
      { sampler: cached.sampler },
      vertex
    );

    this.fragmentBuildResult = this.buildShader(
      this.fragment,
      GPUShaderStage.FRAGMENT,
      0,
      device,
      { sampler: cached.sampler },
      fragment
    );

    return {
      fragment: this.fragmentBuildResult,
      vertex: this.vertexBuildResult,
    };
  }
}
