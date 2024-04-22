export enum ShaderLocation {
  POSITION = 0,
  NORMAL = 1,
  TEXCOORD_0 = 2,
  TANGENT = 3,
}

export const VPTransformationMatrixGroupBinding = /* wgsl */ `
struct Transformation {
  projectionMatrix: mat4x4f,
  viewMatrix: mat4x4f,
};

@group(0) @binding(0) var<uniform> trf: Transformation;
`;
