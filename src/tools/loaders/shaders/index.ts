export enum ShaderLocation {
  POSITION = 0,
  NORMAL = 1,
  TEXCOORD_0 = 2,
  TANGENT = 3,
}

export const VP_NAME = "tf";
export const M_INSTANCE_NAME = "mtfInstances";

export const VPTransformationMatrixGroupBinding = /* wgsl */ `
struct Transformation {
  projectionMatrix: mat4x4f,
  viewMatrix: mat4x4f,
};

@group(0) @binding(0) var<uniform> ${VP_NAME}: Transformation;
`;

export const MTransformationMatrixGroupBinding = /* wgsl */ `
struct MTransformation {
  modelMatrix: mat4x4f,
  normalMatrix: mat4x4f,
};

@group(1) @binding(0) var<storage> ${M_INSTANCE_NAME}: array<MTransformation>;
`;
