export type KeyFnPair<T> = {
  [P in keyof T]?: EventFunc | EventFunc[];
};
export type EventKey = keyof DocumentEventMap;
export type EventFunc = (evt: Event) => void;

export class Input {
  constructor(
    public pairs: KeyFnPair<DocumentEventMap>,
    public target: HTMLElement = document.body
  ) {}

  public targetAt(target: HTMLElement) {
    this.target = target;
    return this;
  }

  public listen() {
    this.addAllEventListener();
    return this;
  }

  private addAllEventListener() {
    Object.keys(this.pairs).forEach((key) => {
      const fns = this.pairs[key as EventKey];
      if (!!fns) {
        this.setEventListener(key as EventKey, fns);
      }
    });
  }

  private setEventListener(key: EventKey, fns: EventFunc | EventFunc[]) {
    const multFn = Array.isArray(fns);
    if (multFn)
      fns.forEach((fn) => {
        this.target.addEventListener(key, fn);
      });
    else this.target.addEventListener(key, fns);
    return multFn;
  }

  addEventListener(key: EventKey, fns: EventFunc | EventFunc[]) {
    const multFn = this.setEventListener(key, fns);
    let existed_fns = Reflect.get(this.target, key);
    if (!existed_fns) {
      existed_fns = [];
      Reflect.set(this.target, key, existed_fns);
    }
    multFn ? existed_fns.push(...fns) : existed_fns.push(fns);
  }

  removeEventListener(key: EventKey) {
    const fns = this.pairs[key as EventKey];
    if (!!fns) {
      if (Array.isArray(fns))
        fns.forEach((fn) => {
          this.target.removeEventListener(key, fn);
        });
      else this.target.removeEventListener(key, fns);
    }
  }

  removeAllEventListener() {
    Object.keys(this.pairs).forEach((key) =>
      this.removeEventListener(key as EventKey)
    );
  }
}
