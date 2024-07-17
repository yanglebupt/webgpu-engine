import { getBindGroupEntries } from "..";
import { EntityObject } from "../entitys/EntityObject";
import { Geometry } from "../geometrys/Geometry";
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

  protected materialBuildResult!: {
    vertex?: ShaderBuildResult;
    fragment: ShaderBuildResult;
    vertexBindingStart: number;
  };

  protected geometryBuildResult!: {
    vertexCount: number;
    vertexBuffer?: GPUBuffer;
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

  protected componentBuildResult!: {
    transformUniformValue: Float32Array;
    vertexResources: GPUResource[];
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

  constructor(geometry: G, material: M) {
    super();
    this.geometry = geometry;
    this._material = this.observeMaterial(material);
  }

  get static() {
    return super.static;
  }

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
    const { vertexBuffer, vertexCount, indices } = this.geometryBuildResult;
    if (vertexCount <= 0) return;
    renderPass.setPipeline(this.renderPipeline);
    if (vertexBuffer) renderPass.setVertexBuffer(0, vertexBuffer);
    this.bindGroups.forEach((group, index) => {
      renderPass.setBindGroup(index + 1, group);
    });
    if (indices) {
      renderPass.setIndexBuffer(indices.buffer, indices.format);
      renderPass.drawIndexed(indices.indexCount);
    } else {
      renderPass.draw(vertexCount);
    }
  }

  updateBuffers(device: GPUDevice) {
    const { transformUniformValue, vertexResources } =
      this.componentBuildResult;
    const transformUniform = vertexResources[0] as GPUBuffer;
    transformUniformValue.set(this.transform.worldMatrix, 0);
    transformUniformValue.set(this.transform.worldNormalMatrix, 16);
    device.queue.writeBuffer(transformUniform, 0, transformUniformValue);
  }

  buildGeometry(device: GPUDevice) {
    const geometry = this.geometry;
    const indexFormat = geometry.indexFormat;
    const { positions, indices, uvs, normals } = geometry.attributes;
    const vertexCount = geometry.getCount("POSITION");
    const useNormal = !!normals;
    const useTexcoord = !!uvs;

    const arrayStride =
      Float32Array.BYTES_PER_ELEMENT *
      (3 + (useNormal ? 3 : 0) + (useTexcoord ? 2 : 0));

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

    const vertexBuffer = device.createBuffer({
      size: arrayStride * vertexCount,
      usage: GPUBufferUsage.VERTEX,
      mappedAtCreation: true,
    });
    const vertexData = new Float32Array(vertexBuffer.getMappedRange());

    for (let i = 0; i < vertexCount; i++) {
      const vertex = positions.slice(i * 3, (i + 1) * 3);
      const normal = useNormal ? normals.slice(i * 3, (i + 1) * 3) : [];
      const uv = useTexcoord ? uvs.slice(i * 2, (i + 1) * 2) : [];
      vertexData.set(
        Float32Array.of(...vertex, ...normal, ...uv),
        (i * arrayStride) / Float32Array.BYTES_PER_ELEMENT
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

  buildComponent(device: GPUDevice) {
    const transformUniform = device.createBuffer({
      size: Float32Array.BYTES_PER_ELEMENT * 4 * 4 * 2,
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
