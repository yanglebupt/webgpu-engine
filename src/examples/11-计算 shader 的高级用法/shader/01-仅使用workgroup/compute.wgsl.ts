// pass.dispatchWorkgroups(width, height);
/*
  atomic 原子性不可再分操作，相当于加锁
  每个时刻只能有一个 workgroup 操作，其余 workgroup 需要等待
*/

export default () => /* wgsl */ `

@group(0) @binding(0) var<storage, read_write> histogram: array<array<atomic<u32>, 4>>;  // bins 累加数
@group(0) @binding(1) var img: texture_2d<f32>;

const Kluminance = vec3f(0.2126, 0.7152, 0.0722);
fn srgbLuminance(col: vec3f) -> f32 {
  return saturate(dot(Kluminance, col));
}

@compute @workgroup_size(1)
fn main(@builtin(global_invocation_id) global_invocation_id: vec3u){
  let numBins = arrayLength(&histogram);
  let xy = global_invocation_id.xy;
  var channels = textureLoad(img, xy, 0);
  channels.w = srgbLuminance(channels.rgb);
  for (var ch = 0; ch < 4; ch++) {
    let l = channels[ch];
    let bin = min(u32(l * f32(numBins)), numBins-1);
    atomicAdd(&histogram[bin][ch], 1u);
  }
}
`;
