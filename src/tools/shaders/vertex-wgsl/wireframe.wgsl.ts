import { ShaderContext } from "..";
import { wgsl } from "wgsl-preprocessor";
import {
  Entry,
  Global,
  NormalVertexShaderContextParameter,
} from "./normal.wgsl";

export default (context: ShaderContext<NormalVertexShaderContextParameter>) => {
  const { useNormal, useTexcoord, isSkeleton = false } = context;
  let bindingStart = context.bindingStart;
  return wgsl/* wgsl */ `
${Global(bindingStart)}
@group(1) @binding(${++bindingStart}) var<storage, read> positions: array<f32>;
@group(1) @binding(${++bindingStart}) var<storage, read> indices: array<u32>;
#if ${(useNormal ? ++bindingStart : bindingStart, useNormal)}
@group(1) @binding(${bindingStart}) var<storage, read> normals: array<f32>;
#endif
#if ${(useTexcoord ? ++bindingStart : bindingStart, useTexcoord)}
@group(1) @binding(${bindingStart}) var<storage, read> uv0s: array<f32>;
#endif
#if ${(isSkeleton ? ++bindingStart : bindingStart, isSkeleton)}
@group(1) @binding(${bindingStart}) var<storage, read> bonesLength: array<f32>;
#endif
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

    var position = vec4f(
        positions[3u * elementIndex + 0u],
        positions[3u * elementIndex + 1u],
        positions[3u * elementIndex + 2u],
        1.0
    );
    #if ${useNormal}
    var normal = vec3f(
        normals[3u * elementIndex + 0u],
        normals[3u * elementIndex + 1u],
        normals[3u * elementIndex + 2u],
    );
    #endif
    #if ${useTexcoord}
    var uv0 = vec2f(
        uv0s[2u * elementIndex + 0u],
        uv0s[2u * elementIndex + 1u],
    );
    #endif
    ${Entry(useNormal, useTexcoord, isSkeleton)}
};`;
};
