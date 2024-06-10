// modify from https://github.com/mrdoob/three.js/blob/master/src/core/Clock.js

export class Clock {
  startTime: number = 0;
  elapsedTime: number = 0;
  oldTime: number = 0;
  running: boolean = false;
  constructor(public autoStart = true) {}

  start() {
    // 重新开始一个计时
    this.startTime = now();
    this.oldTime = this.startTime;
    this.elapsedTime = 0;
    this.running = true;
  }

  stop() {
    // 停止后，需要手动 start
    this.running = false;
    this.autoStart = false;
    this.elapsedTime;
  }

  get deltaTime() {
    // 先判断是否存在上一次时间，不存在则需要开始，返回 0
    if (this.autoStart && !this.running) {
      this.start();
      return 0;
    }
    let diff = 0;
    if (this.running) {
      const newTime = now();
      diff = (newTime - this.oldTime) / 1000;
      this.oldTime = newTime;
      this.elapsedTime += diff;
    }
    return diff;
  }

  get time() {
    this.deltaTime;
    return this.elapsedTime;
  }
}

function now() {
  return (typeof performance === "undefined" ? Date : performance).now();
}
