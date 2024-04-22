import { BuiltRenderPipelineOptions, CreateAndSetRecord } from "..";
import { normalize, rand } from "../../math";
import vertex from "../shaders/vertex-wgsl/normal.wgsl";
import fragment from "../shaders/fragment-wgsl/display-light.wgsl?raw";
import { ShaderLocation } from "../shaders";
import { Mat4, mat4 } from "wgpu-matrix";

export class ExtendModel {
  public comments: string[] = [];
  public name: string = "";
  public vertexs: number[] = [];
  public uvs: number[] = [];
  public norms: number[] = [];
  public indices: number[] = [];
  public vertexData: number[] = [];
  public matrix: Mat4 = mat4.identity();
  renderPipeline: GPURenderPipeline | null = null;
  renderBuffers: {
    vertexBuffer: GPUBuffer;
    vertexDescriptor: Iterable<GPUVertexBufferLayout | null>;
    indicesBuffer: GPUBuffer;
    indexFormat: GPUIndexFormat;
  } | null = null;
  renderBindGroup: {
    groupIndex: number;
    bindGroup: GPUBindGroup;
    bindGroupLayout: GPUBindGroupLayout;
  } | null = null;

  get VertexCount(): number {
    return this.vertexs.length / 3;
  }

  makeBuffers(
    device: GPUDevice,
    options?: {
      indexFormat: GPUIndexFormat;
    }
  ) {
    if (this.vertexs.length === 0) throw new Error("No vertex");
    const { indexFormat = "uint32" } = options ?? {};
    const indices =
      indexFormat === "uint32"
        ? new Uint32Array(this.indices)
        : new Uint16Array(this.indices);
    const indicesBuffer = device.createBuffer({
      size: indices.byteLength,
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(indicesBuffer, 0, indices);

    const vertexValues = new Float32Array(this.vertexData);
    const vertexBuffer = device.createBuffer({
      size: vertexValues.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(vertexBuffer, 0, vertexValues);
    const vertexDescriptor: Iterable<GPUVertexBufferLayout | null> = [
      {
        arrayStride: (3 + 3 + 2) * 4,
        stepMode: "vertex",
        attributes: [
          {
            shaderLocation: ShaderLocation.POSITION,
            offset: 0,
            format: `float32x3`,
          },
          {
            shaderLocation: ShaderLocation.NORMAL,
            offset: 3 * 4,
            format: `float32x3`,
          },
          {
            shaderLocation: ShaderLocation.TEXCOORD_0,
            offset: 6 * 4,
            format: `float32x2`,
          },
        ],
      },
    ];

    return { indicesBuffer, vertexBuffer, vertexDescriptor, indexFormat };
  }

  makeBindGroup(device: GPUDevice) {
    const bindGroupLayout = device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX,
          buffer: { type: "uniform" },
        },
      ],
    });
    const modelMatrixBuffer = device.createBuffer({
      size: 16 * 4,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true,
    });
    new Float32Array(modelMatrixBuffer.getMappedRange()).set(this.matrix);
    modelMatrixBuffer.unmap();
    const bindGroup = device.createBindGroup({
      layout: bindGroupLayout,
      entries: [{ binding: 0, resource: { buffer: modelMatrixBuffer } }],
    });
    return { bindGroup, bindGroupLayout };
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
    this.renderBuffers = this.makeBuffers(device, { indexFormat: "uint32" });

    this.renderBindGroup = {
      ...this.makeBindGroup(device),
      groupIndex: bindGroupLayouts.length,
    };

    record && record.bindGroupCount++;

    this.renderPipeline = device.createRenderPipeline({
      layout: device.createPipelineLayout({
        bindGroupLayouts: [
          ...bindGroupLayouts,
          this.renderBindGroup.bindGroupLayout,
        ],
      }),
      vertex: {
        module: vertex,
        entryPoint: "main",
        buffers: this.renderBuffers.vertexDescriptor,
      },
      fragment: {
        module: fragment,
        entryPoint: "main",
        targets: [{ format }],
      },
      primitive: {
        cullMode: "back",
        topology: "triangle-list",
      },
      depthStencil: {
        format: depthFormat,
        depthWriteEnabled: true,
        depthCompare: "less",
      },
    });

    record && record.pipelineCount++;
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
      device.createShaderModule({ code: vertex }),
      device.createShaderModule({ code: fragment }),
      bindGroupLayouts,
      format,
      depthFormat,
      record
    );
  }

  render(renderPass: GPURenderPassEncoder, record?: CreateAndSetRecord) {
    if (!this.renderPipeline) return;
    const { vertexBuffer, indicesBuffer, indexFormat } = this.renderBuffers!;
    const { groupIndex, bindGroup } = this.renderBindGroup!;
    renderPass.setPipeline(this.renderPipeline!);
    record && record.pipelineSets++;
    renderPass.setVertexBuffer(0, vertexBuffer);
    renderPass.setIndexBuffer(indicesBuffer, indexFormat);
    if (record) record.bufferSets = record.bufferSets + 2;
    renderPass.setBindGroup(groupIndex, bindGroup);
    record && record.bindGroupSets++;
    renderPass.drawIndexed(this.indices.length);
    record && record.drawCount++;
  }
}

