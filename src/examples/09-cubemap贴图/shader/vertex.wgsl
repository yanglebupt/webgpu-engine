struct UniformStruct { 
  mvp: mat4x4f,
}

struct Vertex { 
  @location(0) position: vec3f,
}

struct Varying {
  @builtin(position) position: vec4f,
  @location(0) normal: vec3f,
}

@group(0) @binding(0) var<uniform> uni: UniformStruct;

@vertex
fn main(vert: Vertex) -> Varying {
  var o: Varying;
  o.position = uni.mvp * vec4f(vert.position, 1.0);
  o.normal = normalize(vert.position);
  return o;
}