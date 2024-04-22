import {
  checkWebGPUSupported,
  createCanvas,
  createRenderPipeline,
} from "../../tools";
import vertex from "./shaders/vertex.wgsl?raw";
import fragment from "./shaders/fragment.wgsl?raw";
import "./index.css";
import { createFVertexs } from "./data";
import { degToRad, rand } from "../../tools/math";
import { mat3, mat4 } from "wgpu-matrix";
import { GUI } from "dat.gui";

const { device, format } = await checkWebGPUSupported();
const { ctx, width, height } = createCanvas(
  500,
  500,
  {
    device,
    format,
    alphaMode: "premultiplied",
  },
  "grid-bg"
);

// 顶点数据
const { indexNums, indexBuffer, indexFormat, vertexBuffer, description } =
  createFVertexs(device);

const pipeline = createRenderPipeline(
  vertex,
  fragment,
  device,
  format,
  description,
  {
    primitive: {
      cullMode: "front",
    },
    depthStencil: {
      depthWriteEnabled: true,
      depthCompare: "less",
      format: "depth24plus",
    },
  }
);

const uniformBufferSize = (4 + 4 * 4) * 4;
const colorOffset = 0;
const maxtrixOffset = 4;
const uniformBuffer = device.createBuffer({
  size: uniformBufferSize,
  usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
});
const uniformValues = new Float32Array(uniformBufferSize / 4);

// 颜色数据
const colorValue = uniformValues.subarray(colorOffset, colorOffset + 4);
colorValue.set([rand(), rand(), rand(), 1]);

// MVP 矩阵
const orthoMatrix = mat4.ortho(0, width, height, 0, 1200, -1200);

const mvpMatrixValue = uniformValues.subarray(
  maxtrixOffset,
  maxtrixOffset + 16
);

const bindgroup = device.createBindGroup({
  layout: pipeline.getBindGroupLayout(0),
  entries: [{ binding: 0, resource: { buffer: uniformBuffer } }],
});

// gui
const gui = new GUI();
const settings = {
  translation: {
    x: 270,
    y: 240,
    z: -900,
  },
  rotation: {
    x: 40,
    y: 25,
    z: 325,
  },
  scale: {
    x: 3,
    y: 3,
    z: 3,
  },
  fieldOfView: 45,
  fudgeFactor: 0,
};

gui
  .add(settings.translation, "x", 0, 400, 1)
  .name("translation.x")
  .onChange(frame);
gui
  .add(settings.translation, "y", 0, 400, 1)
  .name("translation.y")
  .onChange(frame);
gui
  .add(settings.translation, "z", -1000, 1000, 1)
  .name("translation.z")
  .onChange(frame);
gui
  .add(settings.rotation, "x", -360, 360, 1)
  .name("rotation.x")
  .onChange(frame);
gui
  .add(settings.rotation, "y", -360, 360, 1)
  .name("rotation.y")
  .onChange(frame);
gui
  .add(settings.rotation, "z", -360, 360, 1)
  .name("rotation.z")
  .onChange(frame);

gui.add(settings.scale, "x", -5, 5, 0.1).name("scale.x").onChange(frame);
gui.add(settings.scale, "y", -5, 5, 0.1).name("scale.y").onChange(frame);
gui.add(settings.scale, "z", -5, 5, 0.1).name("scale.z").onChange(frame);

gui.add(settings, "fudgeFactor", 0, 30, 1).onChange(frame);
gui.add(settings, "fieldOfView", 5, 170, 0.1).onChange(frame);

let depthTexture: GPUTexture | null = null;

export function frame() {
  const commandEncoder = device.createCommandEncoder();
  const canvasTexture = ctx.getCurrentTexture();
  // If we don't have a depth texture OR if its size is different
  // from the canvasTexture when make a new depth texture
  if (
    !depthTexture ||
    depthTexture.width !== canvasTexture.width ||
    depthTexture.height !== canvasTexture.height
  ) {
    if (depthTexture) {
      depthTexture.destroy();
    }
    depthTexture = device.createTexture({
      size: [canvasTexture.width, canvasTexture.height],
      format: "depth24plus",
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });
  }
  const renderPipeline = commandEncoder.beginRenderPass({
    colorAttachments: [
      {
        storeOp: "store",
        loadOp: "clear",
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
  mat4.translate(
    modelMatrix,
    [settings.translation.x, settings.translation.y, settings.translation.z],
    modelMatrix
  );
  mat4.rotateX(modelMatrix, degToRad(settings.rotation.x), modelMatrix);
  mat4.rotateY(modelMatrix, degToRad(settings.rotation.y), modelMatrix);
  mat4.rotateZ(modelMatrix, degToRad(settings.rotation.z), modelMatrix);
  mat4.scale(
    modelMatrix,
    [settings.scale.x, settings.scale.y, settings.scale.z],
    modelMatrix
  );
  mat4.translate(modelMatrix, [-50, -75, -15], modelMatrix); // 设置几何中心
  const zMatrix = mat4.create(
    1,
    0,
    0,
    0,
    0,
    1,
    0,
    0,
    0,
    0,
    1,
    settings.fudgeFactor,
    0,
    0,
    0,
    1
  );
  const projectionMatrix = mat4.perspective(
    degToRad(settings.fieldOfView),
    width / height,
    1,
    2000
  );
  // const mvpMatrix = mat4.multiply(orthoMatrix, modelMatrix);
  // const mvpMatrix = mat4.multiply(
  //   zMatrix,
  //   mat4.multiply(orthoMatrix, modelMatrix) // 透视矩阵 = Z 缩放矩阵 * 正交矩阵
  // );
  const mvpMatrix = mat4.multiply(projectionMatrix, modelMatrix);
  mvpMatrixValue.set(mvpMatrix);
  // 写入 uniform
  device.queue.writeBuffer(uniformBuffer, 0, uniformValues);
  renderPipeline.setPipeline(pipeline);
  renderPipeline.setVertexBuffer(0, vertexBuffer);
  renderPipeline.setBindGroup(0, bindgroup);
  renderPipeline.draw(indexNums);
  renderPipeline.end();
  device.queue.submit([commandEncoder.finish()]);
}
