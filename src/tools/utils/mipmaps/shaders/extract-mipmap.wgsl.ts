import { textureUV } from "../../../shaders/utils";
import { IDX, axis } from "../../Dispatch";

export default (
  format: GPUTextureFormat,
  chunkSize: number[],
  order: IDX[],
  mipLevels: number[]
) => {
  let mipLevelArray = `const mipLevels = array<u32, ${mipLevels.length}>(`;
  mipLevels.forEach((mipLevel) => {
    mipLevelArray += `
    ${mipLevel},`;
  });
  mipLevelArray += `
);
`;
  const [width_idx, height_idx, mipLevel_idx] = order;
  return /*wgsl*/ `
@group(0) @binding(0) var inputTexture: texture_2d<f32>; 
@group(0) @binding(1) var filteredTexture: texture_storage_2d_array<${format}, write>;  

${mipLevelArray}
${textureUV}

fn biFilter(left_bottom: vec4f, left_top: vec4f, right_bottom: vec4f, right_top: vec4f, gap: vec2f) -> vec4f {
  let a = mix(left_bottom, left_top, gap.y);
  let b = mix(right_bottom, right_top, gap.y);
  return mix(a, b, gap.x);
}

@compute @workgroup_size(${chunkSize.join(",")})
fn main(
  @builtin(global_invocation_id) id: vec3u,
  @builtin(workgroup_id) workgroup_id : vec3<u32>,
) {
  let pos = id.${axis[width_idx]}${axis[height_idx]};
  let size = textureDimensions(inputTexture, 0u);
  let tc = textureUV(pos, size);

  let m_idx = workgroup_id.${axis[mipLevel_idx]};
  let mipLevel = mipLevels[m_idx];

  // remap to mip size
  let mip_size = textureDimensions(inputTexture, mipLevel);
  let grid = textureGrid(tc, mip_size);
  let left_bottom = vec2u(grid.xy);
  let left_top = left_bottom + vec2u(0u, 1u);  // 会自动截断，或者返回 0，因此不需要手动截断
  let right_bottom = left_bottom + vec2u(1u, 0u); 
  let right_top = left_bottom + vec2u(1u, 1u); 
  let gap = grid.zw;

  let res1 = textureLoad(inputTexture, left_bottom, mipLevel);
  let res2 = textureLoad(inputTexture, left_top, mipLevel);
  let res3 = textureLoad(inputTexture, right_bottom, mipLevel);
  let res4 = textureLoad(inputTexture, right_top, mipLevel);
  
  let res = biFilter(res1, res2, res3, res4, gap);
  textureStore(filteredTexture, pos, m_idx, res);
}
`;
};
