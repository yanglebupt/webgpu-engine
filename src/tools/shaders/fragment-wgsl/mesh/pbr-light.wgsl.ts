import { wgsl } from "wgsl-preprocessor";
import {
  ENV_NAME,
  EnvMapGroupBinding,
  L_NAME,
  LightGroupBinding,
  ShaderContext,
} from "../..";
import { Coord, textureFilter } from "../../utils";

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
  useEnvMap: u32,
}

@group(2) @binding(0) var<uniform> ${M_U_NAME}: Material;
`;

interface ShaderContextParameter {
  polyfill: boolean;
  useAlphaCutoff: boolean;
}

export default (context: ShaderContext<ShaderContextParameter>) => {
  return wgsl/* wgsl */ `

const PI = 3.141592653589793;
const RECIPROCAL_PI = 0.3183098861837907;
const RECIPROCAL_2PI = 0.15915494309189535;
const ESP = 0.001;

const reflectance = 0.5;

${LightGroupBinding}
${EnvMapGroupBinding}
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
  return select(1.055*(pow( lin, vec3f(0.41666) )) - 0.055, lin*12.92, lin<vec3f(0.0031308));
}

fn rgb2lin(rgb: vec3f) -> vec3f {
  return select(pow(rgb * 0.9478672986 + 0.0521327014, vec3f(2.4)), rgb * 0.0773993808, rgb<vec3f(0.04045));
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

fn applyNormalMap(localNorm: vec3f, normalScale: f32, uv0: vec2f, normal: vec3f, p: vec3f) -> vec3f {
  let n = normalize((2.0 * localNorm - 1.0)*vec3f(normalScale,normalScale,1.0));
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

fn irradiance_direction_light(in_light: InputLight, n: vec3f) -> Light {
  var light: Light;
  let l = normalize(-in_light.dir);  // towards light
  let irradiance = max(dot(l,n),0.0) * in_light.flux;
  light.dir = l;
  light.ir = irradiance * rgb2lin(in_light.color.rgb);
  return light;
}

fn irradiance_point_light(in_light: InputLight, pos: vec3f, n: vec3f) -> Light {
  var light: Light;
  let lightDir = in_light.pos - pos;
  let r = length(lightDir);
  let l = normalize(lightDir);
  let irradiance = max(dot(l,n),0.0) * in_light.flux / (4.0 * PI * pow(r, 2.0));
  light.dir = l;
  light.ir = irradiance * rgb2lin(in_light.color.rgb);
  return light;
}

fn irradiance_ambient_light(in_light: InputLight, n: vec3f) -> Light {
  var light: Light;
  light.dir = n;
  light.ir = in_light.flux*rgb2lin(in_light.color.rgb); 
  return light;
}


// fn irradiance_spot_light(in_light: InputLight, pos: vec3f, n: vec3f) -> Light {
//   var light: Light;
//   let lightDir = in_light.pos - pos;
//   let r = length(lightDir);
//   let l = normalize(lightDir);
//   let nv = in_light.n;
//   let beta_max = in_light.beta_max;
//   let d = in_light.d;
//   let cos_beta = dot(d, -l);
//   let p = (nv+1.0)*pow(cos_beta, nv)*max(dot(l,n),0.0)/(1.0-pow(cos(beta_max), nv+1.0));
//   let irradiance = p*in_light.flux / (2.0 * PI * pow(r, 2.0));
//   light.dir = l;
//   light.ir = irradiance * rgb2lin(in_light.color.rgb);
//   return light;
// }

fn radiance_render(brdf: vec3f, ir: vec3f) -> vec3f {
  return brdf * ir;
}

${textureFilter(context.polyfill, "envSampler")}

${Coord}
fn envIBL(diffuseMap: texture_2d<f32>, specularMap: texture_2d<f32>, roughness: f32,
          n: vec3f, v: vec3f) -> vec3f {

  let r_v = reflect(-v, n);
  // linear
  let env_diff = texture(diffuseMap,Dir2SphereTexCoord(n),0.0).rgb;
  let env_spec = texture(specularMap,Dir2SphereTexCoord(r_v),roughness*${ENV_NAME}.specularDetails).rgb;
  let rho_d =  ${ENV_NAME}.diffuseFactor * rgb2lin(${ENV_NAME}.diffuseColor.rgb);
  let rho_s = ${ENV_NAME}.specularFactor * rgb2lin(${ENV_NAME}.specularColor.rgb);
  
  var radiance = rho_d * env_diff;
  let rn = dot(n, r_v);
  if(rn>0.0){
    radiance += rn * rho_s * env_spec;
  }
  return radiance;
}

fn textureSample_rgb2lin(texture: texture_2d<f32>, _sampler: sampler, uv: vec2f) -> vec4f {
  let col = textureSample(texture, _sampler, uv);
  return vec4f(rgb2lin(col.rgb), col.a);
}

@fragment
fn main(
  @location(0) norm: vec3f, 
  @location(1) pos: vec3f,
  @location(2) uv0: vec2f,  
  @location(3) cameraPos: vec3f
) -> @location(0) vec4f {

  let baseColor = ${M_U_NAME}.baseColorFactor * textureSample_rgb2lin(baseColorTexture, materialSampler, uv0);
  let metallicRoughness = textureSample(metallicRoughnessTexture, materialSampler, uv0);
  let roughness = ${M_U_NAME}.roughnessFactor * metallicRoughness.g;
  let metallic = ${M_U_NAME}.metallicFactor * metallicRoughness.b;
  let emissiveColor = ${M_U_NAME}.emissiveFactor * textureSample_rgb2lin(emissiveTexture, materialSampler, uv0).rgb;
  
  let v = normalize(cameraPos-pos);
  let n = select(normalize(norm), 
                applyNormalMap(textureSample(normalTexture, materialSampler, uv0).xyz, ${M_U_NAME}.normalScale, uv0, normalize(norm), v),
                bool(${M_U_NAME}.applyNormalMap));

  var radiance = emissiveColor + 
            select(vec3f(0.0), envIBL(diffuseMap,specularMap,roughness,n,v), bool(${M_U_NAME}.useEnvMap));
  ///////////////////////////////////////////
  for(var i=0u; i<${L_NAME}.lightNums; i++){
    let in_light = ${L_NAME}.lights[i];
    var out_light: Light;
    switch in_light.ltype {
      case 1: {
        out_light = irradiance_direction_light(in_light, n);
        break; 
      }
      case 2: {
        out_light = irradiance_point_light(in_light, pos, n); 
        break; 
      }
      case 4: {
        out_light = irradiance_ambient_light(in_light, n);
        break; 
      }
      default: {
        break; 
      }
    }
    let brdf = cook_torrance_MicrofacetBRDF(out_light.dir, n, v, baseColor.rgb,
                          roughness, metallic, reflectance);
                          
    radiance += radiance_render(brdf, out_light.ir);
  }
  ///////////////////////////////////////////
  let rgb = lin2rgb(radiance);

  #if ${context.useAlphaCutoff}
    if(baseColor.a < ${M_U_NAME}.alphaCutoff){discard;}
  #endif
  return vec4f(rgb, baseColor.a);
}
`;
};
