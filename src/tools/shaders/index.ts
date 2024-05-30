export enum ShaderLocation {
  POSITION = 0,
  NORMAL = 1,
  TEXCOORD_0 = 2,
  TANGENT = 3,
}

export type ShaderModuleCode = (context: Record<string, any>) => string;

export type ShaderContext<T = Record<string, any>> = T;

export const VP_NAME = "tf";
export const M_INSTANCE_NAME = "mtfInstances";
export const L_NAME = "lightCollection";
export const ENV_NAME = "env";

export const VPTransformationMatrixGroupBinding = /* wgsl */ `
struct Transformation {
  projectionMatrix: mat4x4f,
  viewMatrix: mat4x4f,
  cameraPosition: vec3f,
};

@group(0) @binding(0) var<uniform> ${VP_NAME}: Transformation;
`;

export const LightGroupBinding = /* wgsl */ `
struct InputLight {
  dir: vec3f,
  pos: vec3f,
  color: vec4f,
  flux: f32,
  ltype: u32,
};

struct InputLightGroup {
  lightNums: u32,
  lights: array<InputLight>
}

@group(0) @binding(1) var<storage> ${L_NAME}: InputLightGroup;
`;

export const EnvMapGroupBinding = /* wgsl */ `
struct EnvUniform {
  diffuseColor: vec4f,
  specularColor: vec4f,
  diffuseFactor: vec3f,
  specularFactor: vec3f,
  specularDetails: f32,
};
@group(0) @binding(2) var diffuseMap: texture_2d<f32>;
@group(0) @binding(3) var specularMap: texture_2d<f32>;
@group(0) @binding(4) var<uniform> ${ENV_NAME}: EnvUniform;
@group(0) @binding(5) var envSampler: sampler;
`;

export const MTransformationMatrixGroupBinding = /* wgsl */ `
struct MTransformation {
  modelMatrix: mat4x4f,
  normalMatrix: mat4x4f,
};

@group(1) @binding(0) var<storage> ${M_INSTANCE_NAME}: array<MTransformation>;
`;
