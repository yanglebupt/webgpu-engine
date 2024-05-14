import { createTextureFromSource } from "webgpu-utils";
import {
  checkWebGPUSupported,
  createComputePipeline,
} from "../../tools/index.ts";
import row_avg from "./row-avg.wgsl.ts";
import pdf from "./pdf.wgsl.ts";
import inverse_cdf from "./inverse_cdf.wgsl.ts";
import { HDRLoader } from "../../tools/loaders/HDRLoader/index.ts";
import {
  StorageTextureToCanvas,
  createEmptyStorageTexture,
} from "../../tools/helper.ts";

// 加载 HDR 图片
const base = location.href;
const hdr_filename = `${base}image_imageBlaubeurenNight1k.hdr`;
const hdrLoader = new HDRLoader();
const { color, avg_gray, width, height } = await hdrLoader.load<Float32Array>(
  hdr_filename,
  {
    sRGB: false,
    returnGray: false,
  }
);

const { device } = await checkWebGPUSupported();
const format: GPUTextureFormat = "rgba32float";
const envTexture = createTextureFromSource(
  device,
  { data: color, width, height },
  {
    mips: false,
    usage:
      GPUTextureUsage.TEXTURE_BINDING |
      GPUTextureUsage.STORAGE_BINDING |
      GPUTextureUsage.COPY_SRC,
    format,
  }
);

// 计算边缘概率
const row_pipeline = createComputePipeline(row_avg(format, avg_gray), device);
const row_avg_texture = createEmptyStorageTexture(device, format, [1, height]);
const margin_pdf_texture = createEmptyStorageTexture(device, format, [
  1,
  height,
]);
const row_bindGroup = device.createBindGroup({
  layout: row_pipeline.getBindGroupLayout(0),
  entries: [
    { binding: 0, resource: envTexture.createView() },
    { binding: 1, resource: row_avg_texture.createView() },
    { binding: 2, resource: margin_pdf_texture.createView() },
  ],
});

// 计算联合概率和条件概率
const pdf_pipeline = createComputePipeline(pdf(format, avg_gray), device);
const joint_pdf_texture = createEmptyStorageTexture(device, format, [
  width,
  height,
]);
const condition_pdf_texture = createEmptyStorageTexture(device, format, [
  width,
  height,
]);
const pdf_bindGroup = device.createBindGroup({
  layout: pdf_pipeline.getBindGroupLayout(0),
  entries: [
    { binding: 0, resource: envTexture.createView() },
    { binding: 1, resource: row_avg_texture.createView() },

    { binding: 2, resource: joint_pdf_texture.createView() },
    { binding: 3, resource: condition_pdf_texture.createView() },
  ],
});

// 计算逆 CDF

const inverse_cdf_pipeline = createComputePipeline(inverse_cdf(format), device);
const inverse_margin_cdf_texture = createEmptyStorageTexture(device, format, [
  1,
  height,
]);
const inverse_condition_cdf_texture = createEmptyStorageTexture(
  device,
  format,
  [width, height]
);
const inverse_cdf_bindGroup = device.createBindGroup({
  layout: inverse_cdf_pipeline.getBindGroupLayout(0),
  entries: [
    { binding: 0, resource: margin_pdf_texture.createView() },
    { binding: 1, resource: condition_pdf_texture.createView() },
    { binding: 2, resource: inverse_margin_cdf_texture.createView() },
    { binding: 3, resource: inverse_condition_cdf_texture.createView() },
  ],
});

export async function frame() {
  const encoder = device.createCommandEncoder();
  const computePass = encoder.beginComputePass();

  computePass.setPipeline(row_pipeline);
  computePass.setBindGroup(0, row_bindGroup);
  computePass.dispatchWorkgroups(height);

  computePass.setPipeline(pdf_pipeline);
  computePass.setBindGroup(0, pdf_bindGroup);
  computePass.dispatchWorkgroups(width, height);

  computePass.setPipeline(inverse_cdf_pipeline);
  computePass.setBindGroup(0, inverse_cdf_bindGroup);
  computePass.dispatchWorkgroups(width, height);

  computePass.end();

  const s2c = new StorageTextureToCanvas(device, encoder);

  s2c.render(inverse_condition_cdf_texture, {});

  const commandBuffer = encoder.finish();
  device.queue.submit([commandBuffer]);
}
