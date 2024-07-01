import { mat4 } from "wgpu-matrix";
import {
  BuiltRenderPipelineOptions,
  CreateAndSetRecord,
  defaultColor,
} from "..";
import vertex from "../../shaders/vertex-wgsl/normal.wgsl";
import { ShaderLocation } from "../../shaders";
import { fetchWithProgress } from "../../common";
import { BuildOptions } from "../../scene/types";
import { BlendMode, clearEmptyPropertyOfObject } from "../../scene/cache";
import { Logger } from "../../helper";
import { EntityObject } from "../../entitys/EntityObject";
import { Group } from "../../objects/Group";
import { Transform } from "../../components/Transform";
import { MeshPhysicalMaterial } from "../../materials/MeshPhysicalMaterial";
import { getBindGroupEntries } from "../..";
import { Texture, TextureOptions } from "../../textures/Texture";
import { isEqual } from "lodash-es";
import { ObservableProxy } from "../../utils/Observable";
import { MeshMaterial } from "../../materials/MeshMaterial";
import { MeshBasicMaterial } from "../../materials/MeshBasicMaterial";

export function hexCharCodeToAsciiStr(hexcharCode: string | number) {
  if (typeof hexcharCode === "number") hexcharCode = hexcharCode.toString(16);
  let asciiString = "";
  // 将每两个十六进制字符转换为对应的 ASCII 码，并将其拼接到 ASCII 字符串中
  for (let i = 0; i < hexcharCode.length; i += 2) {
    asciiString += String.fromCharCode(
      parseInt(hexcharCode.substring(i, i + 2), 16)
    );
  }
  return asciiString;
}

// 填充为 4 的倍数
export function alignTo(val: number, align: number) {
  return Math.floor((val + align - 1) / align) * align;
}

// 获取 modelMatrix
export function readNodeTransform(node: GLTFNodeI) {
  if (node.matrix) return mat4.create(...node.matrix);
  else {
    let scale = node.scale ?? [1, 1, 1];
    let rotation = node.rotation ?? [0, 0, 0, 1]; // 四元数
    let translation = node.translation ?? [0, 0, 0];
    return mat4.fromRotationTranslationScale(rotation, translation, scale);
  }
}

export function createGLTFNode(
  node: GLTFNodeI,
  meshes: GLTFMesh[],
  nodes: GLTFNodeI[]
) {
  const gltfNode = new GLTFNode(node, meshes[node.mesh]);
  if (node.children) {
    node.children.forEach((child) => {
      gltfNode.addChildren(createGLTFNode(nodes[child], meshes, nodes));
    });
  }
  return gltfNode;
}

export const MAGIC_NUMBER = 0x46546c67;
export const MAGIC_STR = "FTlg";
export const VERSION = 2;
export const JSON_CHUNK_TYPE = 0x4e4f534a;
export const JSON_CHUNK_TYPE_STR = "NOSJ";
export const BINARY_CHUNK_TYPE = 0x004e4942;
export const BINARY_CHUNK_TYPE_STR = "NIB";

export enum GLTFRenderMode {
  POINTS = 0,
  LINE = 1,
  LINE_LOOP = 2,
  LINE_STRIP = 3,
  TRIANGLES = 4,
  TRIANGLE_STRIP = 5,
  // Note: fans are not supported in WebGPU, use should be
  // an error or converted into a list/strip
  TRIANGLE_FAN = 6,
}

export enum GLTFComponentType {
  BYTE = 5120,
  UNSIGNED_BYTE = 5121,
  SHORT = 5122,
  UNSIGNED_SHORT = 5123,
  INT = 5124,
  UNSIGNED_INT = 5125,
  FLOAT = 5126,
  DOUBLE = 5130,
}

export enum GLTFSamplerMagFilterType {
  NEAREST = 9728,
  LINEAR = 9729,
}

export enum GLTFSamplerMinFilterType {
  NEAREST = 9728,
  LINEAR = 9729,
  NEAREST_MIPMAP_NEAREST = 9984,
  LINEAR_MIPMAP_NEAREST = 9985,
  NEAREST_MIPMAP_LINEAR = 9986,
  LINEAR_MIPMAP_LINEAR = 9987,
}

export enum GLTFSamplerWrapType {
  CLAMP_TO_EDGE = 33071,
  MIRRORED_REPEAT = 33648,
  REPEAT = 10497,
}

export enum GLTFComponentTypeSize {
  BYTE = 1,
  UNSIGNED_BYTE = 1,
  SHORT = 2,
  UNSIGNED_SHORT = 2,
  INT = 4,
  UNSIGNED_INT = 4,
  FLOAT = 4,
  DOUBLE = 8,
}

