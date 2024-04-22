struct VaryStruct {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
}

@group(0) @binding(0) var ourSampler: sampler;
@group(0) @binding(1) var ourTexture: texture_2d<f32>;

@fragment
fn main(vs: VaryStruct) -> @location(0) vec4f {
  return textureSample(ourTexture, ourSampler, vs.uv);
}