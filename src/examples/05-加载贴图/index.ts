import {
  checkWebGPUSupported,
  createCanvas,
  createRenderPipeline,
} from "../../tools";
import vertex from "./shader/vertex.wgsl?raw";
import fragment from "./shader/fragment.wgsl?raw";
import { GUI } from "dat.gui";
import {
  createTextureFromImage,
  createTextureFromSource,
} from "../../tools/loader";
import {
  createAnimCanvas,
  createVideo,
  startPlayingAndWaitForVideo,
} from "./texture";

const { device, format } = await checkWebGPUSupported();
const { ctx } = createCanvas(500, 500, {
  device,
  format,
});

const renderPipeline = createRenderPipeline(vertex, fragment, device, format);

// 外部图片贴图
const urls = [
  "/f-texture.png",
  "/coins.jpg",
  "Granite_paving_tileable_512x512.jpeg",
];
const texture_list: GPUTexture[] = await Promise.all(
  urls.map(
    async (url) => await createTextureFromImage(device, url, { mips: true })
  )
);

// canvas 贴图
const { canvas: aniCanvas, update } = createAnimCanvas();

// video 贴图
const { video } = createVideo(
  "/Golden_retriever_swimming_the_doggy_paddle-360-no-audio.webm"
);

// dat.gui
const gui = new GUI();
const texture_type = {
  image_url: "/f-texture.png",
  useCanvas: false,
  useVideo: false,
};
gui.add(texture_type, "image_url", urls).onChange(frame);
gui.add(texture_type, "useCanvas").onChange(frame);
gui.add(texture_type, "useVideo").onChange(frame);

function getTexture(type: typeof texture_type) {
  if (type.useCanvas) {
    // 从 canvas 的每一帧创建 texture，从而形成动画贴图，显然这种方式很低效
    return createTextureFromSource(device, aniCanvas, {
      mips: true,
    });
  } else if (type.useVideo) {
    // 从 video 的每一帧创建 texture，从而形成动画贴图，显然这种方式很低效
    return createTextureFromSource(device, video, {
      mips: true,
    });
  } else {
    return texture_list[urls.indexOf(texture_type.image_url)];
  }
}

export async function frame(time: number) {
  if (texture_type.useCanvas) update(time);
  if (texture_type.useVideo) await startPlayingAndWaitForVideo(video);
  if (texture_type.useCanvas || !texture_type.useVideo) video.pause();
  // 创建采样器
  const sampler = device.createSampler();
  const groupBind = device.createBindGroup({
    layout: renderPipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: sampler },
      {
        binding: 1,
        resource: getTexture(texture_type).createView(),
      },
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
  requestAnimationFrame(frame);
}
