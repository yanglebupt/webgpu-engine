struct Uniform {
  mipmapLevel: f32,
  samplers: u32,
};

@group(0) @binding(0) var inputSampler: sampler;
@group(0) @binding(1) var inputTexture: texture_2d<f32>;
@group(0) @binding(2) var<uniform> uniforms: Uniform;

const PI = 3.141592653589793;

fn SphereCoord2Dir(phi: f32, theta: f32) -> vec3f {
  return vec3f(sin(theta)*cos(phi), sin(theta)*sin(phi), cos(theta));
}

fn Dir2SphereCoord(dir: vec3f) -> vec2f {
  let theta = acos(dir.z);
  let phi = atan2(dir.y, dir.x);
  return vec2f(phi, theta);
}

fn SphereTexCoord2Dir(tex: vec2f) -> vec3f {
  let phi = 2.0*PI*(0.5-tex.x);
  let theta = PI*(1.0-tex.y);
  return SphereCoord2Dir(phi, theta);
}

fn Dir2SphereTexCoord(dir: vec3f) -> vec2f {
  let angle = Dir2SphereCoord(dir);
  let s = 0.5 - angle.x / (2.0*PI);
  let t = 1.0 - angle.y / PI;
  return vec2f(s, t);
}

fn getNormalSpace(normal: vec3f) -> mat3x3f {
  let someVec = vec3f(1.0, 0.0, 0.0);
  var tang = cross(someVec, normal);
  if(length(tang)<1e-8){  // normal parallel to someVec
    tang = vec3f(0.0, 1.0, 0.0);
  }
  tang = normalize(tang);
  let biTang = normalize(cross(normal, tang));
  return mat3x3f(tang, biTang, normal);
}


// from http://holger.dammertz.org/stuff/notes_HammersleyOnHemisphere.html
// Hacker's Delight, Henry S. Warren, 2001
fn radicalInverse(i_bits: u32) -> f32 {
  var bits = (i_bits << 16u) | (i_bits >> 16u);
  bits = ((bits & 0x55555555u) << 1u) | ((bits & 0xAAAAAAAAu) >> 1u);
  bits = ((bits & 0x33333333u) << 2u) | ((bits & 0xCCCCCCCCu) >> 2u);
  bits = ((bits & 0x0F0F0F0Fu) << 4u) | ((bits & 0xF0F0F0F0u) >> 4u);
  bits = ((bits & 0x00FF00FFu) << 8u) | ((bits & 0xFF00FF00u) >> 8u);
  return f32(bits) * 2.3283064365386963e-10; // / 0x100000000
}

fn hammersley(n: u32, N: u32) -> vec2f {
  return vec2f(f32(n) / f32(N), radicalInverse(n));
}

fn lin2rgb(lin: vec3f) -> vec3f {
  return pow(lin, vec3f(1.0/2.2));
}

fn rgb2lin(rgb: vec3f) -> vec3f {
  return pow(rgb, vec3f(2.2));
}

@fragment
fn main(@location(0) tc: vec2f) -> @location(0) vec4f {
  let normal = SphereTexCoord2Dir(tc);
  let TBN = getNormalSpace(normal);

  var radiance = vec3f(0.0);
  let N = uniforms.samplers;
  for(var i=1u; i<=N; i++){
    let random = hammersley(i, N);
    let phi = 2.0*PI*random.x;
    let theta = asin(sqrt(random.y));
    let pos = TBN * SphereCoord2Dir(phi, theta);
    let uv = Dir2SphereTexCoord(pos);
    radiance += textureSampleLevel(inputTexture, inputSampler, uv, uniforms.mipmapLevel).rgb;
  }
  radiance /= f32(N);
  return vec4f(radiance, 1.0);
  // return textureSampleLevel(inputTexture, inputSampler, tc, uniforms.mipmapLevel);
}