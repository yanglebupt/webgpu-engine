import { Mat4, mat4 } from "wgpu-matrix";
import {
  BuiltRenderPipelineOptions,
  CreateAndSetRecord,
  SolidColorTexture,
} from "..";
import vertex from "../shaders/vertex-wgsl/normal.wgsl";
// import fragment from "../shaders/fragment-wgsl/display-light.wgsl?raw";
import { ShaderLocation } from "../shaders";
import { makeShaderDataDefinitions, makeStructuredView } from "webgpu-utils";
import fragment, {
  M_U_NAME,
  MaterialUniform,
} from "../shaders/fragment-wgsl/baseColor-light.wgsl";

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

export function fromRotationTranslationScale(
  q: number[],
  v: number[],
  s: number[],
  dist?: Mat4
) {
  const out = dist ?? mat4.create();
  // Quaternion math
  let x = q[0],
    y = q[1],
    z = q[2],
    w = q[3];
  let x2 = x + x;
  let y2 = y + y;
  let z2 = z + z;
  let xx = x * x2;
  let xy = x * y2;
  let xz = x * z2;
  let yy = y * y2;
  let yz = y * z2;
  let zz = z * z2;
  let wx = w * x2;
  let wy = w * y2;
  let wz = w * z2;
  let sx = s[0];
  let sy = s[1];
  let sz = s[2];
  out[0] = (1 - (yy + zz)) * sx;
  out[1] = (xy + wz) * sx;
  out[2] = (xz - wy) * sx;
  out[3] = 0;
  out[4] = (xy - wz) * sy;
  out[5] = (1 - (xx + zz)) * sy;
  out[6] = (yz + wx) * sy;
  out[7] = 0;
  out[8] = (xz + wy) * sz;
  out[9] = (yz - wx) * sz;
  out[10] = (1 - (xx + yy)) * sz;
  out[11] = 0;
  out[12] = v[0];
  out[13] = v[1];
  out[14] = v[2];
  out[15] = 1;
  return out;
}

// 获取 modelMatrix
export function readNodeTransform(node: GLTFNode) {
  if (node.matrix) return mat4.create(...node.matrix);
  else {
    let scale = node.scale ?? [1, 1, 1];
    let rotation = node.rotation ?? [0, 0, 0, 1]; // 四元数
    let translation = node.translation ?? [0, 0, 0];
    return fromRotationTranslationScale(rotation, translation, scale);
  }
}

export interface FlattenNode {
  name: string;
  matrix: Mat4;
  mesh: number;
  camera: number;
}

