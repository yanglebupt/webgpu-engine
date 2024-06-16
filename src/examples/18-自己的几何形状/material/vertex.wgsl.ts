import { wgsl } from "wgsl-preprocessor";
import { ShaderLocation, ShaderCode } from "../../../tools/shaders";
import { Transform } from "../../../tools/materials/ShaderMaterial";

const vertex: ShaderCode = {
  DataDefinition: ``,
  code() {
    return wgsl/* wgsl */ `
struct VertexInput {
  @location(${ShaderLocation.POSITION}) position: vec4f,
};


@vertex
fn main(
  vert: VertexInput, 
  @builtin(instance_index) instanceIndex : u32
) -> @builtin(position) vec4f {
    ${Transform}
    return projectionMatrix * viewMatrix * modelMatrix * vert.position;
};`;
  },
};

export default vertex;
