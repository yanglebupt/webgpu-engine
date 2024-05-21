import { GUI } from "dat.gui";
import { CreateCanvasReturn, checkWebGPUSupported } from "../../tools";
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

const settings = {
  compute: false,
  roughness_index: 0,
};

const gui = new GUI();
gui.add(settings, "roughness_index", 0, 3, 1).onChange(frame);
let canvasReturn: CreateCanvasReturn;

export function frame() {
  const commandEncoder = device.createCommandEncoder();
  if (!settings.compute) {
    const computePass = commandEncoder.beginComputePass();
    envMap.compute(computePass);
    computePass.end();
  }
  const sc = new StorageTextureToCanvas(device, commandEncoder);
  canvasReturn = sc.render(
    envMap.specularTexure,
    {
      dimension: "2d",
      baseArrayLayer: settings.roughness_index,
      arrayLayerCount: 1,
    },
    {},
    { canvasReturn }
  );
  if (!settings.compute) sc.render(envMap.diffuseTexure, {});
  device.queue.submit([commandEncoder.finish()]);
  settings.compute = true;
}
