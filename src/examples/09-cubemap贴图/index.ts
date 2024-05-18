import {
  checkWebGPUSupported,
  createCanvas,
  createRenderPipeline,
} from "../../tools";
import vertex from "./shader/vertex.wgsl?raw";
import fragment from "./shader/fragment.wgsl?raw";
import { createCubeVertex } from "./data";
import { StaticTextureUtils } from "../../tools/utils/StaticTextureUtil";
import { mat4 } from "wgpu-matrix";
import { degToRad } from "../../tools/math";
import { GUI } from "dat.gui";
import { createTextureFromSources } from "../../tools/loader";
import { createCubeMap } from "./cubemap";

const { device, format } = await checkWebGPUSupported();
const { ctx, aspect } = createCanvas(500, 500, {
  format,
  device,
});
const { vertexBuffer, indexBuffer, indexFormat, numVertices, discription } =
  createCubeVertex(device);

const pipeline = createRenderPipeline(
  vertex,
  fragment,
  device,
  format,
  discription,
  {
    primitive: {
      cullMode: "back",
    },
    depthStencil: {
      depthWriteEnabled: true,
      depthCompare: "less",
      format: "depth24plus",
    },
  }
);

const sampler = device.createSampler({
  magFilter: "linear",
  minFilter: "linear",
  mipmapFilter: "linear",
});
const texture = createTextureFromSources(device, createCubeMap(), {
  mips: true,
  filpY: false,
});

const uniformBuffer = device.createBuffer({
  size: 16 * 4,
  usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
});
const projectionMatrix = mat4.perspective(degToRad(70), aspect, 0.1, 10);
const viewMatrix = mat4.lookAt([0, 2, 5], [0, 0, 0], [0, 1, 0]);

const groupBind = device.createBindGroup({
  layout: pipeline.getBindGroupLayout(0),
  entries: [
    { binding: 0, resource: { buffer: uniformBuffer } },
    { binding: 1, resource: sampler },
    { binding: 2, resource: texture.createView({ dimension: "cube" }) },
  ],
});

const settings = {
  rotation: {
    x: 0,
    y: 0,
    z: 0,
  },
};
const gui = new GUI();
gui
  .add(settings.rotation, "x", -360, 360, 0.1)
  .name("rotation.x")
  .onChange(frame);
gui
  .add(settings.rotation, "y", -360, 360, 0.1)
  .name("rotation.y")
  .onChange(frame);
gui
  .add(settings.rotation, "z", -360, 360, 0.1)
  .name("rotation.z")
  .onChange(frame);

export function frame() {
  const canvasTexture = ctx.getCurrentTexture();
  const depthTexture = StaticTextureUtils.createDepthTexture(device, [
    canvasTexture.width,
    canvasTexture.height,
  ]);

  const commandEncoder = device.createCommandEncoder();
  const renderPass = commandEncoder.beginRenderPass({
    colorAttachments: [
      {
        loadOp: "clear",
        storeOp: "store",
        view: canvasTexture.createView(),
      },
    ],
    depthStencilAttachment: {
      // view: <- to be filled out when we render
      depthClearValue: 1.0,
      depthLoadOp: "clear",
      depthStoreOp: "store",
      view: depthTexture.createView(),
    },
  });

  const modelMatrix = mat4.identity();
  mat4.rotateX(modelMatrix, degToRad(settings.rotation.x), modelMatrix);
  mat4.rotateY(modelMatrix, degToRad(settings.rotation.y), modelMatrix);
  mat4.rotateZ(modelMatrix, degToRad(settings.rotation.z), modelMatrix);
  const mvpMatrix = mat4.multiply(
    mat4.multiply(projectionMatrix, viewMatrix),
    modelMatrix
  ) as Float32Array;
  device.queue.writeBuffer(uniformBuffer, 0, mvpMatrix);
  renderPass.setPipeline(pipeline);
  renderPass.setVertexBuffer(0, vertexBuffer);
  renderPass.setIndexBuffer(indexBuffer, indexFormat);
  renderPass.setBindGroup(0, groupBind);
  renderPass.drawIndexed(numVertices);
  renderPass.end();

  device.queue.submit([commandEncoder.finish()]);
}
