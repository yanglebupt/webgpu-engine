import { wgsl } from "wgsl-preprocessor";

// https://github.com/galacean/engine-toolkit/blob/d45e458182a30dc36425a4dbf84e636df57304a6/packages/custom-material/src/grid/Grid.shader

export const GridUniform = /*wgsl*/ `
struct Uniforms {
  near: f32,
  far: f32,
  fade: f32,
  flipProgress: f32,
  primaryScale: f32,
  secondaryScale: f32,
  gridIntensity: f32,
  axisIntensity: f32,
}
@group(0) @binding(1) var<uniform> uni: Uniforms;
`;

export default () => wgsl/*wgsl*/ `
${GridUniform}
fn grid(gridPos: vec3f, scale: f32, fade: f32) -> vec4f {
  let coord = gridPos.xz * scale;
  let derivative = fwidth(coord);
  let grid = abs(fract(coord - 0.5) - 0.5) / derivative;
  let line = min(grid.x, grid.y);
  let a = fade * (1.0 - min(line, 1.0));
  let gridIntensity = uni.gridIntensity;
  var col = vec4f(gridIntensity, gridIntensity, gridIntensity, a);

  let minimumz = min(derivative.y, 1.0);
  let minimumx = min(derivative.x, 1.0);

  let axisIntensity = uni.axisIntensity;
  let reColor = 1.0 / a;
  // z-axis
  if (abs(gridPos.x) < axisIntensity * minimumx) {col.z = reColor;}
  // x-axis or y-axis
  if (abs(gridPos.z) < axisIntensity * minimumz) {col.x = reColor;}

  return col;
}

fn computeLinearDepth(depth: f32) -> f32 {
  let clip_space_depth = depth * 2.0 - 1.0;
  let near = uni.near;
  let far = uni.far;
  let linearDepth = (2.0 * near * far) / (far + near - clip_space_depth * (far - near));
  return linearDepth / far; // normalize
}

fn gridPoint(nearPoint: vec3f, farPoint: vec3f) -> vec3f {
  let ty = -nearPoint.y / (farPoint.y - nearPoint.y);
  return nearPoint + ty * (farPoint - nearPoint);
}

@fragment
fn main(
  @location(0) depth: f32,
  @location(1) nearPoint: vec3f,
  @location(2) farPoint: vec3f
) -> @location(0) vec4f {
  let gridPos = gridPoint(nearPoint, farPoint);
  let fading = max(0.0, (0.5 - computeLinearDepth(depth)));
  var col = grid(gridPos, uni.primaryScale, uni.fade) + grid(gridPos, uni.secondaryScale, 1.0 - uni.fade);
  col.a *= fading;
  col.r *= col.a;
  col.g *= col.a;
  col.b *= col.a;

  // let col = vec4f(0.0);
  return col;
}
`;
