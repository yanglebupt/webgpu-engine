import { wgsl } from "wgsl-preprocessor";
import { textureFilter } from "../utils";

export default (polyfill: boolean) => wgsl/*wgsl*/ `

const PI = 3.141592653589793;

struct Uniforms {
  viewDirectionProjectionInverse: mat4x4f,
}

@group(0) @binding(0) var<uniform> uni: Uniforms;
@group(0) @binding(1) var ourSampler: sampler;
@group(0) @binding(2) var ourTexture: texture_2d<f32>;

fn Dir2SphereCoord(dir: vec3f) -> vec2f {
  let theta = acos(dir.y);
  let phi = atan2(dir.z, dir.x);
  return vec2f(phi, theta);
}

fn Dir2SphereTexCoord(dir: vec3f) -> vec2f {
  let angle = Dir2SphereCoord(dir);
  let s = 0.5 - angle.x / (2.0*PI);
  let t = 1.0 - angle.y / PI;
  return vec2f(s, t);
}

${textureFilter(polyfill, "ourSampler")}

@fragment
fn main(@location(1) pos: vec4f) -> @location(0) vec4f {
  let t = uni.viewDirectionProjectionInverse * pos;
  let n_t  = normalize(t.xyz / t.w) * vec3f(1.0, -1.0, 1.0);
  return texture(ourTexture, Dir2SphereTexCoord(n_t), 0.0);
}
`;
