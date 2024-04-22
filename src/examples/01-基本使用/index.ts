import {
  checkWebGPUSupported,
  createCanvas,
  createRenderPipeline,
} from "../../tools";
import vertex from "./shaders/vert.wgsl?raw";
import fragment from "./shaders/frag.wgsl?raw";

const { device, format } = await checkWebGPUSupported();
const { ctx } = createCanvas(
  500,
  500,
  {
    device,
    format,
    alphaMode: "opaque",
  },
  "app"
);
const renderPipeline = createRenderPipeline(vertex, fragment, device, format);

export function frame() {
  // 创建指令编码来执行管道
  const commandEncoder = device.createCommandEncoder();
  const renderPass = commandEncoder.beginRenderPass({
    colorAttachments: [
      {
        clearValue: { r: 0, g: 0, b: 0, a: 1 },
        loadOp: "clear",
        storeOp: "store",
        view: ctx.getCurrentTexture().createView(),
      },
    ],
  });
  renderPass.setPipeline(renderPipeline);
  renderPass.draw(3);
  renderPass.end();
  // 编码结束，提交命令
  device.queue.submit([commandEncoder.finish()]);
  requestAnimationFrame(frame);
}
