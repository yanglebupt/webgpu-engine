struct UniformParams {
  color: vec4f,
  scale: vec2f,
  offset: vec2f,
}
@group(0) @binding(0) var<uniform> u_params: UniformParams;

@fragment
fn main() -> @location(0) vec4f {
  return u_params.color;
}