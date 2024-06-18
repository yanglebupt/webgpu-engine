export const BasicUnifom = /* wgsl */ `
struct Uniforms {
  color: vec4f,
} 
@group(2) @binding(0) var<uniform> uni: Uniforms;
`;

export default () => /* wgsl */ `
${BasicUnifom}
@fragment
fn main() -> @location(0) vec4f {
  return uni.color;
}
`;