export function flattenTree(
  node: GLTFNode,
  parentTransform: Mat4,
  nodes: GLTFNode[]
): FlattenNode[] {
  const flattened: FlattenNode[] = [];
  const nodeTransform = readNodeTransform(node);
  mat4.mul(parentTransform, nodeTransform, nodeTransform);
  flattened.push({
    name: node.name,
    matrix: nodeTransform,
    mesh: node.mesh,
    camera: node.camera,
  });
  if (node.children) {
    flattened.push(
      ...node.children
        .map((child) => flattenTree(nodes[child], nodeTransform, nodes))
        .flat()
    );
  }
  return flattened;
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

export interface AttributeAccessor {
  name: string;
  shaderLocation: number;
  accessor: GLTFAccessor;
}

export interface GLTFAsset {
  generator: string;
  version: string;
}

export interface GLTFScene {
  name: string;
  nodes: number[];
}

export interface GLTFNode {
  name: string;
  mesh: number;
  camera: number;
  children: number[];
  rotation: number[];
  translation: number[];
  scale: number[];
  matrix: number[];
}

export interface GLTFMesh {
  name: string;
  primitives: GLTFPrimitive[];
}
export interface GLTFPrimitive {
  mode: number;
  attributes: Record<string, number>;
  indices: number;
  material?: number;
}
export interface GLTFAccessor {
  bufferView: number;
  componentType: number;
  count: number;
  type: string;
  byteOffset: number;
}
export interface GLTFBufferView {
  buffer: number;
  byteOffset: number;
  byteLength: number;
  byteStride: number;
  target: number;
}

export interface GLTFBuffer {
  byteLength: number;
}

export interface GLTFImage {
  name: string;
  bufferView: number;
  mimeType: "image/png" | "image/jpeg";
}
export interface GLTFSampler {
  magFilter?: number;
  minFilter?: number;
  wrapS?: number;
  wrapT?: number;
  name?: string;
}
export interface GLTFTexture {
  source: number;
  sampler?: number;
}
export interface GLTFMaterial {
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
  alphaMode: "OPAQUE" | "MASK" | "BLEND";
  doubleSided: boolean;
}

export interface GLTFJSON {
  asset: GLTFAsset;
  scene: number;
  scenes: GLTFScene[];
  nodes: GLTFNode[];
  meshes: GLTFMesh[];
  accessors: GLTFAccessor[];
  bufferViews: GLTFBufferView[];
  buffers: GLTFBuffer[];
  images?: GLTFImage[];
  samplers?: GLTFSampler[];
  textures?: GLTFTexture[];
  materials?: GLTFMaterial[];
}

export class GLTFLoaderV2 {
  async load(
    device: GPUDevice,
    filename: string,
    builtRenderPipelineOptions: BuiltRenderPipelineOptions
  ) {
    const gltfScene = await this.parse(device, filename);
    // 创建渲染管线
    const { bindGroupLayouts, format, depthFormat, record } =
      builtRenderPipelineOptions;
    gltfScene.buildInRenderPipeline(
      device,
      bindGroupLayouts,
      format,
      depthFormat,
      record
    );
    return gltfScene;
  }
  async parse(device: GPUDevice, filename: string) {
    const buffer = await (await fetch(filename)).arrayBuffer();
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

    console.log(json);

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
      (view) => new GLTFBufferView(binary, view)
    );

    const accessors = json.accessors.map(
      (accessor) => new GLTFAccessor(bufferViews[accessor.bufferView], accessor)
    );

    const images =
      json.images?.map(
        (image) => new GLTFImage(image, bufferViews[image.bufferView])
      ) ?? [];
    const samplers =
      json.samplers?.map((sampler) => {
        const sam = new GLTFSampler(sampler);
        sam.uploadSampler(device);
        return sam;
      }) ?? [];
    GLTFSampler.createDefaultSampler(device);
    const textures =
      json.textures?.map(
        (texture) =>
          new GLTFTexture(
            texture,
            images[texture.source],
            (texture.sampler !== undefined
              ? samplers[texture.sampler].sampler
              : GLTFSampler.defaultSampler)!
          )
      ) ?? [];
    // 解析
    const materials =
      json.materials?.map((material) => new GLTFMaterial(material, textures)) ??
      [];

    const meshes = json.meshes.map((mesh) => {
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
            const accessor: AttributeAccessor = {
              name: attributeKey,
              shaderLocation: Reflect.get(ShaderLocation, attributeKey),
              accessor:
                accessors[Reflect.get(primitive.attributes, attributeKey)],
            };
            return accessor;
          })
          .filter(({ shaderLocation }) => shaderLocation !== undefined);
        return new GLTFPrimitive(
          indices,
          topology,
          attributeAccessors,
          primitive.material !== undefined
            ? materials[primitive.material]
            : undefined,
          primitive
        );
      });

      return new GLTFMesh(primitives, mesh);
    });

    // 渲染第一个或者默认场景
    // tracked a big list of node transforms and meshes
    const defaultScene = json.scenes[json.scene ?? 0];
    const nodes = defaultScene.nodes
      .map((nodeIdx) => {
        const node = json.nodes[nodeIdx];
        const flattenedNodeMesh = flattenTree(
          node,
          mat4.identity(),
          json.nodes
        ).filter((n) => n.mesh !== undefined);
        return flattenedNodeMesh.map(
          (flatnode) => new GLTFFlattenNode(meshes[flatnode.mesh], flatnode)
        );
      })
      .flat();

    const gltfScene = new GLTFScene(nodes, meshes, defaultScene);

    bufferViews.forEach(
      (view) =>
        view.flag === GLTFBufferViewFlag.BUFFER && view.uploadBuffer(device)
    );
    await Promise.all(
      images?.map(async (image) => {
        await image.view.uploadTexture(device, image);
      }) ?? []
    );
    SolidColorTexture.upload(device);
    return gltfScene;
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
  nodes: RenderNode[];
}
export interface RenderNode {
  groupIndex: number;
  bindGroup: GPUBindGroup;
}

