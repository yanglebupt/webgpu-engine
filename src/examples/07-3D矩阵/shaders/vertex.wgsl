struct Vertex {
  @location(0) position: vec4f,
  @location(1) color: vec4f,
}

struct Uniforms {
  color: vec4f,
  mvp: mat4x4f,
}

struct Varyings {
  @builtin(position) position: vec4f,
  @location(0) color: vec4f,
}

@group(0) @binding(0) var<uniform> uni: Uniforms;

@vertex
fn main(vert: Vertex) -> Varyings {
  var o: Varyings;
  o.position = uni.mvp * vert.position;
  o.color = vert.color;
  return o;
}