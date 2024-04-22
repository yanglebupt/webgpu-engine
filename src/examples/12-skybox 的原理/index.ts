import {
  checkWebGPUSupported,
  createCanvas,
  createRenderPipeline,
} from "../../tools";
import vertex from "./shader/vertex.wgsl?raw";
import fragment from "./shader/fragment.wgsl?raw";
import { createTextureFromImages } from "../../tools/loader";
import { mat4 } from "wgpu-matrix";
import { degToRad } from "../../tools/math";

const { device, format } = await checkWebGPUSupported();
const { ctx, aspect } = createCanvas(500, 500, { device, format });

const pipeline = createRenderPipeline(vertex, fragment, device, format);

const texture = await createTextureFromImages(device, [
  "/leadenhall_market/pos-x.jpg",
  "/leadenhall_market/neg-x.jpg",
  "/leadenhall_market/pos-y.jpg",
  "/leadenhall_market/neg-y.jpg",
  "/leadenhall_market/pos-z.jpg",
  "/leadenhall_market/neg-z.jpg",
]);
const sampler = device.createSampler();
const uniformValue = new Float32Array(4 * 4);
const uniformBuffer = device.createBuffer({
  size: uniformValue.byteLength,
  usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM,
});
const bindGroup = device.createBindGroup({
  layout: pipeline.getBindGroupLayout(0),
  entries: [
    { binding: 0, resource: { buffer: uniformBuffer } },
    { binding: 1, resource: sampler },
    { binding: 2, resource: texture.createView({ dimension: "cube" }) },
  ],
});

const projection = mat4.perspective(degToRad(60), aspect, 0.1, 10);

export function frame(time: number) {
  const iTime = time * 0.001;
  const encoder = device.createCommandEncoder();
  const pass = encoder.beginRenderPass({
    colorAttachments: [
      {
        loadOp: "clear",
        storeOp: "store",
        view: ctx.getCurrentTexture().createView(),
      },
    ],
  });
  const cameraPosition = [Math.cos(iTime * 0.2), 0, Math.sin(iTime * 0.2)];
  const view = mat4.lookAt(cameraPosition, [0, 0, 0], [0, 1, 0]);
  view[12] = 0;
  view[13] = 0;
  view[14] = 0;
  const pvInverse = mat4.inverse(mat4.multiply(projection, view)); // inverse(projection * view) 进行顶点变换，（clip space 转 世界坐标）作为 cubemap 采样的坐标
  uniformValue.set(pvInverse);
  device.queue.writeBuffer(uniformBuffer, 0, uniformValue);
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.draw(3);
  pass.end();
  device.queue.submit([encoder.finish()]);

  requestAnimationFrame(frame);
}
