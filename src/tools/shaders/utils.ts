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
`;
