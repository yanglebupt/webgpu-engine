import {
  Coord,
  textureFilter,
  getNormalSpace,
  hammersley,
  textureUV,
} from "../../../shaders/utils";
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
  const sampleChunk = chunkSize[sampler_idx];
  console.log(`N: u32(${sampleChunk})*${dispatch_sample}`);
  let mipLevelStr = `const mipLevels: array<f32, ${mipLevels.length}> = array(`;
  mipLevels.forEach((l) => (mipLevelStr += `${l},`));
  mipLevelStr += ");";

  return wgsl/* wgsl */ `

@group(0) @binding(0) var envMap: texture_2d<f32>;
@group(0) @binding(1) var diffuseMap: texture_storage_2d<${format}, write>;
@group(0) @binding(2) var specularMap: texture_storage_2d<${format}, write>;
@group(0) @binding(3) var _sampler: sampler;
@group(0) @binding(4) var<uniform> roughness: f32;

var<workgroup> diffuse_radiance: array<atomic<u32>, 3>;
var<workgroup> specular_radiance: array<atomic<u32>, 3>;

const PI = 3.141592653589793;
const DIFFUSE_INT: f32 = ${diffuse_INT};
const SPECULAR_INT: f32 = ${specular_INT};
${mipLevelStr}

fn roughness2shininess(roughness: f32) -> f32 {
  return pow(1000.0, 1.-roughness);
}

${textureUV}
${Coord}
${getNormalSpace}
${hammersley}

${textureFilter(polyfill, "_sampler")}

fn diffuse_sample(random: vec2f, TBN: mat3x3f) -> vec3f {
  let phi = 2.0*PI*random.x;
  let theta = asin(sqrt(random.y));
  let pos = TBN * SphereCoord2Dir(phi, theta);
  let uv = Dir2SphereTexCoord(pos);
  let radiance = texture(envMap, uv, mipLevels[0]).rgb;
  return radiance;
}

fn specular_sample(random: vec2f, TBN: mat3x3f, shininess: f32) -> vec3f {
  let phi = 2.0*PI*random.x;
  let theta = acos( pow(1.0-random.y, 1.0/(1.0+shininess)) );
  let pos = TBN * SphereCoord2Dir(phi, theta);
  let uv = Dir2SphereTexCoord(pos);
  let radiance = texture(envMap, uv, mipLevels[1]).rgb;
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
  @builtin(workgroup_id) id: vec3u,
  @builtin(local_invocation_id) local_invocation_id: vec3u,
) {
  let pixel = id.${axis[width_idx]}${axis[height_idx]};
  let size = textureDimensions(specularMap);
  let tc = textureUV(pixel, size);

  let normal = SphereTexCoord2Dir(tc);
  let TBN = getNormalSpace(normal);

  let N = u32(${sampleChunk})*${dispatch_sample};
  var diffuse_dispatch_rad = vec3f(0.0);
  var specular_dispatch_rad = vec3f(0.0);

  let shininess = roughness2shininess(roughness);

  for(var j=0u; j<${dispatch_sample}; j++){
    let i = local_invocation_id.${sample_axis} + j*${sampleChunk};
    let random = hammersley(i, N);
    diffuse_dispatch_rad += diffuse_sample(random, TBN);
    specular_dispatch_rad += specular_sample(random, TBN, shininess);
  }

  add_radiance(diffuse_dispatch_rad, specular_dispatch_rad);
  workgroupBarrier();
  let fin_radiance = read_radiance();

  var fin_diffuse_radiance = fin_radiance[0];
  fin_diffuse_radiance /= f32(N);

  var fin_specular_radiance = fin_radiance[1];
  fin_specular_radiance /= (f32(N)*(1.0+shininess)/(2.0+shininess));

  if(roughness<=0.0){
    textureStore(diffuseMap, pixel, vec4f(fin_diffuse_radiance,1.0));
  }
  textureStore(specularMap, pixel, vec4f(fin_specular_radiance,1.0));
}
`;
};
