import { StructuredView } from "webgpu-utils";
import { Updatable } from "../scene/types";

export abstract class ResourceBuffer implements Updatable {
  abstract type: GPUBufferBindingType;
  abstract usage: GPUBufferUsageFlags;
  abstract bufferView: StructuredView;
  buffer!: GPUBuffer;

  constructor(public name: string, public value: Record<string, any>) {}

  upload(device: GPUDevice) {
    if (!this.bufferView)
      throw new Error("Can not upload buffer without bufferView");
    this.buffer = device.createBuffer({
      size: this.bufferView.arrayBuffer.byteLength,
      usage: this.usage,
    });
  }

  update(device: GPUDevice) {
    this.bufferView.set(this.value);
    if (!this.buffer) return;
    device.queue.writeBuffer(this.buffer, 0, this.bufferView.arrayBuffer);
  }
}

export class Uniform extends ResourceBuffer {
  bufferView!: StructuredView;
  type: GPUBufferBindingType = "uniform";
  usage: GPUBufferUsageFlags = GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST;
}

export class Storage extends ResourceBuffer {
  bufferView!: StructuredView;
  _type: GPUBufferBindingType = "storage";
  readonly: boolean = false;
  usage: GPUBufferUsageFlags = GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST;

  get type(): GPUBufferBindingType {
    return this.readonly ? "read-only-storage" : "storage";
  }
}
