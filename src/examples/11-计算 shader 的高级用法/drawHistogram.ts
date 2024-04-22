import { mat4 } from "wgpu-matrix";
import { createCanvas, createRenderPipeline } from "../../tools";
import { DrawImageBitmapOptions } from "../../tools/display";
import {
  TypedArray,
  makeShaderDataDefinitions,
  makeStructuredView,
} from "webgpu-utils";

const vertex = /* wgsl */ `

struct Varyings {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
}

struct Uniform {
  matrix: mat4x4f,
  colors: array<vec4f, 16>,
  scale: vec4f,
  channelMult: vec4u,
}

@group(0) @binding(0) var<uniform> uni: Uniform;

@vertex 
fn main(@builtin(vertex_index) vertexIndex: u32) -> Varyings {
  let pos = array(
    vec2f(0., 0.),
    vec2f(1., 0.),
    vec2f(0., 1.),
    vec2f(1., 0.),
    vec2f(0., 1.),
    vec2f(1., 1.),
  );
  var o: Varyings;
  o.position = uni.matrix * vec4f(pos[vertexIndex], 0., 1.);
  o.uv = pos[vertexIndex];
  return o;
}
`;

const fragment = /* wgsl */ `

struct Uniform {
  matrix: mat4x4f,
  colors: array<vec4f, 16>,
  scale: vec4f,
  channelMult: vec4u,
}

@group(0) @binding(0) var<uniform> uni: Uniform;
@group(0) @binding(1) var<storage, read> histogram: array<vec4u>;

@fragment 
fn main(@location(0) uv: vec2f) -> @location(0) vec4f {
  let numBins = arrayLength(&histogram);
  let bin = clamp(u32(uv.x * f32(numBins)), 0, numBins-1);
  let height = vec4f(histogram[bin]) * uni.scale;
  let colored = height > vec4f(uv.y);
  let ndx = dot(select(vec4u(0), uni.channelMult, colored), vec4u(1));
  return uni.colors[ndx];
}
`;

const defs = makeShaderDataDefinitions(vertex);
const uniformValues = makeStructuredView(defs.uniforms.uni);
const matrix = mat4.translation([-1, -1, 0]);
mat4.scale(matrix, [2, 2, 1], matrix);
const colors = [
  [0, 0, 0, 1],
  [1, 0, 0, 1],
  [0, 1, 0, 1],
  [1, 1, 0, 1],
  [0, 0, 1, 1],
  [1, 0, 1, 1],
  [0, 1, 1, 1],
  [0.5, 0.5, 0.5, 1],
  [1, 1, 1, 1],
  [1, 1, 1, 1],
  [1, 1, 1, 1],
  [1, 1, 1, 1],
  [1, 1, 1, 1],
  [1, 1, 1, 1],
  [1, 1, 1, 1],
  [1, 1, 1, 1],
].flat();
uniformValues.set({
  matrix,
  colors,
});

export function drawHistogramWebGPURender(
  histogram: TypedArray,
  numEntries: number,
  config: GPUCanvasConfiguration,
  options: DrawImageBitmapOptions & {
    width: number;
    height: number;
    channel: number[];
    clearColor: GPUColor;
  }
) {
  const { device, format } = config;
  const { height, width, channel, clearColor, canvas: exist_canvas } = options;
  const numBins = histogram.length / 4;
  const max = [0, 0, 0, 0];
  histogram.forEach((v: number, idx: number) => {
    const ch = idx % 4;
    max[ch] = Math.max(max[ch], v);
  });
  const scale = max.map((m) => Math.max(1 / m, (0.2 * numBins) / numEntries));

  const range = (i: number, fn: (j: number) => number) =>
    new Array(i).fill(0).map((_, i) => fn(i));
  const channelMult = range(4, (i: number) =>
    channel.indexOf(i) >= 0 ? 2 ** i : 0
  );
  uniformValues.set({
    scale,
    channelMult,
  });
  let { ctx, canvas } = exist_canvas
    ? { ctx: exist_canvas.getContext("webgpu")!, canvas: exist_canvas }
    : createCanvas(width, height, config, options.className, options.parentId);

  const pipeline = createRenderPipeline(vertex, fragment, device, format);
  const uniformBuffer = device.createBuffer({
    size: uniformValues.arrayBuffer.byteLength,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(uniformBuffer, 0, uniformValues.arrayBuffer);
  const histBuffer = device.createBuffer({
    size: histogram.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(histBuffer, 0, histogram);
  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: uniformBuffer } },
      { binding: 1, resource: { buffer: histBuffer } },
    ],
  });
  const encoder = device.createCommandEncoder();
  const pass = encoder.beginRenderPass({
    colorAttachments: [
      {
        loadOp: "clear",
        storeOp: "store",
        clearValue: clearColor,
        view: ctx.getCurrentTexture().createView(),
      },
    ],
  });
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.draw(6);
  pass.end();
  device.queue.submit([encoder.finish()]);

  return canvas;
}
