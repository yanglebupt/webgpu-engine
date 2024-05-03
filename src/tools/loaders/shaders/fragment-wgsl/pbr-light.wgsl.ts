import { wgsl } from "wgsl-preprocessor";
import { ShaderContext } from "../..";

export const M_U_NAME = "material";
export const MaterialUniform = /* wgsl */ `
struct Material { 
  baseColorFactor: vec4f,
  alphaCutoff: f32,
}

@group(2) @binding(0) var<uniform> ${M_U_NAME}: Material;
`;

export default (context: ShaderContext) => wgsl/* wgsl */ `
const lightDir = vec3f(0, -1, 0);
const lightColor = vec3f(0.5);
const ambientColor = vec3f(0.5);

${MaterialUniform}
// 贴图
@group(2) @binding(1) var baseColorTexture: texture_2d<f32>;
@group(2) @binding(2) var normalTexture: texture_2d<f32>;
@group(2) @binding(3) var metallicRoughnessTexture: texture_2d<f32>;
@group(2) @binding(4) var emissiveTexture: texture_2d<f32>;
@group(2) @binding(5) var occlusionTexture: texture_2d<f32>;

// sampler
@group(2) @binding(6) var materialSampler: sampler;

@fragment
fn main(
  @location(0) norm: vec3f, 
  @location(1) uv0: vec2f
) -> @location(0) vec4f {
  let baseColor = ${M_U_NAME}.baseColorFactor * textureSample(baseColorTexture, materialSampler, uv0);
  #if ${context.useAlphaCutoff}
    if(baseColor.a < ${M_U_NAME}.alphaCutoff){
      discard;
    }
  #endif
  let n = normalize(norm);
  let l = normalize(lightDir);
  let surfaceColor = baseColor.rgb * (ambientColor + lightColor * saturate(dot(n, -l)));
  return vec4f(surfaceColor, baseColor.a);
}
`;
