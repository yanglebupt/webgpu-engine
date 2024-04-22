import {
  checkWebGPUSupported,
  createCanvas,
  createComputePipeline,
} from "../../tools";
import compute from "./compute.wgsl.ts";

const { device, format } = await checkWebGPUSupported(
  {},
  {
    requiredFeatures: ["bgra8unorm-storage"],
  }
);

// 将 canvas 作为存储贴图
const { ctx } = createCanvas(500, 500, {
  device,
  format,
  usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.STORAGE_BINDING,
});

const pipeline = createComputePipeline(compute(format), device);

export function frame() {
  const texture = ctx.getCurrentTexture();

  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [{ binding: 0, resource: texture.createView() }],
  });

  const encoder = device.createCommandEncoder();
  const pass = encoder.beginComputePass();
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.dispatchWorkgroups(texture.width, texture.height);
  pass.end();

  const commandBuffer = encoder.finish();
  device.queue.submit([commandBuffer]);
}
