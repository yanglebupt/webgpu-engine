import { Geometry } from "../geometrys/Geometry";
import { MeshMaterial } from "../materials/MeshMaterial";
import { BuildOptions } from "../scene/types";
import wireframe from "../shaders/vertex-wgsl/wireframe.wgsl";
import { GPUResource } from "../type";
import { getBlendFromPreset } from "../utils/Blend";
import { Object3D, WatchAction } from "./Object3D";

/**
 * 与 Unity 不同的是，这里我们将 Mesh 认为是 EntityObject，而不是 Component
 */
export class Mesh<
  G extends Geometry = Geometry,
  M extends MeshMaterial = MeshMaterial
> extends Object3D<G, M> {
  static watch = {
    wireframe: [WatchAction.Geometry, WatchAction.Pipeline],
    blending: [WatchAction.Pipeline],
    blendingPreset: [WatchAction.Pipeline],
  };

  type: string = "Mesh";

  buildWireframe(device: GPUDevice) {
    const geometry = this.geometry;
    const { positions, indices, normals, uvs } = geometry.attributes;
    const vertexCount = !!indices
      ? indices.length
      : geometry.getCount("POSITION");

    const bindingStart = this.materialBuildResult.vertexBindingStart;
    let binding = bindingStart;
    const bindGroupLayoutEntries: GPUBindGroupLayoutEntry[] = [
      {
        binding: binding,
        visibility: GPUShaderStage.VERTEX,
        buffer: { type: "read-only-storage" },
      },
    ];
    const resources: GPUResource[] = [];

    [positions, indices, normals, uvs].forEach((array, idx) => {
      if (array === undefined) return;
      const isIndex = idx === 1;
      const buffer = device.createBuffer({
        size: isIndex
          ? array.length * Uint32Array.BYTES_PER_ELEMENT
          : array.byteLength,
        usage: GPUBufferUsage.STORAGE,
        mappedAtCreation: true,
      });
      resources.push(buffer);
      new (isIndex ? Uint32Array : Float32Array)(buffer.getMappedRange()).set(
        array
      );
      buffer.unmap();

      bindGroupLayoutEntries.push({
        binding: ++binding,
        visibility: GPUShaderStage.VERTEX,
        buffer: { type: "read-only-storage" },
      });
    });

    this.geometryBuildResult = {
      vertexCount: vertexCount * 2,
      vertex: {
        code: wireframe,
        context: { useNormal: !!normals, useTexcoord: !!uvs, bindingStart },
      },
      resources,
      indices: null,
      bindGroupLayoutEntries: bindGroupLayoutEntries,
    };
  }

  buildGeometry(device: GPUDevice) {
    if (this.material.wireframe) return this.buildWireframe(device);
    super.buildGeometry(device);
  }

  buildPipeline(options: BuildOptions) {
    const { bufferLayout } = this.geometryBuildResult;
    const { bindGroupLayouts, fragment, vertex } = this.resources;
    const blending = this.material.blendingPreset
      ? getBlendFromPreset(this.material.blendingPreset)
      : this.material.blending;
    this.renderPipeline = options.cached.pipeline.get(
      vertex,
      fragment,
      {
        format: options.format,
        /**
         * 三角面和线框有不同，例如一个平面，两个三角面 6个点，只能画出 3 条线，缺两条线
         * 因此我们需要重新计算 line-list 的 buffer，同时线框不需要 material，因此可以考虑单独用一个 Wireframe 的类来实现
         * 生成 line-list 需要注意，不要添加了重复的线
         */
        primitive: {
          topology: this.material.wireframe ? "line-list" : "triangle-list",
        },
        depthStencil: {
          format: options.depthFormat,
          depthWriteEnabled: true,
          depthCompare: "less",
        },
        // 没有则不添加该属性，undefined 的属性会被 JSON.stringify() 清除，但 null 不会
        multisample: options.antialias ? { count: 4 } : undefined,
        bufferLayout,
        blending,
      },
      bindGroupLayouts
    );
  }
}