export class ObjLoader {
  async load(
    device: GPUDevice,
    filename: string,
    builtRenderPipelineOptions: BuiltRenderPipelineOptions
  ) {
    const objModel = await this.parse(filename);
    // 创建渲染管线
    const { bindGroupLayouts, format, depthFormat, record } =
      builtRenderPipelineOptions;
    objModel.buildInRenderPipeline(
      device,
      bindGroupLayouts,
      format,
      depthFormat,
      record
    );
    return objModel;
  }

  async parse(filename: string) {
    const content = await (await fetch(filename)).text();
    const lines = content.split("\n");
    const objModel = new ExtendModel();
    ///////////////////////////////
    const vertexCache: number[][] = [];
    const uvCache: number[][] = [];
    const normCache: number[][] = [];
    const faceCache: string[][] = [];
    ///////////////////////////////
    objModel.name = filename.split("/").at(-1) ?? "";
    lines.forEach((line) => {
      const strim = line.trim();
      const [mark, ...data] = strim.split(" ");
      if (mark === "#") objModel.comments.push(data.join(" "));
      else if (mark === "o") objModel.name = data.join(" ");
      else if (mark === "v") vertexCache.push(data.map(parseFloat));
      else if (mark === "vt") uvCache.push(data.map(parseFloat));
      else if (mark === "vn") normCache.push(data.map(parseFloat));
      else if (mark === "f") faceCache.push(data);
      else {
      }
    });

    //////////////////////////////
    const vertexs: number[] = [];
    const uvs: number[] = [];
    const norms: number[] = [];
    const indices: number[] = [];
    const vertexData: number[] = [];

    //////////////////////////////
    const remapping: Record<string, number> = {};
    let i = 0;
    for (const face of faceCache) {
      for (const faceVertex of face) {
        if (remapping[faceVertex] !== undefined) {
          indices.push(remapping[faceVertex]);
          continue;
        }
        remapping[faceVertex] = i;
        indices.push(i);
        const [vertexIndex, uvIndex, normIndex] = faceVertex
          .split("/")
          .map((s) => Number(s) - 1);
        if (vertexIndex > -1) {
          vertexs.push(...vertexCache[vertexIndex]);
          vertexData.push(...vertexCache[vertexIndex]);
        }
        const normV =
          normIndex > -1
            ? normCache[normIndex]
            : normalize([(rand(-1, 1), rand(-1, 1), rand(-1, 1))]);
        norms.push(...normV);
        vertexData.push(...normV);

        const uvV = uvIndex > -1 ? uvCache[uvIndex] : [rand(0, 1), rand(0, 1)];
        uvs.push(...uvV);
        vertexData.push(...uvV);
        i++;
      }
    }
    objModel.vertexs = vertexs;
    objModel.uvs = uvs;
    objModel.norms = norms;
    objModel.indices = indices;
    objModel.vertexData = vertexData;
    return objModel;
  }
}
