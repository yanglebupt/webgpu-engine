// Inner-Stage Variables
struct VertexShaderOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) color: vec4<f32>
}

@vertex
fn main(@builtin(vertex_index) vertexIndex: u32) -> VertexShaderOutput {
  var pos = array<vec2<f32>, 3>(
    vec2<f32>(-0.5, -0.5),
    vec2<f32>(0.0, 0.5),
    vec2<f32>(0.5, -0.5),
  );
  var color = array<vec4<f32>, 3>(
    vec4<f32>(1., 0., 0., 1.), 
    vec4<f32>(0., 1., 0., 1.), 
    vec4<f32>(0., 0., 1., 1.), 
  );

  var o: VertexShaderOutput;
  o.position = vec4<f32>(pos[vertexIndex], 0.0, 1.0);
  o.color = color[vertexIndex];
  return o;
}