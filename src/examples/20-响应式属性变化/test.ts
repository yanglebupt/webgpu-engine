// 批量更新 demo

const a = new Proxy(
  {
    __merging: true, // private
    name: "Mike",
    age: 10,
    update() {
      console.log("update", this);
    },
    batch_set(batch_fn: () => void) {
      this.__merging = true;
      batch_fn();
      this.__merging = false;
    },
  },
  {
    set(target, p) {
      //@ts-ignore
      const flag = Reflect.set(...arguments);
      if (!target.__merging) target.update();
      return flag;
    },
  }
);

a.batch_set(() => {
  a.name += "*";
  a.age += 1;
});
