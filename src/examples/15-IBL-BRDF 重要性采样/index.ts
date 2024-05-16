import {
  checkWebGPUSupported,
  createCanvas,
  createRenderPipeline,
} from "../../tools";
import fragment from "./fragment.wgsl?raw";
import vertex from "../../tools/shaders/vertex-wgsl/full-plane.wgsl";
import { HDRLoader } from "../../tools/loaders/HDRLoader";
import { makeShaderDataDefinitions, makeStructuredView } from "webgpu-utils";
import { GUI } from "dat.gui";
import { WebGPUSinglePassDownsampler, maxMipLevelCount } from "webgpu-spd";

const downsampler = new WebGPUSinglePassDownsampler();

// 加载 HDR 图片
const base = location.href;
const hdr_filename = `${base}image_imageBlaubeurenNight1k.hdr`;
const hdrLoader = new HDRLoader();
const { color, width, height } = await hdrLoader.load<Float32Array>(
  hdr_filename,
  {
    sRGB: false,
    uint8: false,
  }
);

const { device, format: preferredFormat } = await checkWebGPUSupported(
  {},
  { requiredFeatures: ["float32-filterable"] }
);
const { ctx } = createCanvas(width, height, {
  device,
  format: preferredFormat,
});

const format: GPUTextureFormat = "rgba32float";
// hdr 贴图
const envTexture = device.createTexture({
  format,
  mipLevelCount: maxMipLevelCount(width, height),
  size: [width, height],
  usage:
    GPUTextureUsage.TEXTURE_BINDING |
    GPUTextureUsage.STORAGE_BINDING |
    GPUTextureUsage.COPY_DST,
});
device.queue.writeTexture(
  { texture: envTexture },
  color,
  { bytesPerRow: width * 16 },
  { width, height }
);
downsampler.generateMipmaps(device, envTexture);

const sampler = device.createSampler({
  minFilter: "linear",
  magFilter: "linear",
  mipmapFilter: "nearest",
});

// uniform values
const defs = makeShaderDataDefinitions(fragment);
const uniformView = makeStructuredView(defs.uniforms["uniforms"]);
const uniformBuffer = device.createBuffer({
  size: uniformView.arrayBuffer.byteLength,
  usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM,
});
const setting = {
  mipmapLevel: 6,
  samplers: 1024,
};
const gui = new GUI();
gui.add(setting, "mipmapLevel", 0, 10, 1).onChange(frame);
gui.add(setting, "samplers", 1, 4096).onChange(frame);

const bindGroupLayout = device.createBindGroupLayout({
  entries: [
    {
      binding: 0,
      visibility: GPUShaderStage.FRAGMENT,
      sampler: { type: "filtering" },
    },
    {
      binding: 1,
      visibility: GPUShaderStage.FRAGMENT,
      texture: { sampleType: "float" },
    },
    {
      binding: 2,
      visibility: GPUShaderStage.FRAGMENT,
      buffer: { type: "uniform" },
    },
  ],
});
const bindGroup = device.createBindGroup({
  layout: bindGroupLayout,
  entries: [
    { binding: 0, resource: sampler },
    { binding: 1, resource: envTexture.createView() },
    { binding: 2, resource: { buffer: uniformBuffer } },
  ],
});

const renderPipeline = createRenderPipeline(
  vertex(true),
  fragment,
  device,
  preferredFormat,
  [null],
  {
    layout: device.createPipelineLayout({
      bindGroupLayouts: [bindGroupLayout],
    }),
  }
);

export function frame() {
  const commandEncoder = device.createCommandEncoder();
  const renderPass = commandEncoder.beginRenderPass({
    colorAttachments: [
      {
        storeOp: "store",
        loadOp: "clear",
        clearValue: { r: 0, g: 0, b: 0, a: 1 },
        view: ctx.getCurrentTexture().createView(),
      },
    ],
  });
  renderPass.setPipeline(renderPipeline);
  uniformView.set(setting);
  device.queue.writeBuffer(uniformBuffer, 0, uniformView.arrayBuffer);
  renderPass.setBindGroup(0, bindGroup);
  renderPass.draw(3);
  renderPass.end();
  device.queue.submit([commandEncoder.finish()]);
}
