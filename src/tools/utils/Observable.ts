/**
 * 监听对象属性的改变
 */
export type ObservableActionParams = {
  propertyKey: PropertyKey;
  newValue: any;
  oldValue: any;
  payload?: any;
};
export type ObservableAction = (p: ObservableActionParams) => void;
export type WatchPropertyKey = PropertyKey[] | { [key: PropertyKey]: any };
export interface Observable {
  onChange(p: ObservableActionParams): void;
}

/**
 * Proxy构造函数不能继承，原因在于Proxy上没有prototype原型属性
 * 手动添加上prototype属性则可以继承
 */

Proxy.prototype = Object;
export interface ObservableProxyOptions {
  deep?: boolean;
  watch?: PropertyKey[];
  exclude?: PropertyKey[];
}
// @ts-ignore
export class ObservableProxy<T extends Observable> extends Proxy<T> {
  constructor(
    object: T,
    reactions?: Array<{ action: ObservableAction; watch?: WatchPropertyKey }>,
    options?: ObservableProxyOptions
  ) {
    const { watch, exclude } = options ?? {};
    super(object, {
      get(target, p, receiver) {
        if (p === "__raw") return target;
        // @ts-ignore
        else return Reflect.get(...arguments);
      },
      set(target, p, newValue, receiver) {
        const oldValue = Reflect.get(target, p, receiver);
        // @ts-ignore
        const flag = Reflect.set(...arguments);
        const changed = oldValue !== newValue;
        if (!changed) return flag;
        if (reactions)
          reactions.forEach(({ action, watch }) => {
            let needCall = false;
            const params: ObservableActionParams = {
              propertyKey: p,
              newValue,
              oldValue,
            };

            if (watch === undefined) {
              // 默认监听全部属性
              action(params);
            } else {
              if (Array.isArray(watch)) {
                needCall = watch.includes(p);
              } else {
                needCall = Object.hasOwn(watch, p);
                params.payload = watch[p];
              }
              if (needCall) action(params);
            }
          });

        if (watch?.includes(p) || !exclude?.includes(p))
          object.onChange({
            propertyKey: p,
            newValue,
            oldValue,
          });
        return flag;
      },
    });
  }
}