export type ShaderModuleCode =
  | string
  | ((context: Record<string, any>) => string);

export class GLTFScene {
  public renderPipelines: Map<string, RenderPipeline> = new Map();
  public record?: CreateAndSetRecord;
  public nodeBindGroupLayout: GPUBindGroupLayout | null = null;
  public materialBindGroupLayout: GPUBindGroupLayout | null = null;
  constructor(
    public a_nodes: GLTFFlattenNode[],
    public a_meshs: GLTFMesh[],
    scene: GLTFScene
  ) {
    Object.assign(this, scene);
  }

  buildInRenderPipeline(
    device: GPUDevice,
    bindGroupLayouts: GPUBindGroupLayout[],
    format: GPUTextureFormat,
    depthFormat: GPUTextureFormat = "depth24plus",
    record?: CreateAndSetRecord
  ) {
    return this.buildRenderPipeline(
      device,
      vertex,
      fragment,
      bindGroupLayouts,
      format,
      depthFormat,
      record
    );
  }

  buildRenderPipeline(
    device: GPUDevice,
    vertex: ShaderModuleCode,
    fragment: ShaderModuleCode,
    bindGroupLayouts: GPUBindGroupLayout[],
    format: GPUTextureFormat,
    depthFormat: GPUTextureFormat = "depth24plus",
    record?: CreateAndSetRecord
  ) {
    return this.buildRenderOrder(
      device,
      vertex,
      fragment,
      bindGroupLayouts,
      format,
      depthFormat,
      record
    );
  }

