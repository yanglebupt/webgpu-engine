import { Logger } from "../../../helper";
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
  Logger.log(`N: u32(${sampleChunk})*${dispatch_sample}`);
  let mipLevelStr = `const mipLevels: array<f32, ${mipLevels.length}> = array(`;
  mipLevels.forEach((l) => (mipLevelStr += `${l},`));
  mipLevelStr += ");";

  return wgsl/* wgsl */ `

struct Uniforms {
  roughness: f32,
  level: f32
}

@group(0) @binding(0) var envMap: texture_2d<f32>;
@group(0) @binding(1) var diffuseMap: texture_storage_2d<${format}, write>;
@group(0) @binding(2) var specularMap: texture_storage_2d<${format}, write>;
@group(0) @binding(3) var t1Map: texture_storage_2d<${format}, write>;
@group(0) @binding(4) var t2Map: texture_storage_2d<${format}, write>;
@group(0) @binding(5) var _sampler: sampler;
@group(0) @binding(6) var<uniform> uni: Uniforms;

var<workgroup> diffuse_radiance: array<atomic<u32>, 3>;
var<workgroup> specular_radiance: array<atomic<u32>, 3>;

var<workgroup> t1_radiance: array<atomic<u32>, 3>;
var<workgroup> t1_total_weight: atomic<u32>;
var<workgroup> t2_radiance: array<atomic<u32>, 2>;

const PI = 3.141592653589793;
const DIFFUSE_INT: f32 = ${diffuse_INT};
const SPECULAR_INT: f32 = ${specular_INT};
const ESP = 0.001;
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

fn specular_sample(random: vec2f, TBN: mat3x3f, shininess: f32, level: f32) -> vec3f {
  let phi = 2.0*PI*random.x;
  let theta = acos( pow(1.0-random.y, 1.0/(1.0+shininess)) );
  let pos = TBN * SphereCoord2Dir(phi, theta);
  let uv = Dir2SphereTexCoord(pos);
  let radiance = texture(envMap, uv, max(level, mipLevels[1])).rgb;
  return radiance;
}

fn pbr_specular_t1_sample(random: vec2f, TBN: mat3x3f, roughness: f32, level: f32, normal: vec3f) -> vec4f {
  let phi = 2.0*PI*random.x;
  let alpha = roughness*roughness;
  let alpha2 = alpha*alpha;
  let theta = acos(sqrt( (1.0-random.y)/(random.y*(alpha2-1.0)+1.0) ));
  let H = TBN * SphereCoord2Dir(phi, theta);
  let V = normal;
  let L = reflect(-V, H);
  let NoL = max(dot(normal, L), 0.0);
  let uv = Dir2SphereTexCoord(L);
  let radiance = texture(envMap, uv, level).rgb;
  return vec4f(radiance, NoL);
}

fn G1_SchlickGGX(k: f32, NoX: f32) -> f32 {
  return max(NoX,ESP) / ( k + (1.0-k)*NoX );
}

fn G_Smith(roughness: f32, NoL: f32, NoV: f32) -> f32 {
  let k = roughness*roughness*0.5;
  return G1_SchlickGGX(k, NoL) * G1_SchlickGGX(k, NoV);
}

fn pbr_specular_t2_sample(random: vec2f, NoV: f32, roughness: f32) -> vec2f {
  let thetaView = acos(NoV);
  let V = vec3f(sin(thetaView), 0.0, cos(thetaView)); // phiView = 0.0
  let phi = 2.0*PI*random.x;
  let alpha = roughness*roughness;
  let alpha2 = alpha*alpha;
  let theta = acos(sqrt( (1.0-random.y)/(random.y*(alpha2-1.0)+1.0) ));
  let H = SphereCoord2Dir(phi, theta);
  let L = reflect(-V, H);
  let NoL = saturate(L.z);
  let NoH = saturate(H.z);
  let VoH = saturate(dot(V,H));
  let g = G_Smith(roughness, NoL, NoV)*VoH/(NoH*NoV);
  let f = pow(1.0-VoH, 5.0);
  return vec2f((1.0-f)*g,f*g);
}

fn add_radiance(diffuse_dispatch_rad: vec3f, specular_dispatch_rad: vec3f, 
                t1_dispatch_rad: vec3f, t2_dispatch_rad: vec2f,
                t1_weight: f32,
              ){
  atomicAdd(&diffuse_radiance[0], u32(diffuse_dispatch_rad.x*DIFFUSE_INT));
  atomicAdd(&diffuse_radiance[1], u32(diffuse_dispatch_rad.y*DIFFUSE_INT));
  atomicAdd(&diffuse_radiance[2], u32(diffuse_dispatch_rad.z*DIFFUSE_INT));

  atomicAdd(&specular_radiance[0], u32(specular_dispatch_rad.x*SPECULAR_INT));
  atomicAdd(&specular_radiance[1], u32(specular_dispatch_rad.y*SPECULAR_INT));
  atomicAdd(&specular_radiance[2], u32(specular_dispatch_rad.z*SPECULAR_INT));

  atomicAdd(&t1_total_weight, u32(t1_weight*SPECULAR_INT));

  atomicAdd(&t1_radiance[0], u32(t1_dispatch_rad.x*SPECULAR_INT));
  atomicAdd(&t1_radiance[1], u32(t1_dispatch_rad.y*SPECULAR_INT));
  atomicAdd(&t1_radiance[2], u32(t1_dispatch_rad.z*SPECULAR_INT));

  atomicAdd(&t2_radiance[0], u32(t2_dispatch_rad.x*SPECULAR_INT));
  atomicAdd(&t2_radiance[1], u32(t2_dispatch_rad.y*SPECULAR_INT));
}

fn read_weight() -> f32 {
  return f32(atomicLoad(&t1_total_weight)) / SPECULAR_INT;
}

fn read_radiance() -> array<vec3f,4> {
  let fin_diffuse_radiance = vec3f(
          f32(atomicLoad(&diffuse_radiance[0])),
          f32(atomicLoad(&diffuse_radiance[1])),
          f32(atomicLoad(&diffuse_radiance[2])));

  let fin_specular_radiance = vec3f(
        f32(atomicLoad(&specular_radiance[0])),
        f32(atomicLoad(&specular_radiance[1])),
        f32(atomicLoad(&specular_radiance[2])));

  let fin_t1_radiance = vec3f(
        f32(atomicLoad(&t1_radiance[0])),
        f32(atomicLoad(&t1_radiance[1])),
        f32(atomicLoad(&t1_radiance[2])));

  let fin_t2_radiance = vec2f(
      f32(atomicLoad(&t2_radiance[0])),
      f32(atomicLoad(&t2_radiance[1])));

  return array(fin_diffuse_radiance / DIFFUSE_INT, fin_specular_radiance / SPECULAR_INT, 
              fin_t1_radiance / SPECULAR_INT, vec3f(fin_t2_radiance / SPECULAR_INT, 0.0));
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
  var t1_dispatch_rad = vec3f(0.0);
  var t1_weight = 0.0;
  var t2_dispatch_rad = vec2f(0.0);

  let roughness = uni.roughness;
  let level = uni.level;

  let shininess = roughness2shininess(roughness);
  let isFirst = roughness<=0.0;

  for(var j=0u; j<${dispatch_sample}; j++){
    let i = local_invocation_id.${sample_axis} + j*${sampleChunk};
    let random = hammersley(i, N);
    diffuse_dispatch_rad += diffuse_sample(random, TBN);
    specular_dispatch_rad += specular_sample(random, TBN, shininess, level);
    let t1 = pbr_specular_t1_sample(random, TBN, roughness, level, normal);
    t1_dispatch_rad += t1.xyz*t1.w;
    t1_weight += t1.w;
    t2_dispatch_rad += pbr_specular_t2_sample(random, tc.x, tc.y);
  }

  add_radiance(diffuse_dispatch_rad, specular_dispatch_rad, 
              t1_dispatch_rad, t2_dispatch_rad, t1_weight);
  workgroupBarrier();
  let fin_radiance = read_radiance();
  let fin_weight = read_weight();

  var fin_diffuse_radiance = fin_radiance[0];
  fin_diffuse_radiance /= f32(N);

  var fin_specular_radiance = fin_radiance[1];
  fin_specular_radiance /= (f32(N)*(1.0+shininess)/(2.0+shininess));
  
  var fin_t1_radiance = fin_radiance[2];
  fin_t1_radiance /= fin_weight;

  var fin_t2_radiance = fin_radiance[3];
  fin_t2_radiance /= f32(N);

  if(isFirst){
    textureStore(diffuseMap, pixel, vec4f(fin_diffuse_radiance,1.0));
    textureStore(t2Map, pixel, vec4f(fin_t2_radiance,1.0));
  }
  textureStore(specularMap, pixel, vec4f(fin_specular_radiance,1.0));
  textureStore(t1Map, pixel, vec4f(fin_t1_radiance,1.0));
}
`;
};
