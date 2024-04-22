struct Vertex {
  @location(0) position: vec4f,
  @location(1) color: vec4f,
}

struct Varyings {
  @builtin(position) position: vec4f,
  @location(0) color: vec4f,
}

@group(0) @binding(0) var<storage> matrixs: array<mat4x4f>;

@vertex
fn main(vert: Vertex, @builtin(instance_index) instanceIndex: u32) -> Varyings {
  var o: Varyings;
  o.position = matrixs[instanceIndex] * vert.position;
  o.color = vert.color;
  return o;
}