  // 创建 render-order
  buildRenderOrder(
    device: GPUDevice,
    vertex: ShaderModuleCode,
    fragment: ShaderModuleCode,
    bindGroupLayouts: GPUBindGroupLayout[],
    format: GPUTextureFormat,
    depthFormat: GPUTextureFormat = "depth24plus",
    record?: CreateAndSetRecord
  ) {
    this.record = record;
    // new group  假设所有的 node 都使用同一个 bindGroupLayout
    this.nodeBindGroupLayout = device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX,
          buffer: { type: "uniform" },
        },
      ],
    });
    this.materialBindGroupLayout = device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.FRAGMENT,
          buffer: { type: "uniform" },
        },
        ...([1, 2, 3, 4, 5].map((binding) => ({
          binding,
          visibility: GPUShaderStage.FRAGMENT,
          texture: { viewDimension: "2d" },
        })) as GPUBindGroupLayoutEntry[]),
        {
          binding: 6,
          visibility: GPUShaderStage.FRAGMENT,
          sampler: {},
        },
      ],
    });

    // 多个 node 可以重复用同一个 mesh (primitives, primitive)，但 bindGroup 不同
    // 因此需要记录使用 primitive 的 node 的 bindGroup 数组  1 对 多
    const primitiveNodesMap: Map<string, RenderNode[]> = new Map();
    this.a_nodes.forEach((a_node) => {
      // bindGroupLayout 也需要缓存，因为其也有可能不同，会导致不同的 pipeline，这里暂时不考虑了
      const bindGroup = a_node.makeBindGroup(device, this.nodeBindGroupLayout!);
      record && record.bindGroupCount++;
      const renderNode = { bindGroup, groupIndex: bindGroupLayouts.length };
      a_node.a_mesh.primitives.forEach((primitive) => {
        const primitiveNodesKey = JSON.stringify(primitive);
        let primitiveNodes = primitiveNodesMap.get(primitiveNodesKey);
        if (!primitiveNodes) {
          primitiveNodes = [];
          primitiveNodesMap.set(primitiveNodesKey, primitiveNodes);
        }
        primitiveNodes.push(renderNode);
      });
    });

    // 防止重复 makeBindGroup
    const materialCache = new Map<string, RenderNode>();
    // 注意这里直接遍历所有 mesh，而不是从 node 开始，因为不同 node 会用同一个 mesh（在上一步遍历已经包括了），导致重复
    this.a_meshs.forEach((a_mesh) => {
      a_mesh.a_primitives.forEach((a_primitive) => {
        const { gpuBuffers, indices, pipelineCacheKey, vertexCount } =
          a_primitive.makeBuffers();
        const materialKey = JSON.stringify(a_primitive.a_material?.__material);
        let material = materialCache.get(materialKey);
        if (!material) {
          material = {
            bindGroup: a_primitive.makeBindGroup(
              device,
              this.materialBindGroupLayout!
            )!,
            groupIndex: bindGroupLayouts.length + 1,
          };
          materialCache.set(materialKey, material);
        }
        // 多个 primitive 可以重复用同一个 pipeline，但 buffers 不同，因此我们需要记录
        let renderPipeline = this.renderPipelines.get(pipelineCacheKey);
        if (!renderPipeline) {
          const { pipeline, create } = getPipelineFromCache(
            JSON.parse(pipelineCacheKey),
            device,
            vertex,
            fragment,
            [
              ...bindGroupLayouts,
              this.nodeBindGroupLayout!,
              this.materialBindGroupLayout!,
            ],
            format,
            depthFormat
          );
          renderPipeline = {
            pipeline,
            // 多个 primitive 可以共用同一个 material，因此需要记录使用 material 的 primitive  1 对 多
            materialPrimitivesMap: new Map<RenderNode, RenderPrimitive[]>(),
          };
          if (create && record) record.pipelineCount++;
          this.renderPipelines.set(pipelineCacheKey, renderPipeline);
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
          nodes:
            primitiveNodesMap.get(JSON.stringify(a_primitive.__primitive)) ??
            [],
        });
      });
    });
  }

  // 以 render-order 进行渲染
  render(renderPass: GPURenderPassEncoder, record?: CreateAndSetRecord) {
    this.renderPipelines.forEach((renderPipeline) => {
      renderPass.setPipeline(renderPipeline.pipeline);
      this.record && this.record.pipelineSets++;
      renderPipeline.materialPrimitivesMap.forEach((primitives, material) => {
        renderPass.setBindGroup(material.groupIndex, material.bindGroup);
        this.record && this.record.bindGroupSets++;
        primitives.forEach((primitive) => {
          primitive.buffers.forEach(({ accessor, offset }, idx) => {
            this.record && this.record.bufferSets++;
            renderPass.setVertexBuffer(
              idx,
              accessor.view.gpuBuffer,
              offset,
              accessor.byteLength
            );
          });
          const { indices, vertexCount } = primitive;
          if (indices) {
            this.record && this.record.bufferSets++;
            renderPass.setIndexBuffer(
              indices.view.gpuBuffer!,
              indices.vertexType,
              indices.byteOffset,
              indices.byteLength
            );
          }
          primitive.nodes.forEach(({ groupIndex, bindGroup }) => {
            this.record && this.record.bindGroupSets++;
            renderPass.setBindGroup(groupIndex, bindGroup);
            if (indices) {
              renderPass.drawIndexed(indices.count);
            } else {
              renderPass.draw(vertexCount);
            }
            this.record && this.record.drawCount++;
          });
        });
      });
    });
  }
}

// gltf node
export class GLTFFlattenNode implements FlattenNode {
  name: string;
  matrix: Mat4;
  mesh: number;
  camera: number;
  bindGroup: GPUBindGroup | null = null;
  constructor(public a_mesh: GLTFMesh, node: FlattenNode) {
    this.name = node.name;
    this.mesh = node.mesh;
    this.camera = node.camera;
    this.matrix = node.matrix;
  }

  makeBindGroup(device: GPUDevice, bindGroupLayout: GPUBindGroupLayout) {
    const modelMatrixBuffer = device.createBuffer({
      size: 16 * 4 * 2,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true,
    });
    const normalMatrix = mat4.transpose(mat4.inverse(this.matrix));
    new Float32Array(modelMatrixBuffer.getMappedRange()).set([
      ...this.matrix,
      ...normalMatrix,
    ]);
    modelMatrixBuffer.unmap();
    this.bindGroup = device.createBindGroup({
      layout: bindGroupLayout,
      entries: [{ binding: 0, resource: { buffer: modelMatrixBuffer } }],
    });
    return this.bindGroup;
  }
}

// gltf mesh ：遍历，为每个 primitive 创建对应的渲染管线
export class GLTFMesh {
  constructor(public a_primitives: GLTFPrimitive[], mesh: GLTFMesh) {
    Object.assign(this, mesh);
  }
}

