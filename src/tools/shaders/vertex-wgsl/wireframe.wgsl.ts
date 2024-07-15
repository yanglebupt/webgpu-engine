import { ShaderContext } from "..";
import { wgsl } from "wgsl-preprocessor";
import { Entry, Global } from "./normal.wgsl";

interface ShaderContextParameter {
  useTexcoord: boolean;
  useNormal: boolean;
  bindingStart: number;
}

export default (context: ShaderContext<ShaderContextParameter>) => {
  const { useNormal, useTexcoord, bindingStart = 0 } = context;
  return wgsl/* wgsl */ `
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
${Global(bindingStart)}
@vertex
fn main(
  @builtin(vertex_index) vertexIndex : u32,
  @builtin(instance_index) instanceIndex : u32
) -> VertexOutput {
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
    #if ${useNormal}
    let normal = vec3f(
        normals[3u * elementIndex + 0u],
        normals[3u * elementIndex + 1u],
        normals[3u * elementIndex + 2u],
    );
    #endif
    #if ${useTexcoord}
    let uv0 = vec2f(
        uv0s[2u * elementIndex + 0u],
        uv0s[2u * elementIndex + 1u],
    );
    #endif
    ${Entry(useNormal, useTexcoord)}
};`;
};
