import { Iter } from "../common";
import { isEqual } from "lodash-es";
import { StaticTextureUtil } from "../utils/StaticTextureUtil";
import { RawMap, RawWeakMap, getProperty } from "../utils/ProxyRaw";

/**
 * 可访问属性和最终的类型
 */
export const ValidProperties: (string | symbol)[] = [
  "device",
  "_default",
  "create",
  "get",
  "clear",
  "delete",
  "default",
  "getSuper",
];
export interface CacheInterface<O, V> {
  _default: O;
  create(key: O): V;
  get(key: O): V;
  clear(): void;
  delete(key: O): boolean;
  get default(): V;
}

export class CacheProxy<O extends object, V> extends Proxy<
  CacheInterface<O, V>
> {
  constructor(cache: CacheInterface<O, V>) {
    super(cache, {
      get: (target, p, receiver) => {
        if (p === "__v_raw") return target;
        else if (ValidProperties.includes(p)) {
          return getProperty(target, p, receiver);
        } else {
          throw new Error(`Invalid property name: ${String(p)}`);
        }
      },
    });
  }
}

export abstract class WeakCache<K extends WeakKey, V> extends RawWeakMap<
  K,
  V
> {}
export abstract class Cache<O, K, V> extends RawMap<K, V> {}

/**
 * ObjectStringKeyCache 类：确保规范使用查询对象，使用 lodash.isEqual 来深度比较两个对象是否一样
 */
export abstract class ObjectStringKeyCache<O extends object, V>
  extends Cache<O, string, V>
  implements CacheInterface<O, V>
{
  abstract _default: O;
  abstract create(key: O): V;
  // @ts-ignore
  get(key: O): V {
    if (typeof key === "string")
      throw new Error("string key is not supported, please use object");
    console.log(this);
    const { target, proto } = this.getSuper();
    const k = Iter.filter(proto.keys.call(target), (k) =>
      isEqual(JSON.parse(k), key)
    );
    if (k.length == 0) {
      // 新建然后插入，返回
      const value = this.create(key);
      proto.set.call(target, JSON.stringify(key), value);
      return value;
    } else if (k.length == 1) {
      console.log("get from cached");
      return proto.get.call(target, k[0])!;
    } else {
      throw new Error("The key is duplicated");
    }
  }
  // @ts-ignore
  delete(key: O): boolean {
    if (typeof key === "string")
      throw new Error("string key is not supported, please use object");
    const { target, proto } = this.getSuper();
    return proto.delete.call(target, JSON.stringify(key));
  }
  clear() {
    const { target, proto } = this.getSuper();
    proto.clear.call(target);
  }
  get default(): V {
    return this.get(this._default);
  }
}

export type GPUSamplerCacheType = CacheInterface<
  GPUSamplerDescriptor,
  GPUSampler
>;
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
  // 不允许用户手动 new
  protected constructor(public device: GPUDevice) {
    super();
  }
  // 工厂创建
  static neww(device: GPUDevice) {
    return new CacheProxy(new GPUSamplerCache(device));
  }
  create(key: GPUSamplerDescriptor) {
    console.log(`create sampler ${key}`);
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
export type SolidColorTextureCacheType = CacheInterface<
  SolidColorTextureCacheKey,
  GPUTexture
>;
export class SolidColorTextureCache extends ObjectStringKeyCache<
  SolidColorTextureCacheKey,
  GPUTexture
> {
  _default: SolidColorTextureCacheKey = {
    format: StaticTextureUtil.renderFormat.split("-")[0] as GPUTextureFormat,
    type: "transparentBlackTexture",
  };
  // 不允许用户手动 new
  protected constructor(public device: GPUDevice) {
    super();
  }
  // 工厂创建
  static neww(device: GPUDevice) {
    return new CacheProxy(new SolidColorTextureCache(device));
  }
  create({ format, type }: SolidColorTextureCacheKey): GPUTexture {
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
