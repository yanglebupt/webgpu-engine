/**
 * 监听对象属性的改变
 */
export type ObservableActionParams = {
  propertyKey: PropertyKey;
  newValue: any;
  oldValue: any;
  payload: any;
};
export type ObservableAction = (p: ObservableActionParams) => void;
export interface Observable {
  watch: PropertyKey[] | { [key: PropertyKey]: any };
  onChange?: ObservableAction;
}

/**
 * Proxy构造函数不能继承，原因在于Proxy上没有prototype原型属性
 * 手动添加上prototype属性则可以继承
 */

Proxy.prototype = Object;
export interface ObservableProxyOptions {
  deep: boolean;
}
// @ts-ignore
export class ObservableProxy<T extends Observable> extends Proxy<T> {
  constructor(
    object: T,
    action?: ObservableAction,
    options?: Partial<ObservableProxyOptions>
  ) {
    super(object, {
      set(target, p, newValue, receiver) {
        const oldValue = Reflect.get(target, p, receiver);
        // @ts-ignore
        const flag = Reflect.set(...arguments);
        const watchDescriptor = object.watch;
        let changed = false;
        let payload;
        if (oldValue !== newValue) {
          if (Array.isArray(watchDescriptor)) {
            changed = watchDescriptor.includes(p);
          } else {
            changed = Object.hasOwn(watchDescriptor, p);
            payload = watchDescriptor[p];
          }
        }
        if (changed) {
          const params = {
            propertyKey: p,
            newValue,
            oldValue,
            payload,
          };
          object.onChange && object.onChange(params);
          action && action(params);
        }
        return flag;
      },
    });
  }
}
