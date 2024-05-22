import { Iter } from "../common";
import { isEqual } from "lodash-es";
import { StaticTextureUtil } from "../utils/StaticTextureUtil";
/**
 * Cache 类：确保对象完整性，也就是默认值要补充上，使用 lodash.isEqual 来深度比较两个对象是否一样
 */
export abstract class WeakCache<K extends WeakKey, V> extends WeakMap<K, V> {}
export interface Cache<O, K, V> {}
export abstract class Cache<O, K, V> {
  abstract cached: Map<K, V>;
  abstract create(key: O): V;
}
export abstract class ObjectStringKeyCache<O extends object, V> extends Cache<
  O,
  string,
  V
> {
  abstract _default: O;
  cached: Map<string, V> = new Map<string, V>();
  constructor(public device: GPUDevice) {
    super();
  }
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
    return this.device.createSampler(key);
  }
}

export type SolidColorTextureType =
  | "opaqueWhiteTexture"
  | "transparentBlackTexture"
  | "defaultNormalTexture";
export const SolidColor: Record<SolidColorTextureType, number[]> = {
  opaqueWhiteTexture: [1, 1, 1, 1],
  transparentBlackTexture: [0, 0, 0, 0],
  defaultNormalTexture: [0.5, 0.5, 1, 1],
};
export class SolidColorTextureCache extends ObjectStringKeyCache<
  { format: GPUTextureFormat; type: SolidColorTextureType },
  GPUTexture
> {
  _default: { format: GPUTextureFormat; type: SolidColorTextureType } = {
    format: StaticTextureUtil.renderFormat.split("-")[0] as GPUTextureFormat,
    type: "transparentBlackTexture",
  };
  create({
    format,
    type,
  }: {
    format: GPUTextureFormat;
    type: SolidColorTextureType;
  }): GPUTexture {
    console.log("creat texture", format, type);
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
