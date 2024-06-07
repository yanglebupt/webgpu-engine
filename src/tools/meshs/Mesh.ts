import { EntityObject } from "../entitys/EntityObject";
import { Geometry } from "../geometrys/Geometry";
import { WireframeGeometry } from "../geometrys/WireframeGeometry";
import { MeshMaterial } from "../materials/MeshMaterial";
import { GPUShaderModuleCacheKey } from "../scene/cache";
import { BuildOptions, Buildable, Renderable, Updatable } from "../scene/types";
import { ShaderLocation } from "../shaders";
import vertex from "../shaders/vertex-wgsl/normal.wgsl";
import { GPUResource } from "../type";
import { Observable, ObservableProxy } from "../utils/Observable";

/**
 * 与 Unity 不同的是，这里我们将 Mesh 认为是 EntityObject，而不是 Component
 */
export class Mesh<
    G extends Geometry = Geometry,
    M extends MeshMaterial = MeshMaterial
  >
  extends EntityObject
  implements
    Buildable,
    Updatable,
    Renderable<(renderPass: GPURenderPassEncoder, device: GPUDevice) => void>
{
  public geometry: G;
  public material: M;

  private buildOptions!: BuildOptions;
  private renderPipeline!: GPURenderPipeline;

  private geometryBuildResult!: {
    vertexCount: number;
    vertexBuffer: GPUBuffer;
    bufferLayout: GPUVertexBufferLayout[];
    vertex: GPUShaderModuleCacheKey<any>;
    bindGroupLayoutEntry: GPUBindGroupLayoutEntry;
    indices: {
      buffer: GPUBuffer;
      format: GPUIndexFormat;
      indexCount: number;
    } | null;
  };

  private materialBuildResult!: {
    bindGroupIndex: number;
    bindGroup: GPUBindGroup;
    bindGroupLayouts: GPUBindGroupLayout[];
    fragment: GPUShaderModuleCacheKey<any>;
  };

  private componentBuildResult!: {
    transformUniformValue: Float32Array;
    transformUniform: GPUBuffer;
    vertexResources: GPUResource[];
  };

  constructor(geometry: G, material: M) {
    super();
    this.geometry = geometry;
    this.material = new ObservableProxy(
      material,
      this.onChange.bind(this)
    ) as M;
  }

  onChange(propertyKey: PropertyKey): void {
    switch (propertyKey) {
      case "wireframe": {
        this.buildGeometry(this.buildOptions.device);
        this.buildPipeline(this.buildOptions);
        break;
      }
      default:
        break;
    }
  }

  render(renderPass: GPURenderPassEncoder) {
    const { vertexBuffer, vertexCount, indices } = this.geometryBuildResult;
    const { bindGroup, bindGroupIndex } = this.materialBuildResult;
    renderPass.setPipeline(this.renderPipeline);
    renderPass.setVertexBuffer(0, vertexBuffer);
    renderPass.setBindGroup(bindGroupIndex, bindGroup);
    if (indices) {
      renderPass.setIndexBuffer(indices.buffer, indices.format);
      renderPass.drawIndexed(indices.indexCount);
    } else {
      renderPass.draw(vertexCount);
    }
  }

  update(device: GPUDevice) {
    this.transform.update();
    const { transformUniformValue, transformUniform } =
      this.componentBuildResult;
    transformUniformValue.set(this.transform.matrix, 0);
    transformUniformValue.set(this.transform.normalMatrix, 16);
    device.queue.writeBuffer(transformUniform, 0, transformUniformValue);
    this.material.update(device);
  }

  buildGeometry(device: GPUDevice) {
    const geometry = this.material.wireframe
      ? new WireframeGeometry(this.geometry)
      : this.geometry;
    const indexFormat = geometry.indexFormat;
    const { positions, indices, uvs, normals } = geometry.attributes;
    const vertexCount = geometry.getCount("POSITION");
    const useNormal = !!normals;
    const useTexcoord = !!uvs;
    const arrayStride =
      Float32Array.BYTES_PER_ELEMENT *
      (3 + (useNormal ? 3 : 0) + (useTexcoord ? 2 : 0));
    const vertexBuffer = device.createBuffer({
      size: arrayStride * vertexCount,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    const attributes: GPUVertexAttribute[] = [
      {
        shaderLocation: ShaderLocation.POSITION,
        format: "float32x3",
        offset: 0,
      },
    ];
    if (useNormal)
      attributes.push({
        shaderLocation: ShaderLocation.NORMAL,
        format: "float32x3",
        offset: 3 * Float32Array.BYTES_PER_ELEMENT,
      });
    if (useTexcoord)
      attributes.push({
        shaderLocation: ShaderLocation.TEXCOORD_0,
        format: "float32x2",
        offset: (3 + (useNormal ? 3 : 0)) * Float32Array.BYTES_PER_ELEMENT,
      });
    const bufferLayout: GPUVertexBufferLayout[] = [
      {
        arrayStride,
        stepMode: "vertex",
        attributes,
      },
    ];
    const vertexData = new Float32Array(
      vertexBuffer.size / Float32Array.BYTES_PER_ELEMENT
    );
    for (let i = 0; i < vertexCount; i++) {
      const vertex = positions.slice(i * 3, (i + 1) * 3);
      const normal = useNormal ? normals.slice(i * 3, (i + 1) * 3) : [];
      const uv = useTexcoord ? uvs.slice(i * 2, (i + 1) * 2) : [];
      vertexData.set(
        Float32Array.of(...vertex, ...normal, ...uv),
        (i * arrayStride) / Float32Array.BYTES_PER_ELEMENT
      );
    }
    device.queue.writeBuffer(vertexBuffer, 0, vertexData);
    let indexBuffer: GPUBuffer | null = null;
    if (indices) {
      indexBuffer = device.createBuffer({
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.INDEX,
        size: indices.length * indices.BYTES_PER_ELEMENT,
      });
      device.queue.writeBuffer(indexBuffer, 0, indices);
    }

    this.geometryBuildResult = {
      vertexCount,
      vertexBuffer,
      bufferLayout,
      vertex: { code: vertex, context: { useNormal, useTexcoord } },
      indices: indices
        ? {
            buffer: indexBuffer!,
            format: indexFormat!,
            indexCount: indices.length,
          }
        : null,
      bindGroupLayoutEntry: {
        binding: 0,
        visibility: GPUShaderStage.VERTEX,
        buffer: { type: "read-only-storage" },
      } as GPUBindGroupLayoutEntry,
    };
  }

  buildComponent(device: GPUDevice) {
    const transformUniform = device.createBuffer({
      size: Float32Array.BYTES_PER_ELEMENT * 4 * 4 * 2,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.STORAGE,
    });
    const transformUniformValue = new Float32Array(
      transformUniform.size / Float32Array.BYTES_PER_ELEMENT
    );
    this.componentBuildResult = {
      transformUniform,
      transformUniformValue,
      vertexResources: [transformUniform],
    };
  }

  buildMaterial(options: BuildOptions) {
    const { bindGroupLayoutEntry } = this.geometryBuildResult;
    const { vertexResources } = this.componentBuildResult;
    const {
      resources: fragmentResources,
      fragment,
      bindGroupLayout,
      bindGroupLayouts,
      bindGroupIndex,
    } = this.material.build(options, bindGroupLayoutEntry);
    const bindGroup = options.device.createBindGroup({
      layout: bindGroupLayout,
      entries: [...vertexResources, ...fragmentResources].map(
        (resource, binding) => ({
          binding,
          resource:
            resource instanceof GPUBuffer ? { buffer: resource } : resource,
        })
      ),
    });

    this.materialBuildResult = {
      bindGroupIndex,
      bindGroup,
      fragment,
      bindGroupLayouts,
    };
  }

  buildPipeline(options: BuildOptions) {
    const { vertex, bufferLayout } = this.geometryBuildResult;
    const { fragment, bindGroupLayouts } = this.materialBuildResult;
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
        bufferLayout,
      },
      bindGroupLayouts
    );
  }

  build(options: BuildOptions) {
    const device = options.device;
    this.buildOptions = options;
    ///////////// 解析 Geometry ////////////////
    this.buildGeometry(device);
    ///////// 解析自己的组件(组件内部也可以有自己的组件) ///////////
    this.buildComponent(device);
    /////////////////// 解析 Material /////////////////////////
    this.buildMaterial(options);
    /////////////////// 创建 pipeline //////////////////
    this.buildPipeline(options);
  }
}
