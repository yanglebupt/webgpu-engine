import {
  checkWebGPUSupported,
  createCanvas,
  createRenderPipeline,
} from "../../tools";
import vertex from "./shaders/vertex.wgsl?raw";
import fragment from "./shaders/fragment.wgsl?raw";
import "./index.css";
import { createFVertexs } from "./data";
import { degToRad, rand, xyzObj2Array } from "../../tools/math";
import { Mat4, mat3, mat4 } from "wgpu-matrix";
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
      cullMode: "back",
    },
    depthStencil: {
      depthWriteEnabled: true,
      depthCompare: "less",
      format: "depth24plus",
    },
  }
);

const numFs = 5 * 5 + 1;
const uniformBufferSize = 4 * (4 * 4) * numFs;
const uniformBuffer = device.createBuffer({
  size: uniformBufferSize,
  usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
});
const uniformValues = new Float32Array(uniformBufferSize / 4);
const bindgroup = device.createBindGroup({
  layout: pipeline.getBindGroupLayout(0),
  entries: [{ binding: 0, resource: { buffer: uniformBuffer } }],
});

const radius = 200;
const across = 5;
const deep = 5;

const gui = new GUI();
const settings = {
  fieldOfView: 72,
  cameraAngle: 0,
  target: {
    x: 300,
    y: 200,
    z: 0,
  },
  targetAngle: 0,
};

gui.add(settings, "fieldOfView", 5, 170, 0.1).onChange(frame);
gui.add(settings, "cameraAngle", -360, 360, 0.1).onChange(frame);
gui.add(settings, "targetAngle", -360, 360, 0.1).onChange(frame);
gui
  .add(settings.target, "y", -500, 500, 0.1)
  .name("targetHeight")
  .onChange(frame);

let depthTexture: GPUTexture | null = null;

export function frame() {
  settings.target.x = Math.cos(degToRad(settings.targetAngle)) * radius;
  settings.target.z = Math.sin(degToRad(settings.targetAngle)) * radius;

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
  renderPipeline.setPipeline(pipeline);
  renderPipeline.setVertexBuffer(0, vertexBuffer);

  ////////// View Matrix /////////
  const cameraMatrix = mat4.rotationY(degToRad(settings.cameraAngle));
  mat4.translate(cameraMatrix, [0, 500, radius * 5], cameraMatrix);
  // const viewMatrix = mat4.inverse(cameraMatrix);
  const eye = cameraMatrix.slice(12, 15);
  const viewMatrix = mat4.lookAt(eye, [0, 0, 0], [0, 1, 0]);
  /////////////////////////////////

  ////////// Projection  Matrix /////////
  const projectionMatrix = mat4.perspective(
    degToRad(settings.fieldOfView),
    width / height,
    1,
    2000
  );
  /////////////////////////////////

  ////////// Instance Model Matrix /////////
  for (let i = 0; i < numFs; i++) {
    let modelMatrix = null;
    if (i < 25) {
      // 其余 F
      // compute grid positions
      const gridX = i % across;
      const gridZ = (i / across) | 0;

      // compute 0 to 1 positions
      const u = gridX / (across - 1);
      const v = gridZ / (deep - 1);

      // center and spread out
      const x = (u - 0.5) * across * 150;
      const z = (v - 0.5) * deep * 150;

      // aim this F from it's position toward the target F
      modelMatrix = mat4.aim(
        [x, 0, z],
        xyzObj2Array(settings.target),
        [0, 1, 0]
      );
    } else {
      // 目标 F
      modelMatrix = mat4.translation(xyzObj2Array(settings.target));
    }
    /////////////// 组合得到 MVP Matrix //////////////////
    const mvpMatrix = mat4.multiply(
      projectionMatrix,
      mat4.multiply(viewMatrix, modelMatrix)
    );
    uniformValues.subarray(i * 16, (i + 1) * 16).set(mvpMatrix);
  }
  //////////////////////////////////////////

  device.queue.writeBuffer(uniformBuffer, 0, uniformValues);
  renderPipeline.setBindGroup(0, bindgroup);
  renderPipeline.draw(indexNums, numFs);
  renderPipeline.end();
  device.queue.submit([commandEncoder.finish()]);
}
