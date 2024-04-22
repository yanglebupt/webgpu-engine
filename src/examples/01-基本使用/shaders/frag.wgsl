struct VertexShaderOutput {
  @builtin(position) position: vec4<f32>, // @builtin(position) 内置的是渲染贴图的像素点中心坐标。在 3D 下，我们应该传入计算后的世界坐标
  @location(0) color: vec4<f32>
}

@fragment
fn main(o: VertexShaderOutput) -> @location(0) vec4<f32> {
  let red = vec4f(1., 0., 0., 1.);
  let cyan = vec4f(0., 1., 1., 1.);
  // 对像素点 f32 转 u32，取整类似 floor 操作。同时是整除
  let grid = vec2u(o.position.xy) / 8;  
  let checker = (grid.x + grid.y) % 2 == 1;
  return select(red, cyan, checker);
}