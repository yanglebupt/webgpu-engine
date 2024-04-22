import { ShaderLocation, VPTransformationMatrixGroupBinding } from "..";

export default /* wgsl */ `
struct VertexInput {
  @location(${ShaderLocation.POSITION}) position: vec4f,
  @location(${ShaderLocation.NORMAL}) normal: vec3f,
};

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) normal: vec3f,
};

${VPTransformationMatrixGroupBinding}
@group(1) @binding(0) var<uniform> modelMatrix: mat4x4f;

@vertex
fn main(vert: VertexInput) -> VertexOutput {
    var o: VertexOutput;
    o.position = trf.projectionMatrix * trf.viewMatrix * modelMatrix * vert.position;
    o.normal = (modelMatrix * vec4f(vert.normal, 0)).xyz;
    return o;
};

`;
