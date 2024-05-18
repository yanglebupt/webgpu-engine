import {
  Coord,
  getNormalSpace,
  hammersley,
  textureUV,
} from "../../tools/shaders/utils";
import { arrayProd } from "../../tools/math";
import { IDX, axis } from "../../tools/utils/Dispatch";

export default (
  format: GPUTextureFormat,
  chunkSize: number[],
  sampler_idx: IDX,
  dispatch_sample: number,
  width_idx: IDX,
  height_idx: IDX
) => {
  const sample_axis = axis[sampler_idx];
  console.log(`N: u32(${chunkSize[sampler_idx]})*${dispatch_sample}`);
  return /* wgsl */ `
@group(0) @binding(0) var envMap: texture_storage_2d<${format}, read>;
@group(0) @binding(1) var inverseCDFMap: texture_storage_2d<${format}, read>;
@group(0) @binding(2) var diffuseMap: texture_storage_2d<${format}, write>;

const PI = 3.141592653589793;
const INT:f32 = 1e6;

${Coord}
${getNormalSpace}
${hammersley}
${textureUV}

fn texture(map: texture_storage_2d<${format}, read>, uv: vec2f, size: vec2u) -> vec4f {
  return textureLoad(map, texturePixel(uv, size)); 
}

var<workgroup> radiance: array<atomic<u32>, 3>;

@compute @workgroup_size(${chunkSize.join(",")})
fn main(
  @builtin(global_invocation_id) id: vec3u,
  @builtin(local_invocation_id) local_invocation_id: vec3u,
){
  let pixel = id.${axis[width_idx]}${axis[height_idx]};
  let size = textureDimensions(envMap);
  let tc = textureUV(pixel, size);
  let normal = SphereTexCoord2Dir(tc);
  let N = u32(${chunkSize[sampler_idx]})*${dispatch_sample};
  var dispatch_rad = vec3f(0.0);
  // dispatch_sample 很小，不如直接串行，否则还需要合并有些麻烦
  for(var j=0u; j<${dispatch_sample}; j++){
    let i = local_invocation_id.${sample_axis} + j*${arrayProd(chunkSize)};
    let random = hammersley(i, N);
    let sampleY = texture(inverseCDFMap, vec2f(0, random.y), size).b;
    let sampleX = texture(inverseCDFMap, vec2f(random.x, sampleY), size).g;
    let uv = vec2f(sampleX, sampleY);
    let pos = SphereTexCoord2Dir(uv);
    let cosTheta = dot(pos, normal);
    let pdf = texture(inverseCDFMap, uv, size).r;
    if(cosTheta>0.0 && pdf>0.0){
      let theta = PI*(1.0-uv.y);
      let rad = 2.0*PI*texture(envMap, uv, size).rgb*cosTheta*sin(theta)/pdf;
      dispatch_rad += rad;
    }
  }

  atomicAdd(&radiance[0], u32(dispatch_rad.x*INT));
  atomicAdd(&radiance[1], u32(dispatch_rad.y*INT));
  atomicAdd(&radiance[2], u32(dispatch_rad.z*INT));

  workgroupBarrier();

  var fin_radiance = vec3f(
          f32(atomicLoad(&radiance[0])),
          f32(atomicLoad(&radiance[1])),
          f32(atomicLoad(&radiance[2])));
  fin_radiance /= INT*f32(N);
  textureStore(diffuseMap, pixel, vec4f(fin_radiance,1.0));
}
`;
};
