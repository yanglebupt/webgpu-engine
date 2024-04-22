import RollingAverage from "./RollingAverage";

export class GPUTimeHelper {
  canTimestamp: boolean;
  private querySet: GPUQuerySet;
  private resolveBuffer: GPUBuffer;
  private resultBuffer: GPUBuffer;
  timestampWrites: { timestampWrites: GPURenderPassTimestampWrites };
  gpuTime: number = 0;
  constructor(device: GPUDevice) {
    this.canTimestamp = device.features.has("timestamp-query");
    if (!this.canTimestamp) {
      throw new Error("timestamp-query for GPU time is not supported");
    }
    this.querySet = device.createQuerySet({
      type: "timestamp",
      count: 2,
    });
    this.resolveBuffer = device.createBuffer({
      size: this.querySet.count * 8,
      usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC,
    });
    this.timestampWrites = {
      timestampWrites: {
        querySet: this.querySet,
        beginningOfPassWriteIndex: 0,
        endOfPassWriteIndex: 1,
      },
    };
    this.resultBuffer = device.createBuffer({
      size: this.resolveBuffer.size,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });
  }

  end(commandEncoder: GPUCommandEncoder) {
    if (this.canTimestamp) {
      commandEncoder.resolveQuerySet(
        this.querySet,
        0,
        this.querySet.count,
        this.resolveBuffer,
        0
      );
      if (this.resolveBuffer.mapState === "unmapped") {
        commandEncoder.copyBufferToBuffer(
          this.resolveBuffer,
          0,
          this.resultBuffer,
          0,
          this.resultBuffer.size
        );
      }
    }
  }

  async finish() {
    if (this.canTimestamp && this.resultBuffer.mapState === "unmapped") {
      await this.resultBuffer.mapAsync(GPUMapMode.READ);
      const times = new BigInt64Array(this.resultBuffer.getMappedRange());
      this.gpuTime = Number(times[1] - times[0]) / 1000;
      this.resultBuffer.unmap();
    }
  }
}

export interface TimeConfig {
  fps: number;
  jsTime: number;
  gpuTime: number;
}
export default class TimeHelper {
  static css = `
    #TimeHelper {
      position: absolute;
      top: 0;
      left: 0;
      margin: 0;
      padding: 1em;
      background-color: rgba(0, 0, 0, 0.8);
      color: white;
    }
  `;

  static TimeConfigNames: string[] = ["fps", "jsTime", "gpuTime"];

  static {
    document.styleSheets[0].insertRule(TimeHelper.css, 0);
  }

  elapsedTime = 0;
  deltaTime = 0;
  fps = 0;
  jsTime = 0;
  gpuTime = -1;
  private infoElem: HTMLPreElement;
  private timeConfigMap: Map<string, RollingAverage> = new Map<
    string,
    RollingAverage
  >();
  private jsTimeStart = 0;
  private gpuTimeHelper: GPUTimeHelper | null = null;

  constructor(devide: GPUDevice, numSamples: number = 30) {
    this.infoElem = document.createElement("pre");
    this.infoElem.id = "TimeHelper";
    document.body.appendChild(this.infoElem);
    TimeHelper.TimeConfigNames.forEach((configName) =>
      this.timeConfigMap.set(configName, new RollingAverage(numSamples))
    );

    try {
      this.gpuTimeHelper = new GPUTimeHelper(devide);
    } catch (error) {
      this.gpuTimeHelper = null;
      console.warn(
        "device feature `timestamp-query` for GPU time is not supported. Please check if you request this feature when adapter.requestDevice"
      );
    }
  }

  record(now: number) {
    now *= 1e-3;
    this.deltaTime = now - this.elapsedTime;
    this.elapsedTime = now;
    this.jsTimeStart = performance.now();
    this.timeConfigMap.get("fps")?.addSampler(1 / this.deltaTime);
  }

  end(commandEncoder: GPUCommandEncoder) {
    this.gpuTimeHelper?.end(commandEncoder);
  }

  async finish(fractionDigits: number = 1) {
    this.timeConfigMap
      .get("jsTime")
      ?.addSampler(performance.now() - this.jsTimeStart);

    this.fps = this.timeConfigMap.get("fps")?.value || 0;
    this.jsTime = this.timeConfigMap.get("jsTime")?.value || 0;

    if (this.gpuTimeHelper) {
      await this.gpuTimeHelper.finish();
      this.timeConfigMap.get("gpuTime")?.addSampler(this.gpuTimeHelper.gpuTime);
      this.gpuTime = this.timeConfigMap.get("gpuTime")?.value || -1;
    }

    this.infoElem.textContent = `fps: ${this.fps.toFixed(fractionDigits)}
js: ${this.jsTime.toFixed(fractionDigits)}ms
gpu: ${this.gpuTime > 0 ? `${this.gpuTime.toFixed(fractionDigits)}µs` : "N/A"}`;
  }

  get timestampWrites() {
    return this.gpuTimeHelper?.timestampWrites || {};
  }
}
