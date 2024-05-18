import { createTextureFromSource } from "webgpu-utils";
import {
  checkWebGPUSupported,
  createComputePipeline,
} from "../../tools/index.ts";
import pdf from "./pdf.wgsl.ts";
import inverse_cdf from "./inverse_cdf.wgsl.ts";
import IBL_IS from "./ibl-is.wgsl.ts";
import { HDRLoader } from "../../tools/loaders/HDRLoader/index.ts";
import {
  StorageTextureToCanvas,
  createEmptyStorageTexture,
} from "../../tools/helper.ts";
import {
  dispatch,
  dispatchImageAndSampler,
} from "../../tools/utils/Dispatch.ts";

// 加载 HDR 图片
const base = location.href;
const hdr_filename = `${base}image_imageBlaubeurenNight1k.hdr`;
const hdrLoader = new HDRLoader();
const { color, avg_gray, width, height, row_avg } =
  await hdrLoader.load<Float32Array>(hdr_filename, {
    sRGB: false,
    returnRowAvgGray: true,
  });

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
const rowAvgTexture = createTextureFromSource(
  device,
  { data: row_avg, width: 1, height },
  {
    mips: false,
    usage:
      GPUTextureUsage.TEXTURE_BINDING |
      GPUTextureUsage.STORAGE_BINDING |
      GPUTextureUsage.COPY_SRC,
    format,
  }
);

const maxComputeWorkgroupLimits = [
  device.limits.maxComputeWorkgroupSizeX,
  device.limits.maxComputeWorkgroupSizeY,
  device.limits.maxComputeWorkgroupSizeZ,
];
const maxComputeInvocationsPerWorkgroup =
  device.limits.maxComputeInvocationsPerWorkgroup;
// 根据 device 的最大限制计算分块, chunk 并行计算
let { chunkSize, dispatchSize } = dispatch(
  [width, height],
  maxComputeWorkgroupLimits,
  maxComputeInvocationsPerWorkgroup
);

console.log(
  `chunk size: ${chunkSize}, maxComputeInvocationsPerWorkgroup: ${maxComputeInvocationsPerWorkgroup}`
);

// 计算联合概率、边缘概率、条件概率
const pdf_pipeline = createComputePipeline(
  pdf(format, avg_gray, chunkSize),
  device
);
/*
  pdfTexture: 合并 texture 来减少资源开销
  [r] 代表 joint pdf  [g] 代表 condition pdf [b] 代表 margin pdf，因为是一维的，只有第一列有效
*/
const pdfTexture = createEmptyStorageTexture(device, format, [width, height]);
const pdf_bindGroup = device.createBindGroup({
  layout: pdf_pipeline.getBindGroupLayout(0),
  entries: [
    { binding: 0, resource: envTexture.createView() },
    { binding: 1, resource: rowAvgTexture.createView() },
    { binding: 2, resource: pdfTexture.createView() },
  ],
});

// 计算逆 CDF
const inverse_cdf_pipeline = createComputePipeline(
  inverse_cdf(format, chunkSize),
  device
);
/*
  inverseCDFTexture: 由于 rgba32float 不支持 read_write，无法覆盖前面的 pdfTexture，因此只能再新建一个
  [r] 代表 joint pdf  [g] 代表 condition inverse cdf [b] 代表 margin inverse cdf，因为是一维的，只有第一列有效
*/
const inverseCDFTexture = createEmptyStorageTexture(device, format, [
  width,
  height,
]);
const inverse_cdf_bindGroup = device.createBindGroup({
  layout: inverse_cdf_pipeline.getBindGroupLayout(0),
  entries: [
    { binding: 0, resource: pdfTexture.createView() },
    { binding: 1, resource: inverseCDFTexture.createView() },
  ],
});

// IBL-IS
const samplers = 100;
const {
  chunkSize: chunkSize_sample,
  dispatchSize: dispatch_sample,
  sampler_idx,
  width_idx,
  height_idx,
} = dispatchImageAndSampler(
  [width, height],
  samplers,
  maxComputeWorkgroupLimits,
  maxComputeInvocationsPerWorkgroup
);
console.log(
  `sample chunk size: ${chunkSize_sample}, sample dispatch size: ${dispatch_sample}`
);
const IBL_IS_pipeline = createComputePipeline(
  IBL_IS(
    format,
    chunkSize_sample,
    sampler_idx,
    dispatch_sample[sampler_idx],
    width_idx,
    height_idx
  ),
  device
);
const diffuseTexture = createEmptyStorageTexture(device, format, [
  width,
  height,
]);
const IBL_IS_bindGroup = device.createBindGroup({
  layout: IBL_IS_pipeline.getBindGroupLayout(0),
  entries: [
    { binding: 0, resource: envTexture.createView() },
    { binding: 1, resource: inverseCDFTexture.createView() },
    { binding: 2, resource: diffuseTexture.createView() },
  ],
});

const setting = {
  inverseCDF: true,
};

export async function frame() {
  const encoder = device.createCommandEncoder();
  const computePass = encoder.beginComputePass();
  if (setting.inverseCDF) {
    // 只需要计算一次
    computePass.setPipeline(pdf_pipeline);
    computePass.setBindGroup(0, pdf_bindGroup);
    computePass.dispatchWorkgroups(dispatchSize[0], dispatchSize[1]);
    computePass.setPipeline(inverse_cdf_pipeline);
    computePass.setBindGroup(0, inverse_cdf_bindGroup);
    computePass.dispatchWorkgroups(dispatchSize[0], dispatchSize[1]);
    setting.inverseCDF = false;
  }
  computePass.setPipeline(IBL_IS_pipeline);
  computePass.setBindGroup(0, IBL_IS_bindGroup);
  computePass.dispatchWorkgroups(1, dispatch_sample[1], dispatch_sample[2]);
  computePass.end();
  const s2c = new StorageTextureToCanvas(device, encoder);
  const canvas = s2c.render(diffuseTexture, {});
  const commandBuffer = encoder.finish();
  device.queue.submit([commandBuffer]);
}
