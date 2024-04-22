import { checkWebGPUSupported, createComputePipeline } from "../../tools";
import {
  createTextureFromSource,
  createVideo,
  startPlayingAndWaitForVideo,
  waitForClick,
} from "../../tools/loader";
import "./index.css";
import {
  chunk_compute_shader,
  summary_compute_shader_2,
} from "./shader/02-使用chunks/compute.wgsl";
import { arrayProd } from "../../tools/math";
import { drawHistogramWebGPURender } from "./drawHistogram";

const bins = 256;
const { video, width, height } = await createVideo(
  "/pexels-kosmo-politeska-5750980 (1080p).mp4"
);
await waitForClick();
await startPlayingAndWaitForVideo(video);

const { device, format } = await checkWebGPUSupported();
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
const chunksBuffer = device.createBuffer({
  size: arrayProd(dispatchCount) * bins * 4 * 4,
  usage: GPUBufferUsage.COPY_SRC | GPUBufferUsage.STORAGE,
});
const resultBuffer = device.createBuffer({
  size: bins * 4 * 4,
  usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
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

document.body.insertBefore(video, document.body.firstChild);
video.addEventListener("click", () => {
  if (video.paused) {
    video.play();
    requestAnimationFrame(frame);
  } else {
    video.pause();
  }
});

let leftCanvas: HTMLCanvasElement;
let rightCanvas: HTMLCanvasElement;

export async function frame() {
  const texture = createTextureFromSource(device, video);
  const chunk_compute_bindGroup = device.createBindGroup({
    layout: chunk_compute_pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: chunksBuffer } },
      { binding: 1, resource: texture.createView() },
    ],
  });
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
  leftCanvas = drawHistogramWebGPURender(
    hist,
    width * height,
    { device, format },
    {
      width: bins,
      height: 100,
      parentId: "app",
      className: "compute-shader-his-img",
      channel: [0, 1, 2],
      clearColor: { r: 0.3, g: 0.3, b: 0.3, a: 1 },
      canvas: leftCanvas,
    }
  );
  rightCanvas = drawHistogramWebGPURender(
    hist,
    width * height,
    { device, format },
    {
      width: bins,
      height: 100,
      parentId: "app",
      className: "compute-shader-his-img",
      channel: [3],
      clearColor: { r: 0.3, g: 0.3, b: 0.3, a: 1 },
      canvas: rightCanvas,
    }
  );
  resultBuffer.unmap();
  if (!video.paused) requestAnimationFrame(frame);
}
