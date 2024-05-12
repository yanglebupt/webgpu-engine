import { wgsl } from "wgsl-preprocessor";
import { ShaderContext } from "..";

export const M_U_NAME = "material";
export const MaterialUniform = /* wgsl */ `
struct Material { 
  baseColorFactor: vec4f,
  metallicFactor: f32,
  roughnessFactor: f32,
  emissiveFactor: vec3f,
  normalScale:f32,
  occlusionStrength: f32,
  alphaCutoff: f32,
  applyNormalMap: u32,
}

@group(2) @binding(0) var<uniform> ${M_U_NAME}: Material;
`;

export default (context: ShaderContext) => wgsl/* wgsl */ `
const lightDir = vec3f(-1, -1, -1);
const lightColor = vec4f(1.0);
const flux = 10.0;

const PI = 3.141592653589793;
const RECIPROCAL_PI = 0.3183098861837907;
const RECIPROCAL_2PI = 0.15915494309189535;
const ESP = 0.001;

const reflectance = 0.5;

${MaterialUniform}
// 贴图
@group(2) @binding(1) var baseColorTexture: texture_2d<f32>;
@group(2) @binding(2) var normalTexture: texture_2d<f32>;
@group(2) @binding(3) var metallicRoughnessTexture: texture_2d<f32>;
@group(2) @binding(4) var emissiveTexture: texture_2d<f32>;
@group(2) @binding(5) var occlusionTexture: texture_2d<f32>;

// sampler
@group(2) @binding(6) var materialSampler: sampler;

fn lin2rgb(lin: vec3f) -> vec3f {
  return pow(lin, vec3f(1.0/2.2));
}

fn rgb2lin(rgb: vec3f) -> vec3f {
  return pow(rgb, vec3f(2.2));
}

// from http://www.thetenthplanet.de/archives/1180
fn cotangentFrame(N: vec3f, p: vec3f, uv: vec2f) -> mat3x3f
{
    // get edge vectors of the pixel triangle
    let dp1 = dpdx( p );
    let dp2 = dpdy( p );
    let duv1 = dpdx( uv );
    let duv2 = dpdy( uv );
 
    // solve the linear system
    let dp2perp = cross( dp2, N );
    let dp1perp = cross( N, dp1 );
    let T = dp2perp * duv1.x + dp1perp * duv2.x;
    let B = dp2perp * duv1.y + dp1perp * duv2.y;
 
    // construct a scale-invariant frame 
    let invmax = inverseSqrt( max( dot(T,T), dot(B,B) ) );
    return mat3x3f( T * invmax, B * invmax, N );
}

fn applyNormalMap(localNorm: vec3f, uv0: vec2f, normal: vec3f, p: vec3f) -> vec3f {
  let n = normalize(2.0 * localNorm - 1.0);
  let tbn = cotangentFrame(normal, -p, uv0);
  return normalize(tbn * n);
}

fn fresnelSchlick(F0: vec3f, VoH: f32) -> vec3f {
  return F0 + (1.0 - F0) * pow( (1.0 - VoH), 5.0);
}

fn D_GGX(roughness: f32, NoH: f32) -> f32 {
  let alpha2 = pow(roughness, 4.0);
  return RECIPROCAL_PI * alpha2 / pow(1.0 + NoH*NoH*(alpha2-1.0), 2.0);
}

fn G1_SchlickGGX(k: f32, NoX: f32) -> f32 {
  return max(NoX,ESP) / ( k + (1.0-k)*NoX );
}

fn G_Smith(roughness: f32, NoL: f32, NoV: f32) -> f32 {
  let k = roughness*roughness*0.5;
  return G1_SchlickGGX(k, NoL) * G1_SchlickGGX(k, NoV);
}

fn cook_torrance_MicrofacetBRDF(l: vec3f, n: vec3f, v: vec3f, baseColor: vec3f, 
                                  roughness: f32, metallic: f32, reflectance: f32) -> vec3f {
  let h = normalize(l+v);
  let VoH = max(dot(v,h),0.0);
  let NoH = max(dot(n,h),0.0);
  let NoV = max(dot(n,v),0.0);
  let NoL = max(dot(n,l),0.0);
  
  // metal F0 is baseColor, dielectric F0 is reflectance
  let F0 = mix(vec3f(0.16 * reflectance * reflectance), baseColor, metallic);
  
  let F = fresnelSchlick(F0, NoH);
  let D = D_GGX(roughness, NoH);
  let G = G_Smith(roughness, NoL, NoV);
  let spec = (D*G)/(4.0*max(NoL,ESP)*max(NoV,ESP));
  
  // metal diffuse is zero, dielectric diffuse is baseColor*transmitted
  let diff = RECIPROCAL_PI * mix(baseColor, vec3f(0.0), metallic); 
  
  return (1.0-F)*diff + F*spec;
}

struct Light {
  dir: vec3f,
  ir: vec3f,
};

fn irradiance_direction_light(flux: f32, lightDir: vec3f, lightColor: vec4f, pos: vec3f, n: vec3f) -> Light {
  var light: Light;
  let l = normalize(-lightDir);  // towards light
  let irradiance = max(dot(l,n),0.0) * flux;
  light.dir = l;
  light.ir = irradiance * rgb2lin(lightColor.rgb);
  return light;
}


fn radiance_render(brdf: vec3f, ir: vec3f) -> vec3f {
  return brdf * ir;
}

@fragment
fn main(
  @location(0) norm: vec3f, 
  @location(1) pos: vec3f,
  @location(2) uv0: vec2f,  
  @location(3) cameraPos: vec3f
) -> @location(0) vec4f {
  let baseColor = ${M_U_NAME}.baseColorFactor * textureSample(baseColorTexture, materialSampler, uv0);
  let metallicRoughness = textureSample(metallicRoughnessTexture, materialSampler, uv0);
  let roughness = ${M_U_NAME}.roughnessFactor * metallicRoughness.g;
  let metallic = ${M_U_NAME}.metallicFactor * metallicRoughness.b;
  let emissiveColor = ${M_U_NAME}.emissiveFactor * textureSample(emissiveTexture, materialSampler, uv0).rgb;
  
  let v = normalize(cameraPos-pos);
  let n = select(normalize(norm), 
                applyNormalMap(textureSample(normalTexture, materialSampler, uv0).xyz, uv0, normalize(norm), v),
                bool(${M_U_NAME}.applyNormalMap));

  var radiance = rgb2lin(emissiveColor);  
  ///////////////////////////////////////////
  let light = irradiance_direction_light(flux, lightDir, lightColor, vec3(0.0), n); 
  let brdf = cook_torrance_MicrofacetBRDF(light.dir, n, v, rgb2lin(baseColor.rgb),
                        roughness, metallic, reflectance);
                        
  radiance += radiance_render(brdf, light.ir);
  ///////////////////////////////////////////
  let rgb = lin2rgb(radiance);

  #if ${context.useAlphaCutoff}
    if(baseColor.a < ${M_U_NAME}.alphaCutoff){
      discard;
    }
  #endif
  return vec4f(rgb, baseColor.a);
}
`;
