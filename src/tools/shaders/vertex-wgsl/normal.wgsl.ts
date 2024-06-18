import {
  MTransformationMatrixGroupBinding,
  M_INSTANCE_NAME,
  ShaderContext,
  ShaderLocation,
  VPTransformationMatrixGroupBinding,
  VP_NAME,
} from "..";
import { wgsl } from "wgsl-preprocessor";

interface ShaderContextParameter {
  useTexcoord: boolean;
  useNormal: boolean;
  bindingStart: number;
}

export default (context: ShaderContext<ShaderContextParameter>) => {
  const { useNormal, useTexcoord, bindingStart = 0 } = context;
  return wgsl/* wgsl */ `
struct VertexInput {
  @location(${ShaderLocation.POSITION}) position: vec4f,
#if ${useNormal}
  @location(${ShaderLocation.NORMAL}) normal: vec3f,
#endif
#if ${useTexcoord}
  @location(${ShaderLocation.TEXCOORD_0}) uv0: vec2f,
#endif
};

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) normal: vec3f,
  @location(1) pos: vec3f,
  @location(2) uv0: vec2f,
  @location(3) cameraPos: vec3f
};

${VPTransformationMatrixGroupBinding}
${MTransformationMatrixGroupBinding(bindingStart)}

@vertex
fn main(
  vert: VertexInput, 
  @builtin(instance_index) instanceIndex : u32
) -> VertexOutput {
    var o: VertexOutput;
    let modelTransform = ${M_INSTANCE_NAME}[instanceIndex];
    let pos = modelTransform.modelMatrix * vert.position;
    o.pos = pos.xyz/pos.w;
    o.cameraPos = ${VP_NAME}.cameraPosition;
    o.position = ${VP_NAME}.projectionMatrix * ${VP_NAME}.viewMatrix * pos;
    #if ${useNormal}
    o.normal = (modelTransform.normalMatrix * vec4f(vert.normal, 0)).xyz;
    #else
    o.normal = vec3f(0);
    #endif
    #if ${useTexcoord}
    o.uv0 = vert.uv0;
    #else
    o.uv0 = vec2f(0);
    #endif
    return o;
};`;
};
