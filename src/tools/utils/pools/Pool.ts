export abstract class Pool<T> {
  private items: T[] = [];
  get length() {
    return this.items.length;
  }
  abstract create(): T;
  pop() {
    let res = this.items.pop();
    if (!res) res = this.create();
    return res;
  }
  push(t: T) {
    if (this.items.includes(t)) return;
    this.items.push(t);
  }
}
