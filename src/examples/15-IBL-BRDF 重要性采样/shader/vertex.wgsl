struct VaryStruct {
  @builtin(position) position: vec4f,
  @location(0) tc: vec2f,
}

@vertex
fn main(@builtin(vertex_index) vertexIndex: u32) -> VaryStruct {
  let pos = array<vec2f, 3>(
    vec2f(-1., -1.),
    vec2f(-1., 3.),
    vec2f(3., -1.),
  );

  var o: VaryStruct;
  o.position = vec4f(pos[vertexIndex], 0.0, 1.0); 
  o.tc = pos[vertexIndex] * 0.5 + 0.5;
  return o;
}