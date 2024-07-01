import { BuildOptions } from "../scene/types";
import {
  EnvMapGroupBinding,
  LightGroupBinding,
  MTransformationMatrixGroupBinding,
  M_INSTANCE_NAME,
  ShaderCode,
  ShaderCodeWithContext,
  VPTransformationMatrixGroupBinding,
  VP_NAME,
  WGSSLPosition,
} from "../shaders";
import { GPUResourceView } from "../type";
import { MeshMaterial } from "./MeshMaterial";
import {
  getAddonBindGroupLayoutEntries,
  getResourcesfromViews,
  injectShaderCode,
  updateResourceViews,
} from "..";
import { ShaderBuildResult } from "./Material";
import { GPUSamplerCache } from "../scene/cache";
import { MipMap } from "../utils/mipmaps";

// need inject in main function
const defaultInstanceName = "instanceIndex";
const Transform = (instanceName: string = defaultInstanceName) => /*wgsl*/ `
let projectionMatrix = ${VP_NAME}.projectionMatrix;
let viewMatrix = ${VP_NAME}.viewMatrix;
let modelTransform = ${M_INSTANCE_NAME}[${instanceName}];
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
  static InjectVertexShaderCode = (
    bindingStart: number
  ) => /*wgsl*/ `${VPTransformationMatrixGroupBinding}
${MTransformationMatrixGroupBinding(bindingStart)}`;

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
      : { shaderCode: code as ShaderCode };
    return shaderCode;
  }

  onChange() {
    if (!this.device) return;
    updateResourceViews(this.device, this.resourceViews?.vertex);
    updateResourceViews(this.device, this.resourceViews?.fragment);
  }

  buildShader(
    shader: ShaderCodeWithContext,
    visibility: GPUShaderStageFlags,
    startBinding: number,
    device: GPUDevice,
    cached: { sampler: GPUSamplerCache; mipmap: MipMap },
    resourceViews?: Array<GPUResourceView>
  ) {
    const bindGroupLayoutEntries = getAddonBindGroupLayoutEntries(
      shader.shaderCode,
      visibility,
      startBinding,
      resourceViews
    );

    const resources = getResourcesfromViews(device, cached, resourceViews);

    let _shader;
    if (visibility === GPUShaderStage.FRAGMENT) {
      const injects = [];
      if (this.envmap)
        injects.push({
          inject: EnvMapGroupBinding,
        });
      if (this.lighting)
        injects.push({
          inject: LightGroupBinding,
        });
      _shader = injectShaderCode(shader, injects);
    } else {
      // 需要检测是否已经存在 instanceFlag
      const input = shader.shaderCode.Input;
      const matched = input.match(/@builtin\(instance_index\)\s*(.*?)\s*:/);
      const instanceName = matched ? matched[1] : defaultInstanceName;
      const injects = [
        {
          inject: ShaderMaterial.InjectVertexShaderCode(
            bindGroupLayoutEntries.length
          ),
        },
        {
          inject: Transform(instanceName),
          position: WGSSLPosition.Entry,
        },
      ];
      if (!matched) {
        injects.push({
          inject: `@builtin(instance_index) ${defaultInstanceName}: u32,`,
          position: WGSSLPosition.Input,
        });
      }
      _shader = injectShaderCode(shader, injects);
    }

    return { bindGroupLayoutEntries, resources, shader: _shader };
  }

  build({ device, cached }: BuildOptions) {
    const { vertex, fragment } = this.resourceViews ?? {};
    const subCached = { sampler: cached.sampler, mipmap: cached.mipmap };

    this.vertexBuildResult = this.buildShader(
      this.vertex,
      GPUShaderStage.VERTEX,
      0,
      device,
      subCached,
      vertex
    );

    this.fragmentBuildResult = this.buildShader(
      this.fragment,
      GPUShaderStage.FRAGMENT,
      0,
      device,
      subCached,
      fragment
    );
    this.device = device;
    return {
      fragment: this.fragmentBuildResult,
      vertex: this.vertexBuildResult,
    };
  }
}
