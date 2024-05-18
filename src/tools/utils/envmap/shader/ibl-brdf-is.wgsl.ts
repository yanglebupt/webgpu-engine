import {
  Coord,
  getNormalSpace,
  hammersley,
  textureUV,
} from "../../../shaders/utils";
import { arrayProd } from "../../../math";
import { IDX, axis } from "../../Dispatch";
import { wgsl } from "wgsl-preprocessor";

export default (
  polyfill: boolean,
  format: GPUTextureFormat,
  mipLevels: [number, number],
  chunkSize: number[],
  dispatch_sample: number,
  order: IDX[],
  diffuse_INT: number = 1e4,
  specular_INT: number = 1e4
) => {
  const [width_idx, height_idx, sampler_idx] = order;
  const sample_axis = axis[sampler_idx];
  console.log(`N: u32(${chunkSize[sampler_idx]})*${dispatch_sample}`);
  let mipLevelStr = "const mipLevels: array<f32, 2> = array(";
  mipLevels.forEach((l) => (mipLevelStr += `${l},`));
  mipLevelStr += ");";

  return wgsl/* wgsl */ `
#if ${polyfill}
@group(0) @binding(0) var envMap: texture_2d_array<f32>;
#else
@group(0) @binding(0) var envMap: texture_2d<f32>;
@group(0) @binding(3) var filterSampler: sampler;
${mipLevelStr}
#endif
@group(0) @binding(1) var diffuseMap: texture_storage_2d<${format}, write>;
@group(0) @binding(2) var specularMap: texture_storage_2d<${format}, write>;

var<workgroup> diffuse_radiance: array<atomic<u32>, 3>;
var<workgroup> specular_radiance: array<atomic<u32>, 3>;

const PI = 3.141592653589793;
const DIFFUSE_INT: f32 = ${diffuse_INT};
const SPECULAR_INT: f32 = ${specular_INT};
const shininess:f32 = 600.0;

${textureUV}
${Coord}
${getNormalSpace}
${hammersley}

#if ${polyfill}
fn texture(map: texture_2d_array<f32>, uv: vec2f, arrar_index: u32, size: vec2u) -> vec4f {
  return textureLoad(map, texturePixel(uv, size), arrar_index, 0u); 
}
#else
fn texture(map: texture_2d<f32>, uv: vec2f, mipLevel: f32, size: vec2u) -> vec4f {
  return textureSampleLevel(map, filterSampler, uv, mipLevel); 
}
#endif

fn diffuse_sample(random: vec2f, TBN: mat3x3f, size: vec2u) -> vec3f {
  let phi = 2.0*PI*random.x;
  let theta = asin(sqrt(random.y));
  let pos = TBN * SphereCoord2Dir(phi, theta);
  let uv = Dir2SphereTexCoord(pos);
  #if ${polyfill}
  let radiance = texture(envMap, uv, 0u, size).rgb;
  #else
  let radiance = texture(envMap, uv, mipLevels[0], size).rgb;
  #endif
  return radiance;
}

fn specular_sample(random: vec2f, TBN: mat3x3f, size: vec2u) -> vec3f {
  let phi = 2.0*PI*random.x;
  let theta = acos( pow(1.0-random.y, 1.0/(1.0+shininess)) );
  let pos = TBN * SphereCoord2Dir(phi, theta);
  let uv = Dir2SphereTexCoord(pos);
  #if ${polyfill}
  let radiance = texture(envMap, uv, 1u, size).rgb;
  #else
  let radiance = texture(envMap, uv, mipLevels[1], size).rgb;
  #endif
  return radiance;
}

fn add_radiance(diffuse_dispatch_rad: vec3f, specular_dispatch_rad: vec3f){
  atomicAdd(&diffuse_radiance[0], u32(diffuse_dispatch_rad.x*DIFFUSE_INT));
  atomicAdd(&diffuse_radiance[1], u32(diffuse_dispatch_rad.y*DIFFUSE_INT));
  atomicAdd(&diffuse_radiance[2], u32(diffuse_dispatch_rad.z*DIFFUSE_INT));

  atomicAdd(&specular_radiance[0], u32(specular_dispatch_rad.x*SPECULAR_INT));
  atomicAdd(&specular_radiance[1], u32(specular_dispatch_rad.y*SPECULAR_INT));
  atomicAdd(&specular_radiance[2], u32(specular_dispatch_rad.z*SPECULAR_INT));
}

fn read_radiance() -> array<vec3f,2> {
  let fin_diffuse_radiance = vec3f(
          f32(atomicLoad(&diffuse_radiance[0])),
          f32(atomicLoad(&diffuse_radiance[1])),
          f32(atomicLoad(&diffuse_radiance[2])));
  let fin_specular_radiance = vec3f(
        f32(atomicLoad(&specular_radiance[0])),
        f32(atomicLoad(&specular_radiance[1])),
        f32(atomicLoad(&specular_radiance[2])));
  return array(fin_diffuse_radiance / DIFFUSE_INT, fin_specular_radiance / SPECULAR_INT);
}


@compute @workgroup_size(${chunkSize.join(",")})
fn main(
  @builtin(global_invocation_id) id: vec3u,
  @builtin(local_invocation_id) local_invocation_id: vec3u,
) {
  let pixel = id.${axis[width_idx]}${axis[height_idx]};
  let size = textureDimensions(diffuseMap);
  let tc = textureUV(pixel, size);

  let normal = SphereTexCoord2Dir(tc);
  let TBN = getNormalSpace(normal);

  let N = u32(${chunkSize[sampler_idx]})*${dispatch_sample};
  var diffuse_dispatch_rad = vec3f(0.0);
  var specular_dispatch_rad = vec3f(0.0);

  for(var j=0u; j<${dispatch_sample}; j++){
    let i = local_invocation_id.${sample_axis} + j*${arrayProd(chunkSize)};
    let random = hammersley(i, N);
    diffuse_dispatch_rad += diffuse_sample(random, TBN, size);
    specular_dispatch_rad += specular_sample(random, TBN, size);
  }

  add_radiance(diffuse_dispatch_rad, specular_dispatch_rad);
  workgroupBarrier();
  let fin_radiance = read_radiance();

  var fin_diffuse_radiance = fin_radiance[0];
  fin_diffuse_radiance /= f32(N);

  var fin_specular_radiance = fin_radiance[1];
  fin_specular_radiance /= (f32(N)*(1.0+shininess)/(2.0+shininess));

  textureStore(diffuseMap, pixel, vec4f(fin_diffuse_radiance,1.0));
  textureStore(specularMap, pixel, vec4f(fin_specular_radiance,1.0));
}
`;
};
