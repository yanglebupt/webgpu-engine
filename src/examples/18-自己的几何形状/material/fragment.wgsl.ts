import { ShaderCode } from "../../../tools/shaders";

const fragment: ShaderCode = {
  DataDefinition: /* wgsl */ `
struct Uniforms {
  color: vec4f,
} 
@group(2) @binding(0) var<uniform> uni: Uniforms;
  `,
  code() {
    return /* wgsl */ `
@fragment
fn main() -> @location(0) vec4f {
  return uni.color;
}
`;
  },
};
export default fragment;
