export default class RollingAverage {
  private total: number = 0;
  private samples: number[] = [];
  private cursor: number = 0;
  constructor(private numSamples: number = 30) {}

  addSampler(v: number) {
    this.total += v - (this.samples[this.cursor] || 0);
    this.samples[this.cursor] = v;
    this.cursor = (this.cursor + 1) % this.numSamples;
  }

  get value() {
    return this.total / this.samples.length;
  }
}
