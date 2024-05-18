import { textureUV } from "../../../shaders/utils";

export default (format: GPUTextureFormat, chunkSize: number[]) => {
  return /*wgsl*/ `
@group(0) @binding(0) var inputTexture: texture_storage_2d<${format}, read>;
@group(0) @binding(1) var mipmapTexture: texture_storage_2d<${format}, write>;

${textureUV}

fn fetchFromOri(pos: vec2u, mip_size: vec2u, size: vec2u) -> vec4f {
  let tc = textureUV(pos, mip_size);
  // remap to ori size
  let grid = textureGrid(tc, size);
  let left_bottom = vec2u(grid.xy);
  let left_top = left_bottom + vec2u(0u, 1u); 
  let right_bottom = left_bottom + vec2u(1u, 0u); 
  let right_top = left_bottom + vec2u(1u, 1u); 
  let gap = grid.zw;

  let res1 = textureLoad(inputTexture, left_bottom);
  let res2 = textureLoad(inputTexture, left_top);
  let res3 = textureLoad(inputTexture, right_bottom);
  let res4 = textureLoad(inputTexture, right_top);
  
  return biFilter(res1, res2, res3, res4, gap);
}

fn biFilter(left_bottom: vec4f, left_top: vec4f, right_bottom: vec4f, right_top: vec4f, gap: vec2f) -> vec4f {
  let a = mix(left_bottom, left_top, gap.y);
  let b = mix(right_bottom, right_top, gap.y);
  return mix(a, b, gap.x);
}

@compute @workgroup_size(${chunkSize.join(",")})
fn main(
  @builtin(global_invocation_id) id: vec3u,
) {
  let pos = id.xy;
  let mip_size = textureDimensions(mipmapTexture);
  let size = textureDimensions(inputTexture);
  let res = fetchFromOri(pos, mip_size, size);
  textureStore(mipmapTexture, pos, res);
}
`;
};
