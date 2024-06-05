export const DataDefinitions = /* wgsl */ `
struct Uniforms {
  color: vec4f,
} 
@group(1) @binding(1) var<uniform> uni: Uniforms;
`;

export default () => /* wgsl */ `
${DataDefinitions}
@fragment
fn main() -> @location(0) vec4f {
  return uni.color;
}
`;
