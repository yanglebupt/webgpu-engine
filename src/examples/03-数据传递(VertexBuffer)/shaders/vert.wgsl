struct VertexParam {
  @location(0) position: vec2f,
  @location(1) color: vec4f,
  @location(2) scale: vec2f,
  @location(3) offset: vec2f,
}

struct VaryStruct{
  @builtin(position) position: vec4f,
  @location(0) color: vec4f,
}

@vertex
fn main(vert: VertexParam) -> VaryStruct {
  var o: VaryStruct;
  o.position =  vec4f(vert.position * vert.scale + vert.offset, 0.0, 1.0);
  o.color = vert.color;
  return o;
}