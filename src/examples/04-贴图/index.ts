import {
  checkWebGPUSupported,
  createCanvas,
  createMipMap,
  createRenderPipeline,
} from "../../tools";
import vertex from "./shader/vertex.wgsl?raw";
import fragment from "./shader/fragment.wgsl?raw";
import { GUI } from "dat.gui";

const { device, format } = await checkWebGPUSupported();
const { ctx } = createCanvas(
  { width: 500, height: 500 },
  { width: 4, height: 4 },
  {
    device,
    format,
  }
);

const renderPipeline = createRenderPipeline(vertex, fragment, device, format);
const textureWidth = 5,
  textureHeight = 7;
const _ = [255, 0, 0, 255]; // red
const y = [255, 255, 0, 255]; // yellow
const b = [0, 0, 255, 255]; // blue

// 创建材质颜色数组（2D图片）以及 MipMaps
const textureValues = new Uint8Array(
  [
    b,
    _,
    _,
    _,
    _,
    _,
    y,
    y,
    y,
    _,
    _,
    y,
    _,
    _,
    _,
    _,
    y,
    y,
    _,
    _,
    _,
    y,
    _,
    _,
    _,
    _,
    y,
    _,
    _,
    _,
    _,
    _,
    _,
    _,
    _,
  ].flat()
);
const mips = createMipMap(textureValues, textureWidth, textureHeight);
const texture = device.createTexture({
  size: [textureWidth, textureHeight],
  mipLevelCount: mips.length,
  format: "rgba8unorm",
  usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
});
mips.forEach(({ data, width, height }, mipLevel) => {
  device.queue.writeTexture(
    { texture, mipLevel },
    data,
    { bytesPerRow: 4 * width },
    [width, height]
  );
});

// dat.gui
const gui = new GUI();
const settings: GPUSamplerDescriptor = {
  addressModeU: "repeat",
  addressModeV: "repeat",
  magFilter: "nearest",
  minFilter: "nearest",
  mipmapFilter: "nearest",
};
gui
  .add(settings, "addressModeU", ["clamp-to-edge", "repeat", "mirror-repeat"])
  .onChange(frame);
gui
  .add(settings, "addressModeV", ["clamp-to-edge", "repeat", "mirror-repeat"])
  .onChange(frame);
gui.add(settings, "magFilter", ["nearest", "linear"]).onChange(frame);
gui.add(settings, "minFilter", ["nearest", "linear"]).onChange(frame);
gui.add(settings, "mipmapFilter", ["nearest", "linear"]).onChange(frame);

export function frame() {
  // 创建采样器
  const sampler = device.createSampler(settings);
  const groupBind = device.createBindGroup({
    layout: renderPipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: sampler },
      { binding: 1, resource: texture.createView() },
    ],
  });

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
  renderPass.setBindGroup(0, groupBind);
  renderPass.draw(6);
  renderPass.end();
  device.queue.submit([commandEncoder.finish()]);
}
