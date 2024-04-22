import { checkWebGPUSupported, createComputePipeline } from "../../tools";
import { drawImageBitmap, drawHistogram } from "../../tools/display";
import { createTextureFromImage, loadImageBitmap } from "../../tools/loader";
import { calcHistogram } from "./histogram";
import "./index.css";
import compute from "./shader/01-仅使用workgroup/compute.wgsl";

const bins = 256;
const { img, width, height } = await loadImageBitmap(
  "/pexels-francesco-ungaro-96938-mid.jpg"
);
/////////////// JS 来计算灰度直方图 ////////////////
const histogram = calcHistogram(img, bins);
///////////////////////////////////////////////////
drawImageBitmap(img, { parentId: "app", className: "ori-img" });
drawHistogram(histogram, width * height, {
  width: bins,
  height: 100,
  parentId: "app",
  className: "js-his-img",
});

const { device } = await checkWebGPUSupported();
const pipeline = createComputePipeline(compute(), device);
const texture = await createTextureFromImage(
  device,
  "/pexels-francesco-ungaro-96938-mid.jpg"
);
const histogramBuffer = device.createBuffer({
  size: bins * 4,
  usage: GPUBufferUsage.COPY_SRC | GPUBufferUsage.STORAGE,
});
const resultBuffer = device.createBuffer({
  size: bins * 4,
  usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
});

const bindGroup = device.createBindGroup({
  layout: pipeline.getBindGroupLayout(0),
  entries: [
    { binding: 0, resource: { buffer: histogramBuffer } },
    { binding: 1, resource: texture.createView() },
  ],
});

export async function frame() {
  const encoder = device.createCommandEncoder();
  const pass = encoder.beginComputePass();
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.dispatchWorkgroups(width, height);
  pass.end();
  encoder.copyBufferToBuffer(
    histogramBuffer,
    0,
    resultBuffer,
    0,
    resultBuffer.size
  );
  device.queue.submit([encoder.finish()]);

  await resultBuffer.mapAsync(GPUMapMode.READ);
  const hist = new Uint32Array(
    resultBuffer.getMappedRange(0, resultBuffer.size)
  );

  drawHistogram(hist, width * height, {
    width: bins,
    height: 100,
    parentId: "app",
    className: "compute-shader-his-img",
  });
}
