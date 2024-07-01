import {
  checkWebGPUSupported,
  createCanvas,
  createRenderPipeline,
} from "../../tools";
import vertex from "./shaders/vert.wgsl?raw";
import fragment from "./shaders/frag.wgsl?raw";
import { createCircleVertices } from "./data";
import { mod, rand } from "../../tools/math";
import { GUI } from "dat.gui";
import TimeHelper from "../../tools/utils/time-helper/TimeHelper";

const { device, format } = await checkWebGPUSupported(
  {},
  {
    requiredFeatures: ["timestamp-query"],
  }
);
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

const { vertexData, numVertices } = createCircleVertices({
  radius: 0.5,
  innerRadius: 0.2,
});
const vertexBuffer = device.createBuffer({
  size: vertexData.byteLength,
  usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
});
device.queue.writeBuffer(vertexBuffer, 0, vertexData);

const staticBufferSize = (1 + 2) * 4;
const colorOffset = 0;
const scaleOffset = 1;

const nums = 10000;
// 初始位置和速度
const objectData: Array<{
  offset: [number, number];
  velocity: [number, number];
}> = [];

// 共享同一块二进制 buffer
const staticValuesF32 = new Float32Array((staticBufferSize * nums) / 4);
const staticValuesU8 = new Uint8Array(staticValuesF32.buffer);

for (let i = 0; i < nums; i++) {
  const startOffsetF32 = i * (staticBufferSize / 4);
  const startOffsetU8 = startOffsetF32 * 4;
  staticValuesU8.set(
    [rand() * 255, rand() * 255, rand() * 255, 255],
    startOffsetU8 + colorOffset
  );
  staticValuesF32.set(
    [rand(0.1, 0.5), rand(0.1, 0.5)],
    startOffsetF32 + scaleOffset
  );
  objectData.push({
    offset: [rand(-0.9, 0.9), rand(-0.9, 0.9)],
    velocity: [rand(-0.1, 0.1), rand(-0.1, 0.1)],
  });
}
const staticBuffer = device.createBuffer({
  label: `static buffer for all instances`,
  size: staticValuesF32.byteLength,
  usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
});
device.queue.writeBuffer(staticBuffer, 0, staticValuesF32);

const changingBufferSize = 2 * 4;
const changingValues = new Float32Array((changingBufferSize * nums) / 4);
const changingBuffer = device.createBuffer({
  label: `changing buffer for all instances`,
  size: changingValues.byteLength,
  usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
});

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
  // 静态数据 buffer
  {
    arrayStride: staticBufferSize,
    stepMode: "instance",
    attributes: [
      {
        offset: colorOffset * 4,
        shaderLocation: 1,
        format: "unorm8x4", // norm 到 0-1
      },
      {
        offset: scaleOffset * 4,
        shaderLocation: 2,
        format: "float32x2",
      },
    ],
  },
  // 动态数据 buffer
  {
    arrayStride: changingBufferSize,
    stepMode: "instance",
    attributes: [
      {
        offset: 0,
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

// gui
const gui = new GUI();
const setting = {
  nums: 100,
};
gui.add(setting, "nums", 1, nums, 1);

const timeHelper = new TimeHelper(device);

export async function frame(now: number) {
  timeHelper.record(now);
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
    ...timeHelper.timestampWrites,
  });
  renderPass.setPipeline(renderPipeline);
  renderPass.setVertexBuffer(0, vertexBuffer);
  renderPass.setVertexBuffer(1, staticBuffer);
  renderPass.setVertexBuffer(2, changingBuffer);
  for (let k = 0; k < setting.nums; k++) {
    const { offset, velocity } = objectData[k];
    // 线性周期运动
    offset[0] =
      mod(offset[0] + velocity[0] * timeHelper.deltaTime + 1.5, 3) - 1.5;
    offset[1] =
      mod(offset[1] + velocity[1] * timeHelper.deltaTime + 1.5, 3) - 1.5;
    changingValues.set(offset, (k * changingBufferSize) / 4);
  }
  device.queue.writeBuffer(
    changingBuffer,
    0,
    changingValues,
    0,
    (setting.nums * changingBufferSize) / 4
  );
  renderPass.draw(numVertices, setting.nums);
  renderPass.end();
  timeHelper.end(commandEncoder);

  // 编码结束，提交命令
  device.queue.submit([commandEncoder.finish()]);
  await timeHelper.finish();
  requestAnimationFrame(frame);
}
