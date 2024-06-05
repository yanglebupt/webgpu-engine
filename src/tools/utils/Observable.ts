/**
 * 监听对象属性的改变
 */

export interface Observable {
  watch: PropertyKey[];
  onChange(propertyKey: PropertyKey): void;
}

/**
 * Proxy构造函数不能继承，原因在于Proxy上没有prototype原型属性
 * 手动添加上prototype属性则可以继承
 */

Proxy.prototype = Object;
// @ts-ignore
export class ObservableProxy<T extends Observable> extends Proxy<T> {
  constructor(object: T, deep: boolean = false) {
    super(object, {
      set(target, p, newValue, receiver) {
        const oldValue = Reflect.get(target, p, receiver);
        // @ts-ignore
        const flag = Reflect.set(...arguments);
        if (object.watch.includes(p) && oldValue !== newValue) {
          object.onChange(p);
        }
        return flag;
      },
    });
  }
}
