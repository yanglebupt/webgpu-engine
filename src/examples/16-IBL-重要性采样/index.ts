import { checkWebGPUSupported } from "../../tools";
import { StorageTextureToCanvas } from "../../tools/helper";
import { EnvMapLoader } from "../../tools/utils/envmap";
import { getSizeForMipFromTexture } from "../../tools/utils/mipmaps";
import { StaticTextureUtil } from "../../tools/utils/StaticTextureUtil";
import {
  GPUSamplerCache,
  SolidColorTextureCache,
} from "../../tools/scene/cache";

// 加载 HDR 图片
const base = location.href;
const hdr_filename = `${base}image_imageBlaubeurenNight1k.hdr`;
const { device } = await checkWebGPUSupported();
const envMap = await new EnvMapLoader().load(hdr_filename);
envMap.build({
  device,
  format: StaticTextureUtil.renderFormat,
  depthFormat: StaticTextureUtil.depthFormat,
  //@ts-ignore
  scene: null,
  cached: {
    sampler: new GPUSamplerCache(device),
    solidColorTexture: new SolidColorTextureCache(device),
  },
});

const settings = {
  compute: false,
};

export function frame() {
  const commandEncoder = device.createCommandEncoder();
  if (!settings.compute) {
    const computePass = commandEncoder.beginComputePass();
    envMap.compute(computePass, device);
    computePass.end();
  }
  {
    const sc = new StorageTextureToCanvas(device, commandEncoder);
    const size = [envMap.specularTexure.width, envMap.specularTexure.height];
    sc.render(envMap.diffuseTexure, {});
    for (
      let baseMipLevel = 0;
      baseMipLevel < envMap.specularTexure.mipLevelCount;
      baseMipLevel++
    ) {
      const s = getSizeForMipFromTexture(size, baseMipLevel);
      sc.render(
        envMap.specularTexure,
        {
          baseMipLevel,
          mipLevelCount: 1,
        },
        { width: s[0], height: s[1] }
      );
    }
  }
  device.queue.submit([commandEncoder.finish()]);
  settings.compute = true;
}
