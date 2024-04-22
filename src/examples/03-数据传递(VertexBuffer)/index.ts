import {
  checkWebGPUSupported,
  createCanvas,
  createRenderPipeline,
} from "../../tools";
import vertex from "./shaders/vert.wgsl?raw";
import fragment from "./shaders/frag.wgsl?raw";
import { createCircleVertices } from "./data";
import { rand } from "../../tools/math";

const { device, format } = await checkWebGPUSupported();
const { ctx } = createCanvas(
  500,
  500,
  {
    device,
    format,
    alphaMode: "opaque",
  },
  "app"
);

const storageBufferSize = (1 + 2 + 2) * 4;
const uColorOffset = 0;
const uScaleOffset = 1;
const uOffsetOffset = 3;

// 将每个示例数据，放入同一个 Storage Buffer，类似于数组
const nums = 100;

// 共享同一块二进制 buffer
const storageValuesF32 = new Float32Array((storageBufferSize * nums) / 4);
const storageValuesU8 = new Uint8Array(storageValuesF32.buffer); // 颜色可以使用 Uint8Array 1byte 来表示 0-255

for (let i = 0; i < nums; i++) {
  const startOffsetF32 = i * (storageBufferSize / 4);
  const startOffsetU8 = startOffsetF32 * 4;
  storageValuesU8.set(
    [rand() * 255, rand() * 255, rand() * 255, 255],
    startOffsetU8 + uColorOffset
  );
  storageValuesF32.set(
    [rand(0.1, 0.5), rand(0.1, 0.5)],
    startOffsetF32 + uScaleOffset
  );
  storageValuesF32.set(
    [rand(-0.9, 0.9), rand(-0.9, 0.9)],
    startOffsetF32 + uOffsetOffset
  );
}
const storageBuffer = device.createBuffer({
  label: `storage buffer for all instances`,
  size: storageValuesF32.byteLength,
  usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
});
device.queue.writeBuffer(storageBuffer, 0, storageValuesF32);

const { vertexData, numVertices } = createCircleVertices({
  radius: 0.5,
  innerRadius: 0.2,
});
const vertexStorageBuffer = device.createBuffer({
  size: vertexData.byteLength,
  usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
});
device.queue.writeBuffer(vertexStorageBuffer, 0, vertexData);

const bufferDescription: Iterable<GPUVertexBufferLayout | null> = [
  // 顶点数据 vertexStorageBuffer
  {
    arrayStride: 2 * 4,
    stepMode: "vertex",
    attributes: [
      {
        offset: 0,
        shaderLocation: 0,
        format: "float32x2",
      },
    ],
  },
  // 其他数据 storageBuffer
  {
    arrayStride: storageBufferSize,
    stepMode: "instance",
    attributes: [
      {
        offset: uColorOffset * 4,
        shaderLocation: 1,
        format: "unorm8x4", // norm 到 0-1
      },
      {
        offset: uScaleOffset * 4,
        shaderLocation: 2,
        format: "float32x2",
      },
      {
        offset: uOffsetOffset * 4,
        shaderLocation: 3,
        format: "float32x2",
      },
    ],
  },
];

const renderPipeline = createRenderPipeline(
  vertex,
  fragment,
  device,
  format,
  bufferDescription
);

export function frame() {
  // 创建指令编码来执行管道
  const commandEncoder = device.createCommandEncoder();
  const renderPass = commandEncoder.beginRenderPass({
    colorAttachments: [
      {
        clearValue: { r: 0, g: 0, b: 0, a: 1 },
        loadOp: "clear",
        storeOp: "store",
        view: ctx.getCurrentTexture().createView(),
      },
    ],
  });
  renderPass.setPipeline(renderPipeline);
  renderPass.setVertexBuffer(0, vertexStorageBuffer);
  renderPass.setVertexBuffer(1, storageBuffer);
  renderPass.draw(numVertices, nums);
  renderPass.end();
  // 编码结束，提交命令
  device.queue.submit([commandEncoder.finish()]);
  requestAnimationFrame(frame);
}