export enum GLTFComponentType2GPUVertexFormat {
  BYTE = "sint8",
  UNSIGNED_BYTE = "uint8",
  SHORT = "sint16",
  UNSIGNED_SHORT = "uint16",
  INT = "int32",
  UNSIGNED_INT = "uint32",
  FLOAT = "float32",
}

export enum GLTFType {
  SCALAR = 0,
  VEC2 = 1,
  VEC3 = 2,
  VEC4 = 3,
  MAT2 = 4,
  MAT3 = 5,
  MAT4 = 6,
}

export enum GLTFTypeNumber {
  SCALAR = 1,
  VEC2 = 2,
  VEC3 = 3,
  VEC4 = 4,
  MAT2 = 4,
  MAT3 = 9,
  MAT4 = 16,
}

export interface AttributeAccessorI {
  name: string;
  shaderLocation: number;
  accessor: GLTFAccessor;
}

export interface GLTFAssetI {
  generator: string;
  version: string;
}

export interface GLTFSceneI {
  name: string;
  nodes: number[];
}

export interface GLTFNodeI {
  name: string;
  mesh: number;
  camera: number;
  children: number[];
  rotation: number[];
  translation: number[];
  scale: number[];
  matrix: number[];
}

export interface GLTFMeshI {
  name: string;
  primitives: GLTFPrimitiveI[];
}
export interface GLTFPrimitiveI {
  mode: number;
  attributes: Record<string, number>;
  indices: number;
  material?: number;
}
export interface GLTFAccessorI {
  bufferView: number;
  componentType: number;
  count: number;
  type: string;
  byteOffset: number;
}
export interface GLTFBufferViewI {
  buffer: number;
  byteOffset: number;
  byteLength: number;
  byteStride: number;
  target: number;
}

export interface GLTFBufferI {
  byteLength: number;
}

export interface GLTFImageI {
  name: string;
  bufferView: number;
  mimeType: "image/png" | "image/jpeg";
}
export interface GLTFSamplerI {
  magFilter?: number;
  minFilter?: number;
  wrapS?: number;
  wrapT?: number;
  name?: string;
}
export interface GLTFTextureI {
  source: number;
  sampler?: number;
}
export interface GLTFMaterialI {
  name: string;
  pbrMetallicRoughness: {
    baseColorFactor: number[];
    metallicFactor: number;
    roughnessFactor: number;
    baseColorTexture?: { index: number; texCoord?: number };
    metallicRoughnessTexture?: { index: number; texCoord?: number };
  };
  normalTexture?: { index: number; texCoord?: number; scale?: number };
  occlusionTexture?: {
    index: number;
    strength?: number;
  };
  emissiveTexture?: { index: number };
  emissiveFactor: number[];
  alphaCutoff?: number;
  alphaMode: BlendMode;
  doubleSided: boolean;
}

export interface GLTFJSON {
  asset: GLTFAssetI;
  scene: number;
  scenes: GLTFSceneI[];
  nodes: GLTFNodeI[];
  meshes: GLTFMeshI[];
  accessors: GLTFAccessorI[];
  bufferViews: GLTFBufferViewI[];
  buffers: GLTFBufferI[];
  images?: GLTFImageI[];
  samplers?: GLTFSamplerI[];
  textures?: GLTFTextureI[];
  materials?: GLTFMaterialI[];
}

