Proxy.prototype = Object;

export function getProperty<T extends object>(
  target: T,
  p: string | symbol,
  receiver: any
) {
  const v = Reflect.get(target, p, receiver);
  if (typeof v === "function") (v as Function).bind(target);
  return v;
}

export interface Raw<R> {
  __v_raw: any;
}

export class Raw<R> {
  protected getSuper(layer: number = 3) {
    const target = this.__v_raw;
    let proto = target;
    for (let i = 0; i < layer; i++) {
      proto = Reflect.getPrototypeOf(proto);
    }
    return { target, proto: proto as R };
  }
}

export function applyMixins(derivedCtor: any, constructors: any[]) {
  constructors.forEach((baseCtor) => {
    Object.getOwnPropertyNames(baseCtor.prototype).forEach((name) => {
      Object.defineProperty(
        derivedCtor.prototype,
        name,
        Object.getOwnPropertyDescriptor(baseCtor.prototype, name) ||
          Object.create(null)
      );
    });
  });
}

export interface RawMap<K, V> extends Raw<Map<K, V>> {}
export class RawMap<K, V> extends Map<K, V> {}
applyMixins(RawMap, [Raw]);

export interface RawWeakMap<K extends WeakKey, V> extends Raw<WeakMap<K, V>> {}
export class RawWeakMap<K extends WeakKey, V> extends WeakMap<K, V> {}
applyMixins(RawWeakMap, [Raw]);
