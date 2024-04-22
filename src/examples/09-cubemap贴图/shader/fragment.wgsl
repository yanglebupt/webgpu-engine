@group(0) @binding(1) var _sampler: sampler;
@group(0) @binding(2) var cubemap: texture_cube<f32>;

@fragment
fn main(@location(0) normal: vec3f) -> @location(0) vec4f {
  return textureSample(cubemap, _sampler, normalize(normal));
}