export class GLTFLoaderV2 {
  async load(filename: string, options?: BuiltRenderPipelineOptions) {
    const { mips = false, useEnvMap = false, onProgress } = options ?? {};
    const buffer = await (await fetchWithProgress(filename, (percentage) => {
      onProgress && onProgress("downloading", 0.7 * percentage);
    })!)!.arrayBuffer();
    // 解析 Header 和 Json Chunk Header
    const header = new Uint32Array(buffer, 0, 5);
    if (header[0] != MAGIC_NUMBER)
      throw Error("Provided file is not a gltf file");
    if (header[1] != VERSION)
      throw Error("Provided file is not gltf version 2");
    const jsonChunkByteLength = header[3];
    if (header[4] != JSON_CHUNK_TYPE)
      throw Error(
        "Invalid glB: The first chunk of the glB file is not a JSON chunk!"
      );
    // 解析 Json Chunk Data
    const json = JSON.parse(
      new TextDecoder("utf-8").decode(
        new Uint8Array(buffer, 5 * 4, jsonChunkByteLength)
      )
    ) as GLTFJSON;

    Logger.log(json);

    // 解析 Binary Chunk Header
    const binaryHeader = new Uint32Array(
      buffer,
      5 * 4 + jsonChunkByteLength,
      2
    );
    const binaryChunkByteLength = binaryHeader[0];
    if (binaryHeader[1] != BINARY_CHUNK_TYPE)
      throw Error(
        "Invalid glB: The second chunk of the glB file is not a binary chunk!"
      );

    // 解析 Binary Chunk Data
    const binary = new GLTFBuffer(
      buffer,
      7 * 4 + jsonChunkByteLength,
      binaryChunkByteLength
    );

    const bufferViews = json.bufferViews.map(
      (view) => new GLTFBufferView(view, binary)
    );

    const accessors = json.accessors.map(
      (accessor) => new GLTFAccessor(accessor, bufferViews[accessor.bufferView])
    );

    const images =
      json.images?.map(
        (image) => new GLTFImage(image, bufferViews[image.bufferView])
      ) ?? [];

    await Promise.all(
      images?.map(async (image) => {
        await image.view.createBitmap(image.__json);
      }) ?? []
    );

    const samplers =
      json.samplers?.map((sampler) => new GLTFSampler(sampler)) ?? [];

    const textures =
      json.textures?.map(
        (texture) =>
          new GLTFTexture(
            images[texture.source],
            texture.sampler !== undefined
              ? samplers[texture.sampler]
              : undefined,
            { mips, flipY: false }
          )
      ) ?? [];
    // 解析
    const materials =
      json.materials?.map(
        (material) => new GLTFPhysicalMaterial(material, textures, useEnvMap)
      ) ?? [];

    const meshes = json.meshes.map((mesh, idx) => {
      onProgress &&
        onProgress("parse mesh", 0.7 + ((idx + 1) / json.meshes.length) * 0.1);
      const primitives = mesh.primitives.map((primitive) => {
        let topology = primitive.mode;
        if (topology === undefined) topology = GLTFRenderMode.TRIANGLES;
        if (!(topology in GLTFRenderMode))
          throw new Error(`Unsupported primitive mode ${topology}`);
        const indices =
          primitive.indices !== undefined &&
          primitive.indices < accessors.length
            ? accessors[primitive.indices]
            : null;
        const attributeAccessors = Object.keys(primitive.attributes)
          .map((attributeKey) => {
            const accessor: AttributeAccessorI = {
              name: attributeKey,
              shaderLocation: Reflect.get(ShaderLocation, attributeKey),
              accessor:
                accessors[Reflect.get(primitive.attributes, attributeKey)],
            };
            return accessor;
          })
          .filter(({ shaderLocation }) => shaderLocation !== undefined);
        return new GLTFPrimitive(
          primitive,
          indices,
          topology,
          attributeAccessors,
          new ObservableProxy(
            primitive.material !== undefined
              ? materials[primitive.material]
              : new GLTFBasicMaterial()
          )
        );
      });

      return new GLTFMesh(mesh, primitives);
    });

    // 渲染第一个或者默认场景
    // tracked a big list of node transforms and meshes
    const defaultScene = json.scenes[json.scene ?? 0];
    const nodes = defaultScene.nodes.map((nodeIdx, idx) => {
      onProgress &&
        onProgress(
          "parse nodes",
          0.95 + ((idx + 1) / defaultScene.nodes.length) * 0.05 // 最后一下的进度要尽可能快，这样才能确保进度条及时消失
        );
      const node = json.nodes[nodeIdx];
      return createGLTFNode(node, meshes, json.nodes);
    });

    return new GLTFScene(defaultScene, nodes, meshes, bufferViews);
  }
}

// gltf scene：以 render order 保存需要渲染的 data 数据
export type RenderOrder = RenderPipeline[];
export interface RenderPipeline {
  pipeline: GPURenderPipeline;
  materialPrimitivesMap: Map<RenderNode, RenderPrimitive[]>;
}
export interface RenderPrimitive {
  buffers: GPUBufferAccessor[];
  indices: GLTFAccessor | null;
  vertexCount: number;
  nodes?: RenderNode[];
  instance?: RenderInstance;
  instanceInAll?: { first: number; count: number };
}

export interface RenderInstance {
  groupIndex: number;
  bindGroup: GPUBindGroup;
  count: number;
}

export interface RenderNode {
  groupIndex: number;
  bindGroup: GPUBindGroup;
}

export interface PrimitiveInstancesType {
  total: number;
  offset: number;
  matrices: Map<string, Transform[]>;
  arrayBuffer?: Float32Array;
}
export interface GLTFScene {
  device: GPUDevice;
  // 构建所需的属性
  renderPipelines: Map<string, RenderPipeline>;
  nodeBindGroupLayout: GPUBindGroupLayout;
  instanceBuffer: GPUBuffer;
  instanceBindGroup: GPUBindGroup;
  instanceBindGroupIndex: number;
  primitiveInstances: PrimitiveInstancesType;
}
export class GLTFScene extends Group {
  type: string = "GLTFScene";
  static: boolean = true;
  public record: CreateAndSetRecord;
  constructor(
    public __json: GLTFSceneI,
    nodes: GLTFNode[],
    public meshs: GLTFMesh[],
    public bufferViews: GLTFBufferView[]
  ) {
    super(nodes);
    this.name = __json.name;
    this.record = new CreateAndSetRecord();
    this.renderPipelines = new Map();
  }

