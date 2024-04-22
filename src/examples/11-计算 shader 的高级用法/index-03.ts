import { checkWebGPUSupported, createComputePipeline } from "../../tools";
import { drawImageBitmap, drawHistogram } from "../../tools/display";
import { createTextureFromImage, loadImageBitmap } from "../../tools/loader";
import { calcHistogram } from "./histogram";
import "./index.css";
import {
  chunk_compute_shader,
  summary_compute_shader_2,
} from "./shader/02-使用chunks/compute.wgsl";
import { arrayProd } from "../../tools/math";

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
const chunkSize = [16, 16]; // 最高限制是 256，因此 bins=256，所以最优只能取 256 了，如果 chunkSize<256，[chunkSize,256) 部分只能是串行
const dispatchCount = [
  Math.ceil(width / chunkSize[0]),
  Math.ceil(height / chunkSize[1]),
];
const chunk_compute_pipeline = createComputePipeline(
  chunk_compute_shader(bins, chunkSize),
  device
);
const summary_compute_pipeline = createComputePipeline(
  summary_compute_shader_2(bins),
  device
);
const texture = await createTextureFromImage(
  device,
  "/pexels-francesco-ungaro-96938-mid.jpg"
);
const chunksBuffer = device.createBuffer({
  size: arrayProd(dispatchCount) * bins * 4,
  usage: GPUBufferUsage.COPY_SRC | GPUBufferUsage.STORAGE,
});
const resultBuffer = device.createBuffer({
  size: bins * 4,
  usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
});

const chunk_compute_bindGroup = device.createBindGroup({
  layout: chunk_compute_pipeline.getBindGroupLayout(0),
  entries: [
    { binding: 0, resource: { buffer: chunksBuffer } },
    { binding: 1, resource: texture.createView() },
  ],
});

const numStrides = Math.ceil(Math.log2(arrayProd(dispatchCount)));
const summary_compute_bindGroup_list: {
  bindGroup: GPUBindGroup;
  numDispatchs: number;
}[] = [];
for (let i = 0; i < numStrides; i++) {
  const stride = 2 ** i;
  const numDispatchs = Math.ceil(arrayProd(dispatchCount) / 2 ** (i + 1));
  const uniformBuffer = device.createBuffer({
    size: 4,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM,
  });
  device.queue.writeBuffer(uniformBuffer, 0, new Uint32Array([stride]));
  const summary_compute_bindGroup = device.createBindGroup({
    layout: summary_compute_pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: chunksBuffer } },
      { binding: 1, resource: { buffer: uniformBuffer } },
    ],
  });
  summary_compute_bindGroup_list.push({
    bindGroup: summary_compute_bindGroup,
    numDispatchs,
  });
}

export async function frame() {
  const encoder = device.createCommandEncoder();
  const pass = encoder.beginComputePass();
  pass.setPipeline(chunk_compute_pipeline);
  pass.setBindGroup(0, chunk_compute_bindGroup);
  pass.dispatchWorkgroups(dispatchCount[0], dispatchCount[1]);

  pass.setPipeline(summary_compute_pipeline);
  summary_compute_bindGroup_list.forEach(({ bindGroup, numDispatchs }) => {
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(numDispatchs);
  });

  pass.end();

  encoder.copyBufferToBuffer(
    chunksBuffer,
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
