// https://github.com/galacean/engine-toolkit/blob/d45e458182a30dc36425a4dbf84e636df57304a6/packages/custom-material/src/grid/Grid.shader
export default () => /* wgsl */ `
struct VaryStruct {
  @builtin(position) position: vec4f,
  @location(0) depth: f32,
  @location(1) nearPoint: vec3f,
  @location(2) farPoint: vec3f,
}

struct Matrixs {
  viewDirectionProjection: mat4x4f,
  viewDirectionProjectionInverse: mat4x4f,
}

@group(0) @binding(0) var<uniform> tf: Matrixs;

fn unproject(pos: vec3f) -> vec3f {
  let res = tf.viewDirectionProjectionInverse * vec4f(pos, 1.0);
  return res.xyz / res.w;
}

fn computeDepth(pos: vec3f) -> f32 {
  let clip_space_pos = tf.viewDirectionProjection * vec4f(pos, 1.0);
  // map to 0-1
  return (clip_space_pos.z / clip_space_pos.w);
}

fn gridPoint(nearPoint: vec3f, farPoint: vec3f) -> vec3f {
  let ty = -nearPoint.y / (farPoint.y - nearPoint.y);
  return nearPoint + ty * (farPoint - nearPoint);
}

@vertex
fn main(@builtin(vertex_index) vertexIndex: u32) -> VaryStruct {
  let posList = array<vec2f, 6>(
    vec2f(-1., -1.),
    vec2f(1., -1.),
    vec2f(-1., 1.),
    vec2f(-1., 1.),
    vec2f(1., -1.),
    vec2f(1., 1.),
  );
  let pos = posList[vertexIndex];

  // 近远平面上点的世界坐标
  let nearPoint = unproject(vec3f(pos, 0.0)); 
  let farPoint = unproject(vec3f(pos, 1.0)); 

  // 近远平面上点连线与 y = 0（x-z）平面的交点
  let gridPos = gridPoint(nearPoint, farPoint);

  // 计算该点的深度
  let depth = computeDepth(gridPos);

  var o: VaryStruct;
  o.position = vec4f(pos, depth, 1.0); 
  o.depth = depth;
  /* 
    注意这里需要传 nearPoint 和 farPoint，然后在 fragment 中重新计算 gridPos
    不能直接传 gridPos，因为直接对 gridPos 插值不正确，而对 nearPoint 和 farPoint 插值则没问题
  */
  o.nearPoint = nearPoint;
  o.farPoint = farPoint;
  return o;
}
`;
