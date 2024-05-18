import { checkWebGPUSupported } from "../../tools";
import { StorageTextureToCanvas } from "../../tools/helper";
import { EnvMapLoader } from "../../tools/utils/envmap";

// 加载 HDR 图片
const base = location.href;
const hdr_filename = `${base}image_imageBlaubeurenNight1k.hdr`;
const { device } = await checkWebGPUSupported(
  {},
  { requiredFeatures: ["float32-filterable"] }
);
const envMap = await new EnvMapLoader().load(device, hdr_filename);

export function frame() {
  const commandEncoder = device.createCommandEncoder();
  const computePass = commandEncoder.beginComputePass();

  envMap.compute(computePass);

  computePass.end();

  const sc = new StorageTextureToCanvas(device, commandEncoder);
  sc.render(envMap.diffuseTexure, {});
  sc.render(envMap.specularTexure, {});

  device.queue.submit([commandEncoder.finish()]);
}
