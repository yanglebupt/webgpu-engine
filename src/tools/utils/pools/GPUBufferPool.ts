import { Pool } from "./Pool";

export class GPUBufferPool extends Pool<GPUBuffer> {
  public device?: GPUDevice;
  public createCount: number = 0;
  private hasWarmUp = false;
  warmup(count: number) {
    if (this.hasWarmUp) return;
    for (let i = 0; i < count; i++) {
      this.push(this.create());
    }
    this.hasWarmUp = true;
  }
  create(): GPUBuffer {
    if (!this.device)
      throw new Error("must provide a device to create a GPU buffer");
    this.createCount++;
    return this.device.createBuffer({
      size: this.size,
      usage: GPUBufferUsage.COPY_SRC | GPUBufferUsage.MAP_WRITE,
      mappedAtCreation: true,
    });
  }
  constructor(public size: number) {
    super();
  }
}
