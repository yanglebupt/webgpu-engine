// Group Bingding 全局变量, struct 和 array 都是顺序结构
struct UniformParams {
  color: vec4f,
  scale: vec2f,
  offset: vec2f,
}
@group(0) @binding(0) var<uniform> u_params: UniformParams;
@group(1) @binding(0) var<storage> s_params: array<vec2f>;

@vertex
fn main(@builtin(vertex_index) vertexIndex: u32) -> @builtin(position) vec4f {
  let pos = array<vec2f, 3>(
    vec2f( 0.0,  0.5),  
    vec2f(-0.5, -0.5), 
    vec2f( 0.5, -0.5)  
  );
  return vec4f(s_params[vertexIndex] * u_params.scale + u_params.offset, 0.0, 1.0);
}