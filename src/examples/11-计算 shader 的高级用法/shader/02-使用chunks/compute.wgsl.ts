import { arrayProd } from "../../../../tools/math";

// pass.dispatchWorkgroups(size/chunk_size);
/*
  使用 chunk/invocation，可以防止过多的堵塞（只在chunk_size内部堵塞），这样可以更好的发挥 GPU 的并行性
  @workgroup_size(chunk_size)，同一个 workgroup 中的 invocation 可以共享存储

  但这样分 chunk，最后一步还需要对每个 chunk 的进行计算结果汇总，也就是需要两个 compute shader 

  chunk_compute_shader  --> chunks_result --> summary_compute_shader
*/

export const chunk_compute_shader = (
  numBins: number,
  workgroup_size: number[]
) => {
  workgroup_size[0] = workgroup_size[0] ?? 1;
  workgroup_size[1] = workgroup_size[1] ?? 1;
  workgroup_size[2] = workgroup_size[2] ?? 1;
  if (arrayProd(workgroup_size) < numBins) {
    console.warn("please add workgroup_size larger than numBins");
  }

  return /* wgsl */ `

const numBins = ${numBins};
const invocationPreWorkgroup = ${arrayProd(workgroup_size)};

@group(0) @binding(0) var<storage, read_write> chunks: array<array<vec4u, ${numBins}>>;  
@group(0) @binding(1) var img: texture_2d<f32>;

var<workgroup> bins: array<array<atomic<u32>, 4>, ${numBins}>;  // workgroup 共享存储

const Kluminance = vec3f(0.2126, 0.7152, 0.0722);
fn srgbLuminance(col: vec3f) -> f32 {
  return saturate(dot(Kluminance, col));
}

@compute @workgroup_size(${workgroup_size.join(",")})
fn main(
  @builtin(global_invocation_id) global_invocation_id: vec3u,
  @builtin(workgroup_id) workgroup_id: vec3u,
  @builtin(num_workgroups) num_workgroups: vec3u,
  @builtin(local_invocation_id) local_invocation_id: vec3u,
  ){
  let size = textureDimensions(img, 0);
  let xy = global_invocation_id.xy;
  if(all(xy<size)){
    var channels = textureLoad(img, xy, 0);
    channels.w = srgbLuminance(channels.rgb);
    for (var ch = 0; ch < 4; ch++) {
      let l = channels[ch];
      let bin = min(u32(l * f32(numBins)), numBins-1);   // 并行计算过程中，可能存在竞争，访问全局变量中的同一个 bin
      atomicAdd(&bins[bin][ch], 1u);
    }
  }
  workgroupBarrier();

  // workgroup_index
  let chunk =
          workgroup_id.x +
          workgroup_id.y * num_workgroups.x +
          workgroup_id.z * num_workgroups.x * num_workgroups.y;
  // local_invocation_index
  let bin = 
          local_invocation_id.x +
          local_invocation_id.y * ${workgroup_size[0]} +
          local_invocation_id.z * ${workgroup_size[0]} * ${workgroup_size[1]};

  if (bin<numBins){
    chunks[chunk][bin] = vec4u(
        atomicLoad(&bins[bin][0]), 
        atomicLoad(&bins[bin][1]), 
        atomicLoad(&bins[bin][2]), 
        atomicLoad(&bins[bin][3])
    );
    if(invocationPreWorkgroup<numBins && bin==0){
      for (var i = invocationPreWorkgroup; i < numBins; i++) {
        chunks[chunk][i] = vec4u(
            atomicLoad(&bins[i][0]), 
            atomicLoad(&bins[i][1]), 
            atomicLoad(&bins[i][2]), 
            atomicLoad(&bins[i][3])
        );
      }
    }
  }
}
`;
};

/*
  下面可以继续将 for 循环用 dispatchWorkgroups 来执行
  但需要一个额外的全局变量来存储累加的结果，并且存在竞争，需要用到 atomicAdd 
  因此效率不高，下面我们采用 reduce 的方法来避免竞争，同时也可以使用 dispatchWorkgroups 来提高并行性
*/
export const summary_compute_shader = (numBins: number) => {
  return /* wgsl */ `

const numBins = ${numBins};

@group(0) @binding(0) var<storage, read_write> chunks: array<array<vec4u, ${numBins}>>;  

@compute @workgroup_size(${numBins})
fn main(@builtin(local_invocation_id) local_invocation_id: vec3u){
  let chunkLength = arrayLength(&chunks);
  var sum = vec4u(0u, 0u, 0u, 0u);
  for (var i = 0u; i < chunkLength; i++) {
    sum += chunks[i][local_invocation_id.x];  // 这里是并行计算，并且 sum 是局部变量，不存在竞争，因此不需要 atomicAdd
  }
  chunks[0][local_invocation_id.x] = sum;
}
`;
};

export const summary_compute_shader_2 = (numBins: number) => {
  return /* wgsl */ `

struct Uniforms {
  stride: u32,
};

const numBins = ${numBins};

@group(0) @binding(0) var<storage, read_write> chunks: array<array<vec4u, ${numBins}>>;  
@group(0) @binding(1) var<uniform> uni: Uniforms;  

@compute @workgroup_size(${numBins})
fn main(
  @builtin(workgroup_id) workgroup_id: vec3u,
  @builtin(local_invocation_id) local_invocation_id: vec3u
){
  let chunk0 = workgroup_id.x * uni.stride * 2u;
  let chunk1 = chunk0 + uni.stride;
  let sum = chunks[chunk0][local_invocation_id.x] + chunks[chunk1][local_invocation_id.x];
  chunks[chunk0][local_invocation_id.x] = sum;
}
`;
};