export const PipelineCache: Map<string, GPURenderPipeline> = new Map();
export const ShaderModuleCache: Map<string, GPUShaderModule> = new Map();
export function getShaderModuleFromCache(
  device: GPUDevice,
  args: Record<string, any>,
  code: ShaderModuleCode
) {
  const key = JSON.stringify(args);
  let module = ShaderModuleCache.get(key);
  if (!module) {
    module = device.createShaderModule({
      code: typeof code === "string" ? code : code(args),
    });
    ShaderModuleCache.set(key, module);
  }
  return module;
}
// 从缓存中获取 pipeline
export function getPipelineFromCache(
  args: Record<string, any>,
  device: GPUDevice,
  vertex: ShaderModuleCode,
  fragment: ShaderModuleCode,
  bindGroupLayouts: GPUBindGroupLayout[],
  format: GPUTextureFormat,
  depthFormat: GPUTextureFormat = "depth24plus"
) {
  const key = JSON.stringify(args);
  let pipeline = PipelineCache.get(key);
  if (pipeline) return { pipeline, create: false };
  let blend;
  switch (args.alphaMode) {
    case "BLEND":
      blend = {
        color: { srcFactor: "src-alpha", dstFactor: "one-minus-src-alpha" },
        alpha: { srcFactor: "one", dstFactor: "one" },
      } as GPUBlendState;
      break;
  }
  pipeline = device.createRenderPipeline({
    layout: device.createPipelineLayout({ bindGroupLayouts }),
    vertex: {
      module: getShaderModuleFromCache(
        device,
        args.shaderContext.vertex,
        vertex
      ),
      entryPoint: "main",
      buffers: args.bufferLayout,
    },
    fragment: {
      module: getShaderModuleFromCache(
        device,
        args.shaderContext.fragment,
        fragment
      ),
      entryPoint: "main",
      targets: [{ format, blend }],
    },
    primitive: {
      cullMode: args.doubleSided ? "none" : "back",
      ...args.primitive,
    },
    depthStencil: {
      format: depthFormat,
      depthWriteEnabled: true,
      depthCompare: "less",
    },
  });
  PipelineCache.set(key, pipeline);
  return { pipeline, create: true };
}

export interface GPUBufferAccessor {
  accessor: GLTFAccessor;
  offset: number;
}
// gltf primitive ：创建对应的渲染管线和渲染过程
export class GLTFPrimitive {
  public renderPipeline: GPURenderPipeline | null = null;
  public vertexCount: number = 0;
  public bufferLayout: GPUVertexBufferLayout[] = [];
  public gpuBuffers: GPUBufferAccessor[] = [];
  constructor(
    public a_indices: GLTFAccessor | null,
    public topology: GLTFRenderMode,
    public attributeAccessors: AttributeAccessor[],
    public a_material: GLTFMaterial | undefined,
    public __primitive: GLTFPrimitive
  ) {
    Object.assign(this, this.__primitive);
    this.a_indices?.view.addUsage(
      GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST
    );
    this.setupPrimitive();
  }

  makeBuffers() {
    const primitive: GPUPrimitiveState = { topology: "triangle-list" };
    if (this.topology == GLTFRenderMode.TRIANGLE_STRIP) {
      primitive.topology = "triangle-strip";
      if (this.a_indices)
        primitive.stripIndexFormat = this.a_indices!.vertexType;
    }
    const bufferLayout = this.bufferLayout;
    const alphaMode = this.a_material?.alphaMode ?? "OPAQUE";
    return {
      pipelineCacheKey: JSON.stringify({
        primitive,
        bufferLayout,
        alphaMode,
        doubleSided: this.a_material?.doubleSided ?? false,
        shaderContext: {
          vertex: {
            useTexcoord: "TEXCOORD_0" in this.attributes,
            useAlphaCutoff: alphaMode == "MASK",
          },
          fragment: {},
        },
      }),
      vertexCount: this.vertexCount,
      gpuBuffers: this.gpuBuffers,
      indices: this.a_indices,
    };
  }

