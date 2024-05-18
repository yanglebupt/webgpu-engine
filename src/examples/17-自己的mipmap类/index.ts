import { checkWebGPUSupported } from "../../tools";
import { HDRLoader } from "../../tools/loaders/HDRLoader";
import {
  StorageTextureToCanvas,
  createEmptyStorageTexture,
} from "../../tools/helper";
import { MipMap, maxMipLevelCount } from "../../tools/utils/mipmaps";

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

const { device } = await checkWebGPUSupported(
  {},
  { requiredFeatures: ["float32-filterable"] }
);
const format: GPUTextureFormat = "rgba32float";
// hdr 贴图
const envTexture = device.createTexture({
  format,
  mipLevelCount: maxMipLevelCount(width, height),
  size: [width, height],
  usage:
    GPUTextureUsage.TEXTURE_BINDING |
    GPUTextureUsage.STORAGE_BINDING |
    GPUTextureUsage.COPY_DST |
    GPUTextureUsage.COPY_SRC,
});
device.queue.writeTexture(
  { texture: envTexture },
  color,
  { bytesPerRow: width * 16 },
  { width, height }
);
////////////////提取 mipmap 后的贴图/////////////////
const mipLevels = [6, 8];
const envMipmapTexture = createEmptyStorageTexture(device, format, [
  width,
  height,
  mipLevels.length,
]);

export function frame() {
  const commandEncoder = device.createCommandEncoder();
  const computePass = commandEncoder.beginComputePass();
  const mipmap = new MipMap(device, computePass);
  mipmap.generateMipmaps(envTexture);
  mipmap.extractMipmap(envTexture, {
    texture: envMipmapTexture,
    mipLevels,
  });
  computePass.end();
  const sc = new StorageTextureToCanvas(device, commandEncoder);
  sc.render(envMipmapTexture, {
    dimension: "2d",
    baseArrayLayer: 1,
    arrayLayerCount: 1,
  });
  device.queue.submit([commandEncoder.finish()]);
}
