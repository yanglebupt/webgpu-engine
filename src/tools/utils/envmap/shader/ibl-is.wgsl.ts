import {
  Coord,
  getNormalSpace,
  hammersley,
  textureUV,
} from "../../../../tools/shaders/utils";
import { IDX, axis } from "../../../../tools/utils/Dispatch";

export default (
  format: GPUTextureFormat,
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
  return /* wgsl */ `
@group(0) @binding(0) var envMap: texture_storage_2d<${format}, read>;
@group(0) @binding(1) var inverseCDFMap: texture_storage_2d<${format}, read>;
@group(0) @binding(2) var diffuseMap: texture_storage_2d<${format}, write>;
@group(0) @binding(3) var specularMap: texture_storage_2d<${format}, write>;
@group(0) @binding(4) var<uniform> roughness: f32;

const PI = 3.141592653589793;
const DIFFUSE_INT: f32 = ${diffuse_INT};
const SPECULAR_INT: f32 = ${specular_INT};

${Coord}
${getNormalSpace}
${hammersley}
${textureUV}

fn texture(map: texture_storage_2d<${format}, read>, uv: vec2f, size: vec2u) -> vec4f {
  return textureLoad(map, texturePixel(uv, size)); 
}

fn roughness2shininess(roughness: f32) -> f32 {
  return pow(1000.0, 1.-roughness);
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


var<workgroup> diffuse_radiance: array<atomic<u32>, 3>;
var<workgroup> specular_radiance: array<atomic<u32>, 3>;

@compute @workgroup_size(${chunkSize.join(",")})
fn main(
  @builtin(workgroup_id) id: vec3u,
  @builtin(local_invocation_id) local_invocation_id: vec3u,
){
  let pixel = id.${axis[width_idx]}${axis[height_idx]};
  let tc = textureUV(pixel, textureDimensions(specularMap));

  let size = textureDimensions(envMap);

  let normal = SphereTexCoord2Dir(tc);
  let N = u32(${sampleChunk})*${dispatch_sample};

  var diffuse_dispatch_rad = vec3f(0.0);
  var specular_dispatch_rad = vec3f(0.0);

  let shininess = roughness2shininess(roughness);
  
  // dispatch_sample 很小，不如直接串行，否则还需要合并有些麻烦
  for(var j=0u; j<${dispatch_sample}; j++){
    let i = local_invocation_id.${sample_axis} + j*${sampleChunk};
    let random = hammersley(i, N);
    let sampleY = texture(inverseCDFMap, vec2f(0, random.y), size).b;
    let sampleX = texture(inverseCDFMap, vec2f(random.x, sampleY), size).g;
    let uv = vec2f(sampleX, sampleY);
    let pos = SphereTexCoord2Dir(uv);
    let cosTheta = dot(pos, normal);
    let pdf = max(texture(inverseCDFMap, uv, size).r, 1e-4);
    let theta = PI*(1.0-uv.y);
    let l = texture(envMap, uv, size).rgb;
    diffuse_dispatch_rad += select(
      vec3f(0.0),
      2.0*PI*l*cosTheta*sin(theta)/pdf,
      cosTheta>0.0
    );
    specular_dispatch_rad += select(
      vec3f(0.0),
      PI*l*pow(cosTheta, shininess)*sin(theta)/pdf,
      cosTheta>0.0
    );
  }

  add_radiance(diffuse_dispatch_rad, specular_dispatch_rad);
  workgroupBarrier();
  
  let fin_radiance = read_radiance();

  var fin_diffuse_radiance = fin_radiance[0];
  fin_diffuse_radiance /= f32(N);

  var fin_specular_radiance = fin_radiance[1];
  fin_specular_radiance /= (f32(N)/(2.0+shininess));

  if(roughness<=0.0){
    textureStore(diffuseMap, pixel, vec4f(fin_diffuse_radiance,1.0));
  }
  textureStore(specularMap, pixel, vec4f(fin_specular_radiance,1.0));
}
`;
};
