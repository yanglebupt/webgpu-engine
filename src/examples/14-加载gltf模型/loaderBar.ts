import "./index.css";

// 轮询直到条件成立
export const waitUnitCondition = (gasp: number, conditionFn: () => boolean) =>
  new Promise((resolve) => {
    const id = setInterval(() => {
      if (conditionFn()) {
        clearInterval(id);
        resolve(true);
      }
    }, gasp);
  });

/* 默认控件 */
export class LoaderBarDomElement {
  static html = `
    <div class="bar-container">
      <div class="bar">
        <div class="progress"></div>
      </div>
      <div class="tip">dd</div>
    </div>
  `;
  root: HTMLElement;
  bar: HTMLElement;
  text: HTMLElement;
  canHidden: boolean = false;
  transitionDuration: number = 0.1;
  constructor(parent: HTMLElement) {
    this.root = document.createElement("div");
    this.root.className = "loading-bar";
    this.root.innerHTML = LoaderBarDomElement.html;
    (parent ?? document.body).appendChild(this.root);

    this.bar = document.querySelector(
      ".bar-container .progress"
    ) as HTMLElement;
    this.bar.style.setProperty(
      "transition-duration",
      `${this.transitionDuration}s`
    );
    this.text = document.querySelector(".bar-container .tip") as HTMLElement;
    // 修改监听
    const mob = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (
          mutation.type == "attributes" &&
          mutation.attributeName == "style"
        ) {
          if ((mutation.target as HTMLElement).style.width == "100%") {
            this.canHidden = true;
          }
        }
      });
    });
    mob.observe(this.bar, {
      attributes: true,
    });
  }

  setPercentage(percentage: number, name?: string, url?: string) {
    this.bar.style.setProperty("width", `${percentage * 100}%`);
    this.text.textContent = `${name}: ${percentage * 100}%`;
  }

  showLoading() {
    this.root.classList.toggle("show");
  }

  async hiddenLoading() {
    /* 需要在页面更新后隐藏 */
    this.nextTick(() => this.root.classList.toggle("show"));
  }

  /* 需要在页面更新后回调 */
  async nextTick(callback: () => void) {
    await waitUnitCondition(10, () => this.canHidden);
    setTimeout(callback, (this.transitionDuration + 0.1) * 1000);
  }
}
