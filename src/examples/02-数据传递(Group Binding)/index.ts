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

const renderPipeline = createRenderPipeline(vertex, fragment, device, format);

const uniformBufferSize = (4 + 2 + 2) * 4;
const uColorOffset = 0;
const uScaleOffset = 4;
const uOffsetOffset = 6;

// 创建一捆 Uniform Group Binding，每个实例对应不同的 Uniform Group Binding
const nums = 100;
const objects: Array<{
  uniformBuffer: GPUBuffer;
  uniformValues: Float32Array;
  bindGroup: GPUBindGroup;
}> = [];

for (let i = 0; i < nums; i++) {
  const uniformBuffer = device.createBuffer({
    label: `uniforms buffer for object ${i}`,
    size: uniformBufferSize,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  const uniformValues = new Float32Array(uniformBufferSize / 4);
  uniformValues.set([rand(), rand(), rand(), 1], uColorOffset);
  uniformValues.set([rand(0.1, 0.5), rand(0.1, 0.5)], uScaleOffset);
  uniformValues.set([rand(-0.9, 0.9), rand(-0.9, 0.9)], uOffsetOffset);

  const bindGroup = device.createBindGroup({
    label: `group bind for object ${i}`,
    layout: renderPipeline.getBindGroupLayout(0),
    entries: [{ binding: 0, resource: { buffer: uniformBuffer } }],
  });

  // 静态buffer，直接写入
  device.queue.writeBuffer(uniformBuffer, 0, uniformValues);

  objects.push({
    uniformBuffer,
    uniformValues,
    bindGroup,
  });
}

const { vertexData, numVertices } = createCircleVertices({
  radius: 0.5,
  innerRadius: 0.2,
});
const vertexStorageBuffer = device.createBuffer({
  size: vertexData.byteLength,
  usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
});
device.queue.writeBuffer(vertexStorageBuffer, 0, vertexData);
const storageBindGroup = device.createBindGroup({
  label: `storage group bind for vertex data`,
  layout: renderPipeline.getBindGroupLayout(1),
  entries: [{ binding: 0, resource: { buffer: vertexStorageBuffer } }],
});

/* 方式二：创建一个巨大的 Storage Group Binding，来代表存放实例变量的数组
   在绘制的时候调用一次 renderPass.draw(3, nums); 
   shader 中使用 @builtin(instance_index) 来获取当前绘制实例
 */

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
  renderPass.setBindGroup(1, storageBindGroup);
  // 将需要绘制的实例放在一个 command buffer 中进行
  objects.forEach(({ bindGroup }) => {
    // 这里还可以进行动态 buffer 写入
    renderPass.setBindGroup(0, bindGroup); // 命令循环：设置数据——绘制
    renderPass.draw(numVertices);
  });
  renderPass.end();
  // 编码结束，提交命令
  device.queue.submit([commandEncoder.finish()]);
  requestAnimationFrame(frame);
}
