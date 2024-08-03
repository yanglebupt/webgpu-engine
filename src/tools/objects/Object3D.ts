import { mat4, vec3 } from "wgpu-matrix";
import { getBindGroupEntries } from "..";
import { EntityObject } from "../entitys/EntityObject";
import { BufferAttribute, Geometry } from "../geometrys/Geometry";
import { Material, ShaderBuildResult } from "../materials/Material";
import { GPUShaderModuleCacheKey } from "../scene/cache";
import { BuildOptions } from "../scene/types";
import { ShaderLocation } from "../shaders";
import vertex from "../shaders/vertex-wgsl/normal.wgsl";
import { GPUResource } from "../type";
import {
  ObservableActionParams,
  ObservableProxy,
  WatchPropertyKey,
} from "../utils/Observable";
import { WireframeGeometry } from "../geometrys/WireframeGeometry";

export enum WatchAction {
  Geometry = "buildGeometry",
  Material = "buildMaterial",
  Pipeline = "buildPipeline",
  Component = "buildComponent",
}

/**
 * 与 Unity 不同的是，这里我们将 Mesh 认为是 EntityObject，而不是 Component
 */
export abstract class Object3D<
  G extends Geometry = Geometry,
  M extends Material = Material
> extends EntityObject {
  abstract type: string;
  static watch: WatchPropertyKey;

  public geometry: G;
  private _material: M;

  protected buildOptions!: BuildOptions;
  protected renderPipeline!: GPURenderPipeline;

  protected componentBuildResult!: {
    transformUniformValue: Float32Array;
    vertexResources: GPUResource[];
  };

  protected materialBuildResult!: {
    vertex?: ShaderBuildResult;
    fragment: ShaderBuildResult;
    vertexBindingStart: number;
  };

  protected geometryBuildResult!: {
    vertexCount: number;
    vertexBuffer?: GPUBuffer;
    bufferOffsetAndSize?: Array<{ offset: number; size: number }>;
    bufferLayout?: GPUVertexBufferLayout[];
    vertex: GPUShaderModuleCacheKey<any>;
    bindGroupLayoutEntries: GPUBindGroupLayoutEntry[];
    resources: GPUResource[];
    indices: {
      buffer: GPUBuffer;
      format: GPUIndexFormat;
      indexCount: number;
    } | null;
  };

  protected vertexResources!: {
    bindGroups: GPUBindGroup[];
    bindGroupLayouts: GPUBindGroupLayout[];
    code: GPUShaderModuleCacheKey<any>;
  };

  protected fragmentResources!: {
    bindGroups: GPUBindGroup[];
    bindGroupLayouts: GPUBindGroupLayout[];
    code: GPUShaderModuleCacheKey<any>;
  };

  constructor(geometry: G, material: M, instanceCount = 1) {
    super(instanceCount);
    this.geometry = geometry;
    this._material = this.observeMaterial(material);
  }

  get static() {
    return super.static;
  }

  // 防止 static 情况下 writeBuffer
  set static(__static: boolean) {
    const preStatic = super.static;
    if (__static == super.static) return;
    super.static = __static;
    this._material = this.observeMaterial(
      !preStatic ? (Reflect.get(this.material, "__raw") as M) : this.material
    );
  }

  get material() {
    return this._material as M;
  }

  set material(material: M) {
    this._material = this.observeMaterial(material);
  }

  observeMaterial(material: M) {
    const watch = Reflect.get(this.constructor, "watch") ?? {};
    return (
      this.static
        ? material
        : new ObservableProxy(
            material,
            [
              {
                action: this.onChange.bind(this),
                watch,
              },
            ],
            { exclude: ["device"].concat(Object.keys(watch)) }
          )
    ) as M;
  }

  onChange({ payload }: ObservableActionParams) {
    (payload as WatchAction[]).forEach((p) => {
      const hasBuilt = this.getArgumentsList(p);
      if (!hasBuilt) return;
      Reflect.apply(this[p], this, hasBuilt);
      // 副作用
      if (p === WatchAction.Component || p === WatchAction.Geometry)
        this.buildVertexResources(this.buildOptions);
      else if (p === WatchAction.Material)
        this.buildFragmentResources(this.buildOptions);
    });
  }

  getArgumentsList(p: WatchAction) {
    if (!this.buildOptions) return;
    return p === WatchAction.Pipeline || p === WatchAction.Material
      ? [this.buildOptions]
      : [this.buildOptions.device];
  }

  render(renderPass: GPURenderPassEncoder, device: GPUDevice) {
    super.render(renderPass, device);
    const { vertexBuffer, bufferOffsetAndSize, vertexCount, indices } =
      this.geometryBuildResult;
    if (vertexCount <= 0) return;
    renderPass.setPipeline(this.renderPipeline);
    if (vertexBuffer) {
      if (bufferOffsetAndSize)
        bufferOffsetAndSize.forEach(({ offset, size }, idx) => {
          renderPass.setVertexBuffer(idx, vertexBuffer, offset, size);
        });
      else renderPass.setVertexBuffer(0, vertexBuffer);
    }
    this.bindGroups.forEach((group, index) => {
      renderPass.setBindGroup(index + 1, group);
    });
    if (indices) {
      renderPass.setIndexBuffer(indices.buffer, indices.format);
      renderPass.drawIndexed(indices.indexCount, this.instanceCount);
    } else {
      renderPass.draw(vertexCount, this.instanceCount);
    }
  }

  updateBuffers(device: GPUDevice) {
    const { transformUniformValue, vertexResources } =
      this.componentBuildResult;
    const transformUniform = vertexResources[0] as GPUBuffer;
    const { instanceCount, instancesTransform, transform } = this;
    if (instanceCount > 1 && instancesTransform.length > 1) {
      const rootWorldMatrix = transform.worldMatrix;
      for (let i = 0, n = instancesTransform.length; i < n; i++) {
        const transform = instancesTransform[i];
        const offset = 32 * i;
        transformUniformValue.set(
          mat4.multiply(rootWorldMatrix, transform.worldMatrix),
          offset + 0
        );
        transformUniformValue.set(transform.worldNormalMatrix, offset + 16);
      }
    } else {
      transformUniformValue.set(transform.worldMatrix, 0);
      transformUniformValue.set(transform.worldNormalMatrix, 16);
    }
    device.queue.writeBuffer(transformUniform, 0, transformUniformValue);
  }

  buildComponent(device: GPUDevice) {
    const transformUniform = device.createBuffer({
      size: Float32Array.BYTES_PER_ELEMENT * 4 * 4 * 2 * this.instanceCount,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.STORAGE,
    });
    const transformUniformValue = new Float32Array(
      transformUniform.size / Float32Array.BYTES_PER_ELEMENT
    );

    this.componentBuildResult = {
      transformUniformValue,
      vertexResources: [transformUniform],
    };

    this.updateBuffers(device);
  }

  buildGeometry(device: GPUDevice) {
    const geometry = this.geometry;
    const indexFormat = geometry.indexFormat;
    const { positions, indices, uvs, normals } = geometry.attributes;
    const vertexCount = geometry.getCount("POSITION");
    const useNormal = !!normals;
    const useTexcoord = !!uvs;

    // position 和 其他顶点信息分开，因为后面模拟粒子需要更新 position，要确保 position buffer 连续这样才容易更新
    const f32UnitByte = Float32Array.BYTES_PER_ELEMENT;
    const bufferLayout: GPUVertexBufferLayout[] = [
      {
        arrayStride: 3 * f32UnitByte,
        stepMode: "vertex",
        attributes: [
          {
            shaderLocation: ShaderLocation.POSITION,
            format: "float32x3",
            offset: 0,
          },
        ],
      },
    ];
    const arrayStride =
      f32UnitByte * ((useNormal ? 3 : 0) + (useTexcoord ? 2 : 0));
    const attributes: GPUVertexAttribute[] = [];
    if (useNormal)
      attributes.push({
        shaderLocation: ShaderLocation.NORMAL,
        format: "float32x3",
        offset: 0,
      });
    if (useTexcoord)
      attributes.push({
        shaderLocation: ShaderLocation.TEXCOORD_0,
        format: "float32x2",
        offset: (useNormal ? 3 : 0) * f32UnitByte,
      });
    if (attributes.length > 0)
      bufferLayout.push({
        arrayStride,
        stepMode: "vertex",
        attributes,
      });

    const bufferOffsetAndSize: Array<{ offset: number; size: number }> = [];
    for (let i = 0, l = bufferLayout.length; i < l; i++) {
      bufferOffsetAndSize.push({
        offset: i == 0 ? 0 : bufferOffsetAndSize[i - 1].size,
        size: bufferLayout[i].arrayStride * vertexCount,
      });
    }
    const offset = 3 * vertexCount;
    const vertexBuffer = device.createBuffer({
      size: offset * f32UnitByte + arrayStride * vertexCount,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true,
    });
    const vertexData = new Float32Array(vertexBuffer.getMappedRange());

    vertexData.subarray(0, offset).set(positions);

    for (let i = 0; i < vertexCount; i++) {
      const normal = useNormal ? normals.slice(i * 3, (i + 1) * 3) : [];
      const uv = useTexcoord ? uvs.slice(i * 2, (i + 1) * 2) : [];
      vertexData.set(
        Float32Array.of(...normal, ...uv),
        offset + (i * arrayStride) / f32UnitByte
      );
    }
    vertexBuffer.unmap();

    let indexBuffer: GPUBuffer | null = null;
    if (indices) {
      indexBuffer = device.createBuffer({
        usage: GPUBufferUsage.INDEX,
        size: indices.length * indices.BYTES_PER_ELEMENT,
        mappedAtCreation: true,
      });
      new (indexFormat === "uint16" ? Uint16Array : Uint32Array)(
        indexBuffer.getMappedRange()
      ).set(indices);
      indexBuffer.unmap();
    }

    const { vertexBindingStart: bindingStart } = this.materialBuildResult;
    this.geometryBuildResult = {
      vertexCount,
      vertexBuffer,
      bufferOffsetAndSize,
      bufferLayout,
      vertex: {
        code: vertex,
        context: { useNormal, useTexcoord, bindingStart },
      },
      indices: indices
        ? {
            buffer: indexBuffer!,
            format: indexFormat!,
            indexCount: indices.length,
          }
        : null,
      bindGroupLayoutEntries: [
        {
          binding: bindingStart,
          visibility: GPUShaderStage.VERTEX,
          buffer: { type: "read-only-storage" },
        },
      ],
      resources: [],
    };
  }

  get vertexBuffer(): GPUBuffer | undefined {
    return this.geometryBuildResult.vertexBuffer;
  }

  // 用于粒子模拟更新顶点位置的
  updateVertexAll(posEdge: WireframeGeometry) {
    const device = this.buildOptions.device;
    const vertexBuffer = this.vertexBuffer;
    if (!device || !vertexBuffer) return;
    const { vertexMapping, positions: vertexPositions } = posEdge;
    const positions = this.geometry.positions;
    for (let i = 0, l = vertexMapping.length; i < l; i++) {
      const indexs = vertexMapping[i];
      const value = vertexPositions.get(i);
      vec3.transformMat4(
        value,
        mat4.inverse(this.transform.worldMatrix),
        value
      );
      indexs.forEach((index) => positions.set(index, value));
    }
    device.queue.writeBuffer(this.vertexBuffer, 0, positions.array);
  }

  buildMaterial(options: BuildOptions) {
    const res = this.material.build(options);
    const vertexBindingStart = res.vertex?.bindGroupLayoutEntries.length ?? 0;
    this.materialBuildResult = { vertexBindingStart, ...res };
  }

  /**
   * vertex 和 fragment 拆分成两个 bindGroup
   * ShaderMaterial 可能会修改 vertex，这里需要判断使用默认的 vertex 还是 material 提供的 vertex
   */
  buildVertexResources(options: BuildOptions) {
    const { device, cached, scene } = options;

    const { bindGroupLayoutEntries, resources } = this.geometryBuildResult;
    const { vertexResources } = this.componentBuildResult;
    const { vertex } = this.materialBuildResult;

    const bindGroupLayout = cached.bindGroupLayout.get(
      (vertex?.bindGroupLayoutEntries ?? []).concat(bindGroupLayoutEntries)
    );
    const bindGroup = device.createBindGroup({
      layout: bindGroupLayout,
      entries: getBindGroupEntries(
        vertex?.resources ?? [],
        vertexResources,
        resources
      ),
    });

    this.vertexResources = {
      bindGroupLayouts: [scene.bindGroupLayout, bindGroupLayout],
      bindGroups: [bindGroup],
      code: !!vertex ? vertex.shader : this.geometryBuildResult.vertex,
    };
  }

  buildFragmentResources(options: BuildOptions) {
    const { cached } = options;
    const { fragment } = this.materialBuildResult;

    const bindGroupLayout = cached.bindGroupLayout.get(
      fragment.bindGroupLayoutEntries
    );
    const bindGroup = options.device.createBindGroup({
      layout: bindGroupLayout,
      entries: getBindGroupEntries(fragment.resources),
    });

    this.fragmentResources = {
      code: fragment.shader,
      bindGroups: [bindGroup],
      bindGroupLayouts: [bindGroupLayout],
    };
  }

  get bindGroups() {
    return this.vertexResources.bindGroups.concat(
      this.fragmentResources.bindGroups
    );
  }

  get resources() {
    return {
      bindGroupLayouts: this.vertexResources.bindGroupLayouts.concat(
        this.fragmentResources.bindGroupLayouts
      ),
      vertex: this.vertexResources.code,
      fragment: this.fragmentResources.code,
    };
  }

  abstract buildPipeline(options: BuildOptions): void;

  build(options: BuildOptions) {
    this.buildOptions = options;
    const device = options.device;
    /////////////////// 解析 Material /////////////////////////
    this.buildMaterial(options);
    ///////////// 解析 Geometry ////////////////
    this.buildGeometry(device);
    ///////// 解析自己的组件(组件内部也可以有自己的组件) ///////////
    this.buildComponent(device);
    /////////////////// 创建 vertex 和 fragment 资源 /////////////////////////
    this.buildVertexResources(options);
    this.buildFragmentResources(options);
    /////////////////// 创建 pipeline //////////////////
    this.buildPipeline(options);

    super.build(options);
  }
}
