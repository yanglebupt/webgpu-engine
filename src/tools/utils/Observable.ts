/**
 * 监听对象属性的改变
 */
export type ObservableAction = (
  propertyKey: PropertyKey,
  newValue?: any,
  oldValue?: any
) => void;
export interface Observable {
  watch: PropertyKey[];
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
        if (object.watch.includes(p) && oldValue !== newValue) {
          object.onChange && object.onChange(p, newValue, oldValue);
          action && action(p, newValue, oldValue);
        }
        return flag;
      },
    });
  }
}
