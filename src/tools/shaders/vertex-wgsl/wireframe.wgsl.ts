import {
  MTransformationMatrixGroupBinding,
  M_INSTANCE_NAME,
  VPTransformationMatrixGroupBinding,
  VP_NAME,
} from "..";
import { wgsl } from "wgsl-preprocessor";

export default () => {
  return wgsl/* wgsl */ `
${VPTransformationMatrixGroupBinding}
${MTransformationMatrixGroupBinding}

@group(1) @binding(1) var<storage, read> positions: array<f32>;
@group(1) @binding(2) var<storage, read> indices: array<u32>;

@vertex
fn main(
  @builtin(vertex_index) vertexIndex : u32,
  @builtin(instance_index) instanceIndex : u32
) -> @builtin(position) vec4f {
    // https://github.com/m-schuetz/webgpu_wireframe_thicklines
    
    let localToElement = array<u32, 6>(0u, 1u, 1u, 2u, 2u, 0u);

    let triangleIndex = vertexIndex / 6u;  // 绘制第几个三角形
    let localVertexIndex = vertexIndex % 6u;  // 绘制线段的第几个点

    // 当前点对应的 indices 中的索引，start + offset
    let elementIndexIndex = 3u * triangleIndex + localToElement[localVertexIndex]; 
    let elementIndex = indices[elementIndexIndex];

    let position = vec4f(
        positions[3u * elementIndex + 0u],
        positions[3u * elementIndex + 1u],
        positions[3u * elementIndex + 2u],
        1.0
    );
    let modelTransform = ${M_INSTANCE_NAME}[instanceIndex];
    return ${VP_NAME}.projectionMatrix * ${VP_NAME}.viewMatrix * modelTransform.modelMatrix * position;
};`;
};
