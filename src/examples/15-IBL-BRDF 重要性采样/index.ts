import {
  checkWebGPUSupported,
  createCanvas,
  createRenderPipeline,
  createTextureFromSourceCPUMipmaps,
} from "../../tools";
import vertex from "./shader/vertex.wgsl?raw";
import fragment from "./shader/fragment.wgsl?raw";
import { HDRLoader } from "../../tools/loaders/HDRLoader";
import {
  createTextureFromSource,
  makeShaderDataDefinitions,
  makeStructuredView,
} from "webgpu-utils";
import { GUI } from "dat.gui";

// 加载 HDR 图片
const base = location.href;
const hdr_filename = `${base}image_imageBlaubeurenNight1k.hdr`;
const hdrLoader = new HDRLoader();
const { img, width, height } = await hdrLoader.load<ImageData>(hdr_filename, {
  returnBitmap: true,
  sRGB: true,
});

const { device, format } = await checkWebGPUSupported();
const { ctx } = createCanvas(width, height, {
  device,
  format,
  alphaMode: "opaque",
  colorSpace: "display-p3",
});
const preferredFormat = format.split("-")[0];

// hdr srgb 贴图
const envTexture = createTextureFromSource(device, img, {
  mips: true,
  flipY: true,
  format: `${preferredFormat}-srgb` as GPUTextureFormat,
  colorSpace: "srgb",
});

const sampler = device.createSampler({});

// uniform values
const defs = makeShaderDataDefinitions(fragment);
const uniformView = makeStructuredView(defs.uniforms["uniforms"]);
const uniformBuffer = device.createBuffer({
  size: uniformView.arrayBuffer.byteLength,
  usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM,
});
const setting = {
  mipmapLevel: 0,
  samplers: 10,
};
const gui = new GUI();
gui.add(setting, "mipmapLevel", 0, 10, 1).onChange(frame);
gui.add(setting, "samplers", 128, 4096).onChange(frame);

const renderPipeline = createRenderPipeline(vertex, fragment, device, format);

const groupBind = device.createBindGroup({
  layout: renderPipeline.getBindGroupLayout(0),
  entries: [
    { binding: 0, resource: sampler },
    { binding: 1, resource: envTexture.createView() },
    { binding: 2, resource: { buffer: uniformBuffer } },
  ],
});

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
  renderPass.setBindGroup(0, groupBind);
  renderPass.draw(3);
  renderPass.end();
  device.queue.submit([commandEncoder.finish()]);
}
