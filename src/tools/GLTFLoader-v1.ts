import { Mat4, mat4 } from "wgpu-matrix";

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

export enum GLTFPrimitiveAttributeShaderLocation {
  POSITION = 0,
  NORMAL = 1,
  TEXCOORD_0 = 2,
  TANGENT = 3,
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

export interface GLTFJSON {
  asset: GLTFAsset;
  scene: number;
  scenes: GLTFScene[];
  nodes: GLTFNode[];
  meshes: GLTFMesh[];
  accessors: GLTFAccessor[];
  bufferViews: GLTFBufferView[];
  buffers: GLTFBuffer[];
}

export class GLTFLoaderV1 {
  async load(device: GPUDevice, filename: string) {
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
              shaderLocation: Reflect.get(
                GLTFPrimitiveAttributeShaderLocation,
                attributeKey
              ),
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

    const gltfScene = new GLTFScene(nodes, defaultScene);

    bufferViews.forEach((view) => view.upload(device));

    return gltfScene;
  }
}

export class CreateAndSetRecord {
  // 创建了多少个 pipeline
  public pipelineCount: number = 0;
  // 切换了多少次 pipeline
  public pipelineSets: number = 0;
  // 创建了多少个 bindGroup
  public bindGroupCount: number = 0;
  // 切换了多少次 bindGroup
  public bindGroupSets: number = 0;
  // 切换了多少次 buffers
  public bufferSets: number = 0;
  // 调用了多少次 draw
  public drawCount: number = 0;
}

// gltf scene
export class GLTFScene {
  constructor(public a_nodes: GLTFFlattenNode[], scene: GLTFScene) {
    Object.assign(this, scene);
  }
  buildRenderPipeline(
    device: GPUDevice,
    vertex: GPUShaderModule,
    fragment: GPUShaderModule,
    bindGroupLayouts: GPUBindGroupLayout[],
    format: GPUTextureFormat,
    depthFormat: GPUTextureFormat = "depth24plus",
    record?: CreateAndSetRecord
  ) {
    this.a_nodes.forEach((node) =>
      node.buildRenderPipeline(
        device,
        vertex,
        fragment,
        bindGroupLayouts,
        format,
        depthFormat,
        record
      )
    );
  }
  render(renderPass: GPURenderPassEncoder, record?: CreateAndSetRecord) {
    this.a_nodes.forEach((node) => node.render(renderPass, record));
  }
}

// gltf node
export class GLTFFlattenNode implements FlattenNode {
  name: string;
  matrix: Mat4;
  mesh: number;
  camera: number;
  modelMatrixBuffer: GPUBuffer | null = null;
  bindGroup: GPUBindGroup | null = null;
  bindGroupIndex: number = 1;
  constructor(public a_mesh: GLTFMesh, node: FlattenNode) {
    this.name = node.name;
    this.mesh = node.mesh;
    this.camera = node.camera;
    this.matrix = node.matrix;
  }
  buildRenderPipeline(
    device: GPUDevice,
    vertex: GPUShaderModule,
    fragment: GPUShaderModule,
    bindGroupLayouts: GPUBindGroupLayout[],
    format: GPUTextureFormat,
    depthFormat: GPUTextureFormat = "depth24plus",
    record?: CreateAndSetRecord
  ) {
    this.modelMatrixBuffer = device.createBuffer({
      size: 16 * 4,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true,
    });
    new Float32Array(this.modelMatrixBuffer.getMappedRange()).set(this.matrix);
    this.modelMatrixBuffer.unmap();
    // new group
    const bindGroupLayout = device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX,
          buffer: { type: "uniform" },
        },
      ],
    });
    this.bindGroup = device.createBindGroup({
      layout: bindGroupLayout,
      entries: [{ binding: 0, resource: { buffer: this.modelMatrixBuffer } }],
    });
    this.bindGroupIndex = bindGroupLayouts.length;
    record && record.bindGroupCount++;
    this.a_mesh.buildRenderPipeline(
      device,
      vertex,
      fragment,
      [...bindGroupLayouts, bindGroupLayout],
      format,
      depthFormat,
      record
    );
  }
  render(renderPass: GPURenderPassEncoder, record?: CreateAndSetRecord) {
    record && record.bindGroupSets++;
    renderPass.setBindGroup(this.bindGroupIndex, this.bindGroup!);
    this.a_mesh.render(renderPass, record);
  }
}

// gltf mesh ：遍历，为每个 primitive 创建对应的渲染管线
export class GLTFMesh {
  constructor(public a_primitives: GLTFPrimitive[], mesh: GLTFMesh) {
    Object.assign(this, mesh);
  }
  buildRenderPipeline(
    device: GPUDevice,
    vertex: GPUShaderModule,
    fragment: GPUShaderModule,
    bindGroupLayouts: GPUBindGroupLayout[],
    format: GPUTextureFormat,
    depthFormat: GPUTextureFormat = "depth24plus",
    record?: CreateAndSetRecord
  ) {
    this.a_primitives.forEach((primitive) =>
      primitive.buildRenderPipeline(
        device,
        vertex,
        fragment,
        bindGroupLayouts,
        format,
        depthFormat,
        record
      )
    );
  }