  // 创建 render-order
  build(options: BuildOptions) {
    const { device, format, depthFormat, scene, cached } = options;
    this.bufferViews.forEach(
      (view) =>
        view.flag === GLTFBufferViewFlag.BUFFER && view.uploadBuffer(device)
    );
    // new group  假设所有的 node 都使用同一个 bindGroupLayout
    this.nodeBindGroupLayout = cached.bindGroupLayout.get([
      {
        binding: 0,
        visibility: GPUShaderStage.VERTEX,
        buffer: { type: "read-only-storage" },
      },
    ]);

    /* 
      多个 node 可以重复用同一个 mesh，但可以 node transform 不同，1 对 多
      node --> mesh
                primitives: primitive 
                              - material
               children --> nodes
      因此需要记录使用该 primitive 的 node 数组
    */
    const primitiveNodesMap: Map<string, Transform[]> = new Map();
    const primitiveInstances: PrimitiveInstancesType = {
      total: 0, // 一共多少个 primitive，包括被 node 重复也需要计入
      offset: 0,
      matrices: primitiveNodesMap,
    };

    // tranverse node
    this.traverse((node: GLTFNode) => {
      const transform = node.transform;
      transform.updateWorldMatrix(); // add child 之后需要更新世界变换矩阵
      if (!node.mesh) return;
      node.mesh.primitives.forEach((primitive) => {
        const primitiveNodesKey = JSON.stringify(primitive.__json);
        let primitiveNodes = primitiveNodesMap.get(primitiveNodesKey);
        if (!primitiveNodes) {
          primitiveNodes = [];
          primitiveNodesMap.set(primitiveNodesKey, primitiveNodes);
        }
        primitiveNodes.push(transform);
        primitiveInstances.total++;
      });
    });

    /* 
      将所有 primitive，创建一个大的 instance bind group
      用来存放使用其的 node transform
    */
    const instanceBuffer = device.createBuffer({
      size: 16 * 2 * Float32Array.BYTES_PER_ELEMENT * primitiveInstances.total,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true,
    });
    this.instanceBindGroup = device.createBindGroup({
      layout: this.nodeBindGroupLayout,
      entries: [{ binding: 0, resource: { buffer: instanceBuffer } }],
    });
    this.instanceBindGroupIndex = 1;
    this.record && this.record.bindGroupCount++;
    primitiveInstances.arrayBuffer = new Float32Array(
      instanceBuffer.getMappedRange()
    );

    // 防止重复 makeBindGroup
    const materialCache = new Map<string, RenderNode>();
    /* 
      为所有 primitive 创建 pipeline
      
      注意这里直接遍历所有 mesh，而不是从 node 开始
      因为不同 node 会用同一个 mesh（在上一步遍历已经包括了），导致重复
    */
    // tranverse mesh
    this.meshs.forEach((mesh) => {
      mesh.primitives.forEach((primitive) => {
        const {
          args,
          vertex,
          gpuBuffers,
          indices,
          vertexCount,
          fragment: { resources, bindGroupLayoutEntries, shader },
        } = primitive.build(options);

        const materialKey = JSON.stringify(primitive.material.__json);
        let material = materialCache.get(materialKey);
        const materialBindGroupLayout = cached.bindGroupLayout.get(
          bindGroupLayoutEntries
        );
        if (!material) {
          material = {
            groupIndex: 2,
            bindGroup: device.createBindGroup({
              layout: materialBindGroupLayout,
              entries: getBindGroupEntries(resources),
            }),
          };
          this.record && this.record.bindGroupCount++;
          materialCache.set(materialKey, material);
        }

        // 多个 primitive 可以重复用同一个 pipeline，但 buffers 不同，因此我们需要记录
        const ks = JSON.stringify({
          ...args,
          shaderContext: { vertex: vertex.context, fragment: shader.context },
        }); // 这里能改变的就是这些属性了，其他都不会变了，因此 key 没必要弄太复杂
        let renderPipeline = this.renderPipelines.get(ks);
        if (!renderPipeline) {
          const pipeline = cached.pipeline.get(
            vertex,
            shader,
            {
              format,
              ...args,
              depthStencil: {
                format: depthFormat,
                depthWriteEnabled: true,
                depthCompare: "less",
              },
            },
            [
              scene.bindGroupLayout,
              this.nodeBindGroupLayout,
              materialBindGroupLayout,
            ],
            {
              record: this.record,
            }
          );
          renderPipeline = {
            pipeline,
            // 多个 primitive 可以共用同一个 material，因此需要记录使用 material 的 primitive  1 对 多
            materialPrimitivesMap: new Map<RenderNode, RenderPrimitive[]>(),
          };
          this.renderPipelines.set(ks, renderPipeline);
        }
        let primitives = renderPipeline.materialPrimitivesMap.get(material);
        if (!primitives) {
          primitives = [];
          renderPipeline.materialPrimitivesMap.set(material, primitives);
        }
        primitives.push({
          buffers: gpuBuffers,
          indices,
          vertexCount,
          instanceInAll: this.setInstancePosForPrimitiveNodes(
            primitive,
            primitiveInstances
          ),
        });
      });
    });

    instanceBuffer.unmap();

    primitiveInstances.offset = 0;
    primitiveInstances.arrayBuffer = new Float32Array(
      instanceBuffer.size / Float32Array.BYTES_PER_ELEMENT
    );

    this.primitiveInstances = primitiveInstances;
    this.instanceBuffer = instanceBuffer;
    this.device = device;
  }

