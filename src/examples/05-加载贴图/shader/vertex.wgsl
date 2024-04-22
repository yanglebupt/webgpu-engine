struct VaryStruct {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
}

@vertex
fn main(@builtin(vertex_index) vertexIndex: u32) -> VaryStruct{
  let pos = array<vec2f,6>(
    vec2f(0., 0.),
    vec2f(1., 0.),
    vec2f(0., 1.),
    vec2f(1., 0.),
    vec2f(0., 1.),
    vec2f(1., 1.),
  );

  var o: VaryStruct;
  o.position = vec4f(pos[vertexIndex], 0.0, 1.0); 
  o.uv = pos[vertexIndex];
  o.uv = vec2f(o.uv.x, 1.-o.uv.y);
  return o;
}