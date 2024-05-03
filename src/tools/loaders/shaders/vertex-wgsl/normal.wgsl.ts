import {
  MTransformationMatrixGroupBinding,
  M_INSTANCE_NAME,
  ShaderLocation,
  VPTransformationMatrixGroupBinding,
  VP_NAME,
} from "..";
import { wgsl } from "wgsl-preprocessor";
import { ShaderContext } from "../..";

export default (context: ShaderContext) => wgsl/* wgsl */ `
struct VertexInput {
  @location(${ShaderLocation.POSITION}) position: vec4f,
  @location(${ShaderLocation.NORMAL}) normal: vec3f,
#if ${context.useTexcoord}
  @location(${ShaderLocation.TEXCOORD_0}) uv0: vec2f,
#endif
};

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) normal: vec3f,
  @location(1) uv0: vec2f,
};

${VPTransformationMatrixGroupBinding}
${MTransformationMatrixGroupBinding}

@vertex
fn main(
  vert: VertexInput, 
  @builtin(instance_index) instanceIndex : u32
) -> VertexOutput {
    var o: VertexOutput;
    let modelTransform = ${M_INSTANCE_NAME}[instanceIndex];
    o.position = ${VP_NAME}.projectionMatrix * ${VP_NAME}.viewMatrix * modelTransform.modelMatrix * vert.position;
    o.normal = (modelTransform.normalMatrix * vec4f(vert.normal, 0)).xyz;
    #if ${context.useTexcoord}
      o.uv0 = vert.uv0;
    #else
      o.uv0 = vec2f(0);
    #endif
    return o;
};

`;