  private traverseNode(node: GLTFNode, callback?: (node: GLTFNode) => void) {
    callback && callback(node);
    (node.children as GLTFNode[]).forEach((child) =>
      this.traverseNode(child, callback)
    );
  }

  traverse(callback?: (node: GLTFNode) => void) {
    (this.children as GLTFNode[]).forEach((child) =>
      this.traverseNode(child, callback)
    );
  }

  private setInstancePosForPrimitiveNodes(
    primitive: GLTFPrimitive,
    primitiveInstances: PrimitiveInstancesType
  ) {
    if (!primitiveInstances.arrayBuffer) return;
    const nodes = primitiveInstances.matrices.get(
      JSON.stringify(primitive.__json)
    )!;
    const first = primitiveInstances.offset;
    const count = nodes.length;
    for (let i = 0; i < count; i++) {
      const offset = (first + i) * 32;
      primitiveInstances.arrayBuffer.set(nodes[i].worldMatrix, offset);
      primitiveInstances.arrayBuffer.set(
        nodes[i].worldNormalMatrix,
        offset + 16
      );
    }
    primitiveInstances.offset += count;
    return { first, count };
  }

  updateBuffers() {
    if (!this.primitiveInstances.arrayBuffer) return;
    this.primitiveInstances.offset = 0;
    this.meshs.forEach((mesh) => {
      mesh.primitives.forEach((primitive) => {
        this.setInstancePosForPrimitiveNodes(
          primitive,
          this.primitiveInstances
        );
      });
    });
    this.device.queue.writeBuffer(
      this.instanceBuffer,
      0,
      this.primitiveInstances.arrayBuffer
    );
  }

  // 以 render-order 进行渲染
  render(renderPass: GPURenderPassEncoder, device: GPUDevice) {
    super.render(renderPass, device);
    const record = new CreateAndSetRecord();
    if (this.record) Object.assign(record, this.record);
    record && record.bindGroupSets++;
    renderPass.setBindGroup(
      this.instanceBindGroupIndex,
      this.instanceBindGroup
    );
    this.renderPipelines.forEach((renderPipeline) => {
      renderPass.setPipeline(renderPipeline.pipeline);
      record && record.pipelineSets++;
      renderPipeline.materialPrimitivesMap.forEach((primitives, material) => {
        renderPass.setBindGroup(material.groupIndex, material.bindGroup);
        record && record.bindGroupSets++;
        primitives.forEach((primitive) => {
          primitive.buffers.forEach(({ accessor, offset }, idx) => {
            record && record.bufferSets++;
            renderPass.setVertexBuffer(
              idx,
              accessor.view.gpuBuffer,
              offset,
              accessor.byteLength
            );
          });
          const { first, count } = primitive.instanceInAll!;
          const { indices, vertexCount } = primitive;
          if (indices) {
            record && record.bufferSets++;
            renderPass.setIndexBuffer(
              indices.view.gpuBuffer!,
              indices.vertexType,
              indices.__json.byteOffset,
              indices.byteLength
            );
            renderPass.drawIndexed(indices.__json.count, count, 0, 0, first);
          } else {
            renderPass.draw(vertexCount, count, 0, first);
          }
          record && record.drawCount++;
        });
      });
    });

    /////////////option delete future///////////////////
    if (!isEqual(Reflect.get(this, "lastRecord"), record))
      document.querySelector(".record")!.innerHTML = `
    <div>pipelineCount: ${record.pipelineCount}</div>
    <div>pipelineSets: ${record.pipelineSets}</div>
    <div>bindGroupCount: ${record.bindGroupCount}</div>
    <div>bindGroupSets: ${record.bindGroupSets}</div>
    <div>bufferSets: ${record.bufferSets}</div>
    <div>drawCount: ${record.drawCount}</div>
    `;
    Reflect.set(this, "lastRecord", record);
    return record;
  }
}

