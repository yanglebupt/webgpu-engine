import { Iter } from "../common";
import { isEqual } from "lodash-es";
import { StaticTextureUtil } from "../utils/StaticTextureUtil";
import { Logger } from "../helper";
/**
 * 使用 lodash.isEqual 来深度比较两个对象是否一样
 */
export abstract class ObjectStringKeyCache<O extends object, V> {
  abstract create(key: O): V;
  abstract _default: O;
  private cached: Map<string, V> = new Map<string, V>();
  constructor(public device: GPUDevice) {}
  get(key: O): V {
    const k = Iter.filter(this.cached.keys(), (k) =>
      isEqual(JSON.parse(k), key)
    );
    if (k.length == 0) {
      // 新建然后插入，返回
      const value = this.create(key);
      this.cached.set(JSON.stringify(key), value);
      return value;
    } else if (k.length == 1) {
      Logger.log("get from cache");
      return this.cached.get(k[0])!;
    } else {
      throw new Error("The key is duplicated");
    }
  }
  clear() {
    this.cached.clear();
  }
  delete(key: O): boolean {
    return this.cached.delete(JSON.stringify(key));
  }
  get default(): V {
    return this.get(this._default);
  }
}
export class GPUSamplerCache extends ObjectStringKeyCache<
  GPUSamplerDescriptor,
  GPUSampler
> {
  _default: GPUSamplerDescriptor = {
    addressModeU: "repeat",
    addressModeV: "repeat",
    minFilter: "linear",
    magFilter: "linear",
    mipmapFilter: "linear",
  };
  create(key: GPUSamplerDescriptor) {
    Logger.log(`create sampler: ${JSON.stringify(key)}`);
    return this.device.createSampler(key);
  }
}

export type SolidColorTextureType =
  | "opaqueWhiteTexture"
  | "transparentBlackTexture"
  | "defaultNormalTexture";
export type SolidColorTextureCacheKey = {
  format: GPUTextureFormat;
  type: SolidColorTextureType;
};
export const SolidColor: Record<SolidColorTextureType, number[]> = {
  opaqueWhiteTexture: [1, 1, 1, 1],
  transparentBlackTexture: [0, 0, 0, 0],
  defaultNormalTexture: [0.5, 0.5, 1, 1],
};
export class SolidColorTextureCache extends ObjectStringKeyCache<
  SolidColorTextureCacheKey,
  GPUTexture
> {
  _default: SolidColorTextureCacheKey = {
    format: StaticTextureUtil.renderFormat.split("-")[0] as GPUTextureFormat,
    type: "transparentBlackTexture",
  };
  create({ format, type }: SolidColorTextureCacheKey): GPUTexture {
    Logger.log("creat texture", format, type);
    const data = new Uint8Array(SolidColor[type].map((v) => v * 255));
    const texture = this.device.createTexture({
      size: [1, 1],
      format: format,
      usage:
        GPUTextureUsage.TEXTURE_BINDING |
        GPUTextureUsage.COPY_DST |
        GPUTextureUsage.RENDER_ATTACHMENT,
    });
    this.device.queue.writeTexture(
      { texture: texture },
      data,
      {},
      { width: 1, height: 1 }
    );
    return texture;
  }
}
