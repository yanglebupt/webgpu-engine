import { checkWebGPUSupported, createCanvas } from "../../tools";
import computeCode from "./compute.wgsl?raw";

const { device, format } = await checkWebGPUSupported();
createCanvas(500, 500, {
  device,
  format,
});

export async function frame() {
  const computePipeline = device.createComputePipeline({
    layout: "auto",
    compute: {
      module: device.createShaderModule({
        code: computeCode,
      }),
      entryPoint: "main",
    },
  });
  const inputData = new Float32Array([1, 2, 3]);
  const inputBuffer = device.createBuffer({
    size: inputData.byteLength,
    usage:
      GPUBufferUsage.STORAGE |
      GPUBufferUsage.COPY_SRC |
      GPUBufferUsage.COPY_DST,
  });
  const outputBuffer = device.createBuffer({
    size: inputData.byteLength,
    usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(inputBuffer, 0, inputData);
  const bindGroup = device.createBindGroup({
    layout: computePipeline.getBindGroupLayout(0),
    entries: [{ binding: 0, resource: { buffer: inputBuffer } }],
  });
  const commandEncoder = device.createCommandEncoder();
  const computePass = commandEncoder.beginComputePass();
  computePass.setPipeline(computePipeline);
  computePass.setBindGroup(0, bindGroup);
  computePass.dispatchWorkgroups(inputData.length);
  computePass.end();
  commandEncoder.copyBufferToBuffer(
    inputBuffer,
    0,
    outputBuffer,
    0,
    outputBuffer.size
  );
  device.queue.submit([commandEncoder.finish()]);

  // 注意 map 要在 submit 之后
  await outputBuffer.mapAsync(GPUMapMode.READ);
  const result = new Float32Array(outputBuffer.getMappedRange());
  console.log("input", inputData);
  console.log("output", result);
  outputBuffer.unmap();
}