// gltf node
export class GLTFNode extends EntityObject {
  type: string = "GLTFNode";
  constructor(public __json: GLTFNodeI, public mesh: GLTFMesh) {
    super();
    this.name = __json.name;
    this.transform.applyMatrix4(readNodeTransform(__json), true);
  }
  updateBuffers() {}
  build() {}
}

// gltf mesh ：遍历，为每个 primitive 创建对应的渲染管线
export class GLTFMesh {
  constructor(public __json: GLTFMeshI, public primitives: GLTFPrimitive[]) {}
}

export interface GPUBufferAccessor {
  accessor: GLTFAccessor;
  offset: number;
}
// gltf primitive ：创建对应的渲染管线和渲染过程
export class GLTFPrimitive {
  public vertexCount: number = 0;
  public bufferLayout: GPUVertexBufferLayout[] = [];
  public gpuBuffers: GPUBufferAccessor[] = [];
  constructor(
    public __json: GLTFPrimitiveI,
    public indices: GLTFAccessor | null,
    public topology: GLTFRenderMode,
    public attributeAccessors: AttributeAccessorI[],
    public material: GLTFMaterial
  ) {
    this.indices?.view.addUsage(GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST);
    this.setPrimitive();
  }

  buildVertex() {
    const primitive: GPUPrimitiveState = { topology: "triangle-list" };
    if (this.topology == GLTFRenderMode.TRIANGLE_STRIP) {
      primitive.topology = "triangle-strip";
      if (this.indices) primitive.stripIndexFormat = this.indices!.vertexType;
    }
    const { attributes } = this.__json;
    return {
      args: {
        primitive,
        bufferLayout: this.bufferLayout,
        alphaMode: this.material.alphaMode,
        doubleSided: this.material.doubleSided,
      },
      vertex: {
        code: vertex,
        context: {
          useNormal: "NORMAL" in attributes,
          useTexcoord: "TEXCOORD_0" in attributes,
        },
      },
      vertexCount: this.vertexCount,
      gpuBuffers: this.gpuBuffers,
      indices: this.indices,
    };
  }

  // 针对 separate 和 interleaved 分别处理
  setPrimitive() {
    const bufferLayout: Map<string | number, GPUVertexBufferLayout> = new Map();
    const gpuBuffers: Map<
      GPUVertexBufferLayout,
      { accessor: GLTFAccessor; offset: number }
    > = new Map();
    this.attributeAccessors
      .sort(
        (a, b) => a.accessor.__json.byteOffset - b.accessor.__json.byteOffset
      )
      .forEach(({ accessor, name, shaderLocation }) => {
        const { __json, view } = accessor;
        if (name == "POSITION") this.vertexCount = __json.count;
        view.addUsage(GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST);
        let buffer = bufferLayout.get(__json.bufferView);
        let gpuBuffer;
        let separate =
          buffer &&
          Math.abs(
            __json.byteOffset -
              (buffer.attributes as GPUVertexAttribute[])[0].offset
          ) >= buffer.arrayStride;
        // 如果是第一个或者是 separate，则需要新建一个 GPUVertexBufferLayout
        if (!buffer || separate) {
          buffer = {
            arrayStride: accessor.byteStride,
            attributes: [],
          };
          // 如果是 separate 则每个 name 对应一个 GPUVertexBufferLayout
          // 否则都使用同一个 bufferView index 指向同一个 GPUVertexBufferLayout
          bufferLayout.set(separate ? name : __json.bufferView, buffer);
          // 每个 GPUVertexBufferLayout 指向一个真实的 GPUBuffer
          gpuBuffers.set(buffer, {
            accessor: accessor,
            offset: __json.byteOffset,
          });
        } else {
          // 如果是 interleaved
          gpuBuffer = gpuBuffers.get(buffer)!;
          gpuBuffer.offset = Math.min(gpuBuffer.offset, __json.byteOffset);
        }

        (buffer.attributes as GPUVertexAttribute[]).push({
          shaderLocation,
          format: accessor.vertexType,
          offset: __json.byteOffset,
        });
      });

    // 减去 gpuBuffer.offset，因为后面 set 的时候会设置 offset
    for (const buffer of bufferLayout.values()) {
      const gpuBuffer = gpuBuffers.get(buffer)!;
      for (const attribute of buffer.attributes) {
        attribute.offset -= gpuBuffer.offset;
      }
      // 排序，确保后面从缓存中获取 pipeline 时不会因为顺序不一致导致 key 值不同
      // Sort the attributes by shader location.
      buffer.attributes = (buffer.attributes as GPUVertexAttribute[]).sort(
        (a, b) => {
          return a.shaderLocation - b.shaderLocation;
        }
      );
    }

    // 排序，确保后面从缓存中获取 pipeline 时不会因为顺序不一致导致 key 值不同
    // Sort the buffers by their first attribute's shader location.
    this.bufferLayout = (
      [...bufferLayout.values()] as GPUVertexBufferLayout[]
    ).sort((a, b) => {
      return (
        (a.attributes as GPUVertexAttribute[])[0].shaderLocation -
        (b.attributes as GPUVertexAttribute[])[0].shaderLocation
      );
    });

    // Ensure that the gpuBuffers are saved in the same order as the buffer layout.
    this.gpuBuffers = this.bufferLayout.map(
      (buffer) => gpuBuffers.get(buffer)!
    );
  }

