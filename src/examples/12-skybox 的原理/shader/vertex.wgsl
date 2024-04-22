
struct Varying {
  @builtin(position) position: vec4f,
  @location(0) pos: vec4f,
}

@vertex
fn main(@builtin(vertex_index) vertexIndex: u32) -> Varying {
  let pos = array(
    vec2f(-1.,-1.),
    vec2f(-1.,3.),
    vec2f(3.,-1.),
  );
  var o: Varying;
  o.position = vec4f(pos[vertexIndex], 1., 1.);  // clip space 1 代表最远处，skybox 就是要在最远处
  o.pos = o.position;
  return o;
}