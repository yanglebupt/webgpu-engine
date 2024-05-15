export const rgb2gray = /*wgsl*/ `
fn rgb2gray(col: vec3f) -> f32 {
  return dot(col, vec3f(0.2126, 0.7152, 0.0722));
}
`;

export const textureUV = /* wgsl */ `
fn pixel2tex(pixel: f32, noOfPixels: u32) -> f32 {
  return (pixel + 0.5) / f32(noOfPixels);
}

fn tex2pixel(tex: f32, noOfPixels: u32) -> f32 {
  return tex * f32(noOfPixels) - 0.5;
}

fn pixel2grid(p: f32) -> u32 {
  return u32(p + 0.5);
}

fn textureUV(id: vec2u, size: vec2u) -> vec2f {
  // Pixel coordinates (centre of pixel, origin at bottom left)
  let fragCoord = vec2f(f32(id.x) + .5, f32(size.y - id.y) - .5);  // flipY

  // Normalised pixel coordinates (from 0 to 1)
  let uv = fragCoord / vec2f(size);

  return uv;
}

fn texturePixel(uv: vec2f, size: vec2u) -> vec2u {
  return vec2u(uv * vec2f(size) - 0.5);
}
`;

export const Coord = /* wgsl */ `
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
`;

export const getNormalSpace = /* wgsl */ `
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
`;

export const hammersley = /* wgsl */ `
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
`;