  // 设置 material，有些 primitive 可以不存在 material
  build(options: BuildOptions) {
    const vertexRes = this.buildVertex();
    const fragmentRes = this.material.build(options);
    return { ...vertexRes, fragment: { ...fragmentRes.fragment } };
  }
}

// gltf buffers ：创建对应的 Uint8Array
export class GLTFBuffer extends Uint8Array {
  constructor(buffer: ArrayBuffer, byteOffset: number, byteLength: number) {
    super();
    return new Uint8Array(buffer, byteOffset, byteLength);
  }
}

export enum GLTFBufferViewFlag {
  BUFFER,
  TEXTURE,
}
// gltf buffer view
export class GLTFBufferView {
  viewBuffer: Uint8Array;
  usage: number = 0;
  gpuBuffer: GPUBuffer | null = null;
  bitmap: ImageBitmap | null = null;
  flag: GLTFBufferViewFlag = GLTFBufferViewFlag.BUFFER;
  __json: GLTFBufferViewI;
  constructor(__json: GLTFBufferViewI, buffer: GLTFBuffer) {
    this.__json = {
      //@ts-ignore
      byteStride: 0,
      //@ts-ignore
      byteOffset: 0,
      ...__json,
    };
    const { byteOffset, byteLength } = this.__json;
    this.viewBuffer = buffer.subarray(byteOffset, byteOffset + byteLength);
  }

  setFlag(flag: GLTFBufferViewFlag) {
    this.flag = flag;
  }

  addUsage(usage: number) {
    this.usage = this.usage | usage;
  }

  async createBitmap(__json: GLTFImageI) {
    const blob = new Blob([this.viewBuffer], { type: __json.mimeType });
    this.bitmap = await createImageBitmap(blob);
  }

  // 最小的 bufferView，不再进行切分了
  uploadBuffer(device: GPUDevice) {
    this.gpuBuffer?.destroy();
    this.gpuBuffer = device.createBuffer({
      size: alignTo(this.viewBuffer.byteLength, 4),
      usage: this.usage,
      mappedAtCreation: true,
    });
    (
      Reflect.construct(this.viewBuffer.constructor, [
        this.gpuBuffer.getMappedRange(),
      ]) as typeof this.viewBuffer
    ).set(this.viewBuffer);
    this.gpuBuffer.unmap();
  }
}

// gltf accessor ：访问指定的 GLTFBufferView，并解析对应类型，同步创建对应的 GPUBuffer
export class GLTFAccessor {
  public __json: GLTFAccessorI;
  constructor(__json: GLTFAccessorI, public view: GLTFBufferView) {
    this.__json = {
      //@ts-ignore
      byteOffset: 0,
      ...__json,
    };
  }

  // step="vertex" 下的步长 单个vertex数据点的长度
  get byteStride() {
    const { type, componentType } = this.__json;
    const elementSize =
      Reflect.get(GLTFTypeNumber, type) *
      Reflect.get(
        GLTFComponentTypeSize,
        Reflect.get(GLTFComponentType, componentType)
      );
    return Math.max(elementSize, this.view.__json.byteStride);
  }

  // 整个 vertex buffer 的长度
  get byteLength() {
    return this.__json.count * this.byteStride;
  }

  // 返回单个 vertex 数据点的类型对应 GPUVertexFormat
  get vertexType() {
    const { componentType, type } = this.__json;
    const componentVertexFormat = Reflect.get(
      GLTFComponentType2GPUVertexFormat,
      Reflect.get(GLTFComponentType, componentType)
    );
    if (!componentVertexFormat)
      throw Error(`Unrecognized or unsupported glTF type ${componentType}`);
    const componentNums = Reflect.get(GLTFTypeNumber, type);
    return componentNums > 1
      ? `${componentVertexFormat}x${componentNums}`
      : componentVertexFormat;
  }
}