  render(renderPass: GPURenderPassEncoder, record?: CreateAndSetRecord) {
    this.a_primitives.forEach((primitive) =>
      primitive.render(renderPass, record)
    );
  }
}

export const PipelineCache: Map<string, GPURenderPipeline> = new Map();
// 从缓存中获取 pipeline
export function getPipelineFromCache(
  args: Record<string, any>,
  device: GPUDevice,
  vertex: GPUShaderModule,
  fragment: GPUShaderModule,
  bindGroupLayouts: GPUBindGroupLayout[],
  format: GPUTextureFormat,
  depthFormat: GPUTextureFormat = "depth24plus"
) {
  const key = JSON.stringify(args);
  let pipeline = PipelineCache.get(key);
  if (pipeline) return { pipeline, create: false };
  pipeline = device.createRenderPipeline({
    layout: device.createPipelineLayout({ bindGroupLayouts }),
    vertex: {
      module: vertex,
      entryPoint: "main",
      buffers: args.bufferLayout,
    },
    fragment: {
      module: fragment,
      entryPoint: "main",
      targets: [{ format }],
    },
    primitive: {
      cullMode: "back",
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

// gltf primitive ：创建对应的渲染管线和渲染过程
export class GLTFPrimitive {
  public renderPipeline: GPURenderPipeline | null = null;
  public vertexCount: number = 0;
  public bufferLayout: GPUVertexBufferLayout[] = [];
  public gpuBuffers: {
    accessor: GLTFAccessor;
    offset: number;
  }[] = [];
  constructor(
    public a_indices: GLTFAccessor | null,
    public topology: GLTFRenderMode,
    public attributeAccessors: AttributeAccessor[],
    primitive: GLTFPrimitive
  ) {
    Object.assign(this, primitive);
    this.a_indices?.view.addUsage(GPUBufferUsage.INDEX);
    this.setupPrimitive();
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
        accessor.view.addUsage(GPUBufferUsage.VERTEX);
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

  buildRenderPipeline(
    device: GPUDevice,
    vertex: GPUShaderModule,
    fragment: GPUShaderModule,
    bindGroupLayouts: GPUBindGroupLayout[],
    format: GPUTextureFormat,
    depthFormat: GPUTextureFormat = "depth24plus",
    record?: CreateAndSetRecord
  ) {
    const primitive: GPUPrimitiveState = { topology: "triangle-list" };
    if (this.topology == GLTFRenderMode.TRIANGLE_STRIP) {
      primitive.topology = "triangle-strip";
      if (this.a_indices)
        primitive.stripIndexFormat = this.a_indices!.vertexType;
    }
    const bufferLayout = this.bufferLayout;
    const { pipeline, create } = getPipelineFromCache(
      {
        primitive,
        bufferLayout,
      },
      device,
      vertex,
      fragment,
      bindGroupLayouts,
      format,
      depthFormat
    );
    this.renderPipeline = pipeline;
    if (create && record) record.pipelineCount++;
  }

  render(renderPass: GPURenderPassEncoder, record?: CreateAndSetRecord) {
    if (!this.renderPipeline) return;
    renderPass.setPipeline(this.renderPipeline);
    record && record.pipelineSets++;
    this.gpuBuffers.forEach(({ accessor, offset }, idx) => {
      record && record.bufferSets++;
      renderPass.setVertexBuffer(
        idx,
        accessor.view.gpuBuffer,
        offset,
        accessor.byteLength
      );
    });

    if (this.a_indices) {
      record && record.bufferSets++;
      renderPass.setIndexBuffer(
        this.a_indices.view.gpuBuffer!,
        this.a_indices.vertexType,
        this.a_indices.byteOffset,
        this.a_indices.byteLength
      );
      renderPass.drawIndexed(this.a_indices.count);
    } else {
      renderPass.draw(this.vertexCount);
    }

    record && record.drawCount++;
  }
}

// gltf buffers ：创建对应的 Uint8Array
export class GLTFBuffer extends Uint8Array {
  constructor(buffer: ArrayBuffer, byteOffset: number, byteLength: number) {
    super();
    return new Uint8Array(buffer, byteOffset, byteLength);
  }
}

// gltf buffer view
export class GLTFBufferView {
  viewBuffer: Uint8Array;
  usage: number;
  gpuBuffer: GPUBuffer | null = null;
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
    this.usage = GPUBufferUsage.COPY_DST;
  }

  addUsage(usage: number) {
    this.usage = this.usage | usage;
  }

  // 最小的 bufferView，不再进行切分了
  upload(device: GPUDevice) {
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
