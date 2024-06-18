import {
  MTransformationMatrixGroupBinding,
  M_INSTANCE_NAME,
  ShaderContext,
  VPTransformationMatrixGroupBinding,
  VP_NAME,
} from "..";
import { wgsl } from "wgsl-preprocessor";

interface ShaderContextParameter {
  useTexcoord: boolean;
  useNormal: boolean;
  bindingStart: number;
}

export default (context: ShaderContext<ShaderContextParameter>) => {
  const { useNormal, useTexcoord, bindingStart = 0 } = context;

  return wgsl/* wgsl */ `
${VPTransformationMatrixGroupBinding}
${MTransformationMatrixGroupBinding(bindingStart)}

@group(1) @binding(${
    bindingStart + 1
  }) var<storage, read> positions: array<f32>;
@group(1) @binding(${bindingStart + 2}) var<storage, read> indices: array<u32>;

#if ${useNormal}
@group(1) @binding(${bindingStart + 3}) var<storage, read> normals: array<f32>;
#endif
#if ${useTexcoord}
@group(1) @binding(${bindingStart + 4}) var<storage, read> uv0s: array<f32>;
#endif

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) normal: vec3f,
  @location(1) pos: vec3f,
  @location(2) uv0: vec2f,
  @location(3) cameraPos: vec3f
};


@vertex
fn main(
  @builtin(vertex_index) vertexIndex : u32,
  @builtin(instance_index) instanceIndex : u32
) -> VertexOutput {
    var o: VertexOutput;

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

    let normal = vec4f(
        normals[3u * elementIndex + 0u],
        normals[3u * elementIndex + 1u],
        normals[3u * elementIndex + 2u],
        0.0
    );

    let uv0 = vec2f(
        uv0s[2u * elementIndex + 0u],
        uv0s[2u * elementIndex + 1u],
    );

    let modelTransform = ${M_INSTANCE_NAME}[instanceIndex];
    let pos = modelTransform.modelMatrix * position;
    o.pos = pos.xyz/pos.w;
    o.cameraPos = ${VP_NAME}.cameraPosition;
    o.position = ${VP_NAME}.projectionMatrix * ${VP_NAME}.viewMatrix * pos;
    #if ${useNormal}
    o.normal = (modelTransform.normalMatrix * normal).xyz;
    #else
    o.normal = vec3f(0);
    #endif
    #if ${useTexcoord}
    o.uv0 = uv0;
    #else
    o.uv0 = vec2f(0);
    #endif
    return o;
};`;
};