export class GLTFImage {
  constructor(public __json: GLTFImageI, public view: GLTFBufferView) {
    view.setFlag(GLTFBufferViewFlag.TEXTURE);
    view.addUsage(
      GPUTextureUsage.TEXTURE_BINDING |
        GPUTextureUsage.COPY_DST |
        GPUTextureUsage.RENDER_ATTACHMENT
    );
  }
}

export class GLTFSampler {
  samplerDescriptor: GPUSamplerDescriptor;
  constructor(public __json: GLTFSamplerI) {
    this.samplerDescriptor = this.getSamplerDescriptor();
  }

  getSamplerDescriptor() {
    const { wrapS, wrapT, magFilter, minFilter } = this.__json;
    const descriptor: GPUSamplerDescriptor = {
      addressModeU: this.addressModeForWrap(wrapS),
      addressModeV: this.addressModeForWrap(wrapT),
    };
    // WebGPU's default min/mag/mipmap filtering is nearest, se we only have to override it if we
    // want linear filtering for some aspect.
    if (!magFilter || magFilter === GLTFSamplerMagFilterType.LINEAR) {
      descriptor.magFilter = "linear";
    }
    switch (minFilter) {
      case WebGLRenderingContext.NEAREST:
        break;
      case WebGLRenderingContext.LINEAR:
      case WebGLRenderingContext.LINEAR_MIPMAP_NEAREST:
        descriptor.minFilter = "linear";
        break;
      case WebGLRenderingContext.NEAREST_MIPMAP_LINEAR:
        descriptor.mipmapFilter = "linear";
        break;
      case WebGLRenderingContext.LINEAR_MIPMAP_LINEAR:
      default:
        descriptor.minFilter = "linear";
        descriptor.mipmapFilter = "linear";
        break;
    }

    return descriptor;
  }

  addressModeForWrap(wrap?: GLTFSamplerWrapType) {
    switch (wrap) {
      case GLTFSamplerWrapType.CLAMP_TO_EDGE:
        return "clamp-to-edge";
      case GLTFSamplerWrapType.MIRRORED_REPEAT:
        return "mirror-repeat";
      default:
        return "repeat";
    }
  }
}

export class GLTFTexture extends Texture {
  constructor(
    image: GLTFImage,
    sampler?: GLTFSampler,
    options?: TextureOptions
  ) {
    super("", options, sampler?.samplerDescriptor);
    this.source = image.view.bitmap!;
  }
}

export interface GLTFMaterial extends MeshMaterial {
  alphaMode: BlendMode;
  doubleSided: boolean;
  __json: Record<string, any>;
}
export class GLTFPhysicalMaterial
  extends MeshPhysicalMaterial
  implements GLTFMaterial
{
  alphaMode: BlendMode;
  doubleSided: boolean;
  constructor(
    public __json: GLTFMaterialI,
    textures: GLTFTexture[],
    useEnvMap: boolean
  ) {
    super(
      clearEmptyPropertyOfObject({
        baseColorFactor: __json.pbrMetallicRoughness.baseColorFactor,
        metallicFactor: __json.pbrMetallicRoughness.metallicFactor,
        roughnessFactor: __json.pbrMetallicRoughness.roughnessFactor,
        emissiveFactor: __json.emissiveFactor,
        normalScale: __json.normalTexture?.scale,
        occlusionStrength: __json.occlusionTexture?.strength,
        alphaCutoff: __json.alphaCutoff,
        applyNormalMap: __json.normalTexture !== undefined,
        useEnvMap: useEnvMap,
        useAlphaCutoff: __json.alphaMode === "MASK",
      })
    );
    this.alphaMode = __json.alphaMode ?? "OPAQUE";
    this.doubleSided = __json.doubleSided ?? false;
    (
      [
        {
          k: "baseColorTexture",
          a: __json.pbrMetallicRoughness.baseColorTexture,
        },
        { k: "normalTexture", a: __json.normalTexture },
        {
          k: "metallicRoughnessTexture",
          a: __json.pbrMetallicRoughness.metallicRoughnessTexture,
        },
        { k: "emissiveTexture", a: __json.emissiveTexture },
        { k: "occlusionTexture", a: __json.occlusionTexture },
      ] as Array<{
        k: string;
        a: {
          index?: number;
        };
      }>
    ).forEach(({ k, a }) => {
      const notUseDefault = a?.index !== undefined;
      if (notUseDefault) {
        Reflect.set(this, k, textures[a.index!]);
      }
    });
  }
}

export class GLTFBasicMaterial
  extends MeshBasicMaterial
  implements GLTFMaterial
{
  alphaMode: BlendMode;
  doubleSided: boolean;
  __json: Record<string, any>;
  constructor() {
    super({ color: defaultColor });
    this.__json = {};
    this.alphaMode = "OPAQUE";
    this.doubleSided = false;
  }
}
