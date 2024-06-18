import { ShaderCode } from "../../../tools/shaders";
import { Transform } from "../../../tools/materials/ShaderMaterial";

const vertex: ShaderCode = {
  resources: /*wgsl*/ `
  struct Uniforms {
  color: vec4f,
} 
@group(1) @binding(0) var<uniform> uni: Uniforms;
`,
  code() {
    return /* wgsl */ `
struct VertexInput {
  @location(0) position: vec4f,
};

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) color: vec4f, 
}

@vertex
fn main(
  vert: VertexInput, 
  @builtin(instance_index) instanceIndex : u32
) -> VertexOutput {
    ${Transform}
    var o: VertexOutput;
    o.position = projectionMatrix * viewMatrix * modelMatrix * vert.position;
    o.color = uni.color;
    return o;
};`;
  },
};

export default vertex;