  // 针对 separate 和 interleaved 分别处理
  setupPrimitive() {
    const bufferLayout: Map<string | number, GPUVertexBufferLayout> = new Map();
    const gpuBuffers: Map<
      GPUVertexBufferLayout,
      { accessor: GLTFAccessor; offset: number }
    > = new Map();
    this.attributeAccessors
      .sort((a, b) => a.accessor.byteOffset - b.accessor.byteOffset)
      .forEach(({ accessor, name, shaderLocation }) => {
        if (name == "POSITION") this.vertexCount = accessor.count;
        accessor.view.addUsage(GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST);
        let buffer = bufferLayout.get(accessor.bufferView);
        let gpuBuffer;
        let separate =
          buffer &&
          Math.abs(
            accessor.byteOffset -
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
          bufferLayout.set(separate ? name : accessor.bufferView, buffer);
          // 每个 GPUVertexBufferLayout 指向一个真实的 GPUBuffer
          gpuBuffers.set(buffer, {
            accessor: accessor,
            offset: accessor.byteOffset,
          });
        } else {
          // 如果是 interleaved
          gpuBuffer = gpuBuffers.get(buffer)!;
          gpuBuffer.offset = Math.min(gpuBuffer.offset, accessor.byteOffset);
        }

        (buffer.attributes as GPUVertexAttribute[]).push({
          shaderLocation,
          format: accessor.vertexType,
          offset: accessor.byteOffset,
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

  // 设置 material，TODO 有些 primitive 可以不存在 material
  makeBindGroup(device: GPUDevice, bindGroupLayout: GPUBindGroupLayout) {
    if (!this.a_material) return;
    const defs = makeShaderDataDefinitions(MaterialUniform);
    const uniformValue = makeStructuredView(defs.uniforms[M_U_NAME]);
    // 传递值
    uniformValue.set(this.a_material.uniformValue);
    const uniformBuffer = device.createBuffer({
      size: uniformValue.arrayBuffer.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(uniformBuffer, 0, uniformValue.arrayBuffer);

    const textures = this.a_material.textures;
    const bindGroup = device.createBindGroup({
      layout: bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: uniformBuffer } }, // uniform 值
        // 贴图
        ...(textures.map((texture, index) => {
          const texFn = texture.a_image.view.texture;
          const tex = typeof texFn === "function" ? texFn()! : texFn!;
          return {
            binding: index + 1,
            resource: tex.createView(),
          };
        }) as GPUBindGroupEntry[]),
        // 采样器
        {
          binding: textures.length + 1,
          resource: this.a_material.samplers[0],
        },
      ],
    });
    return bindGroup;
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
  usage: number;
  gpuBuffer: GPUBuffer | null = null;
  texture: GPUTexture | null = null;
  flag: GLTFBufferViewFlag = GLTFBufferViewFlag.BUFFER;
  constructor(buffer: GLTFBuffer, view: GLTFBufferView) {
    Object.assign(this, {
      byteStride: 0,
      byteOffset: 0,
      ...(view as Partial<GLTFBufferView>),
    });
    this.viewBuffer = buffer.subarray(
      this.byteOffset,
      this.byteOffset + this.byteLength
    );
    this.usage = 0;
  }

  setFlag(flag: GLTFBufferViewFlag) {
    this.flag = flag;
  }

  addUsage(usage: number) {
    this.usage = this.usage | usage;
  }

  async uploadTexture(device: GPUDevice, image: GLTFImage) {
    const blob = new Blob([this.viewBuffer], { type: image.mimeType });
    const bitmap = await createImageBitmap(blob);
    const descriptor = {
      size: [bitmap.width, bitmap.height],
      format: "rgba8unorm",
      usage: this.usage,
    } as GPUTextureDescriptor;
    this.texture?.destroy();
    this.texture = device.createTexture(descriptor);
    device.queue.copyExternalImageToTexture(
      { source: bitmap },
      { texture: this.texture },
      descriptor.size
    );
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
  constructor(public view: GLTFBufferView, accessor: GLTFAccessor) {
    Object.assign(this, {
      byteOffset: 0,
      ...(accessor as Partial<GLTFAccessor>),
    });
  }

  // step="vertex" 下的步长 单个vertex数据点的长度
  get byteStride() {
    const elementSize =
      Reflect.get(GLTFTypeNumber, this.type) *
      Reflect.get(
        GLTFComponentTypeSize,
        Reflect.get(GLTFComponentType, this.componentType)
      );
    return Math.max(elementSize, this.view.byteStride);
  }

  // 整个 vertex buffer 的长度
  get byteLength() {
    return this.count * this.byteStride;
  }

  // 返回单个 vertex 数据点的类型对应 GPUVertexFormat
  get vertexType() {
    const componentVertexFormat = Reflect.get(
      GLTFComponentType2GPUVertexFormat,
      Reflect.get(GLTFComponentType, this.componentType)
    );
    if (!componentVertexFormat)
      throw Error(
        `Unrecognized or unsupported glTF type ${this.componentType}`
      );
    const componentNums = Reflect.get(GLTFTypeNumber, this.type);
    return componentNums > 1
      ? `${componentVertexFormat}x${componentNums}`
      : componentVertexFormat;
  }
}

export class GLTFImage {
  constructor(image: GLTFImage, public view: GLTFBufferView) {
    Object.assign(this, image);
    view.setFlag(GLTFBufferViewFlag.TEXTURE);
    view.addUsage(
      GPUTextureUsage.TEXTURE_BINDING |
        GPUTextureUsage.COPY_DST |
        GPUTextureUsage.RENDER_ATTACHMENT
    );
  }
}
export class GLTFSampler {
  sampler: GPUSampler | null = null;
  static defaultSampler: GPUSampler | null = null;
  constructor(sampler: GLTFSampler) {
    Object.assign(this, sampler);
  }

  static createDefaultSampler(device: GPUDevice) {
    if (!GLTFSampler.defaultSampler) {
      GLTFSampler.defaultSampler = device.createSampler({
        addressModeU: "repeat",
        addressModeV: "repeat",
        minFilter: "linear",
        magFilter: "linear",
        mipmapFilter: "linear",
      });
    }
  }

  uploadSampler(device: GPUDevice) {
    GLTFSampler.createDefaultSampler(device);
    const descriptor: GPUSamplerDescriptor = {
      addressModeU: this.addressModeForWrap(this.wrapS),
      addressModeV: this.addressModeForWrap(this.wrapT),
    };
    // WebGPU's default min/mag/mipmap filtering is nearest, se we only have to override it if we
    // want linear filtering for some aspect.
    if (!this.magFilter || this.magFilter === GLTFSamplerMagFilterType.LINEAR) {
      descriptor.magFilter = "linear";
    }
    switch (this.minFilter) {
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
    this.sampler = device.createSampler(descriptor);
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

export class GLTFTexture {
  constructor(
    texture: GLTFTexture,
    public a_image: GLTFImage | { view: { texture: () => GPUTexture | null } },
    public a_sampler: GPUSampler
  ) {
    Object.assign(this, texture);
  }
}
export class GLTFMaterial {
  uniformValue: Record<string, number | number[]>;
  textures: GLTFTexture[];
  samplers: GPUSampler[] = [];
  constructor(public __material: GLTFMaterial, textures: GLTFTexture[]) {
    Object.assign(this, __material);
    // 值
    this.uniformValue = {
      baseColorFactor: this.pbrMetallicRoughness.baseColorFactor ?? [
        1, 1, 1, 1,
      ],
      alphaCutoff: this.alphaCutoff ?? 0.5,
    };
    // 贴图和采样器
    this.textures = [
      {
        a: this.pbrMetallicRoughness.baseColorTexture,
        d: () => SolidColorTexture.opaqueWhiteTexture,
      },
      {
        a: this.normalTexture,
        d: () => SolidColorTexture.defaultNormalTexture,
      },
      {
        a: this.pbrMetallicRoughness.metallicRoughnessTexture,
        d: () => SolidColorTexture.opaqueWhiteTexture,
      },
      {
        a: this.emissiveTexture,
        d: () => SolidColorTexture.transparentBlackTexture,
      },
      {
        a: this.occlusionTexture,
        d: () => SolidColorTexture.transparentBlackTexture,
      },
    ].map(({ a, d }) => {
      const res =
        a?.index !== undefined
          ? textures[a?.index]
          : new GLTFTexture(
              { source: -1, sampler: -1 } as any,
              { view: { texture: d } },
              GLTFSampler.defaultSampler!
            );
      if (!this.samplers.includes(res.a_sampler))
        this.samplers.push(res.a_sampler);
      return res;
    });
  }
}
