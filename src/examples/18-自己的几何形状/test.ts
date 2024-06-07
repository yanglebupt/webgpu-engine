class Parent {
  constructor(public son: Son) {}
  change(propertyKey: PropertyKey) {
    console.log(propertyKey, "changed");
  }
}
class Son {
  name: string = "Son";
}

const p = new Parent(new Son());
// 监听 p 中 son 对象中的属性改变，然后由上一层 p.change 响应该改变，有什么好办法吗？
p.son.name = "Mike";
