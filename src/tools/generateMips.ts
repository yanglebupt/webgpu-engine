import { createRenderPipeline } from ".";

const vertex = /* wgsl */ `

struct VaryStruct{
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
}

@vertex
fn main(@builtin(vertex_index) vertexIndex: u32) -> VaryStruct {
  let pos = array<vec2f,6>(
    vec2f(0., 0.),
    vec2f(1., 0.),
    vec2f(0., 1.),
    vec2f(1., 0.),
    vec2f(0., 1.),
    vec2f(1., 1.),
  );
  let xy = pos[vertexIndex];
  var o: VaryStruct;
  o.position = vec4f(2.*xy-1., 0., 1.);
  o.uv = vec2f(xy.x, 1.-xy.y);
  return o;
}
`;

const fragment = /* wgsl */ `

@group(0) @binding(0) var ourSampler: sampler;
@group(0) @binding(1) var ourTexture: texture_2d<f32>;

@fragment
fn main(@location(0) uv: vec2f) -> @location(0) vec4f {
  return textureSample(ourTexture, ourSampler, uv);
}
`;

// 使用 GPU 以及 shader 来完成 MipMap 的生成
export function generateMips(device: GPUDevice, texture: GPUTexture) {
  const format = texture.format;
  const renderPipeline = createRenderPipeline(vertex, fragment, device, format);
  const sampler = device.createSampler({
    minFilter: "linear",
  });
  const commandEncoder = device.createCommandEncoder();
  // 开始循环，创建多个 renderPass
  const mipCount = texture.mipLevelCount;
  const layerCount = texture.depthOrArrayLayers;
  for (let i = 0; i < mipCount - 1; i++) {
    for (let j = 0; j < layerCount; j++) {
      const groupBind = device.createBindGroup({
        layout: renderPipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: sampler },
          {
            binding: 1,
            resource: texture.createView({
              dimension: "2d",
              baseArrayLayer: j,
              arrayLayerCount: 1,
              baseMipLevel: i,
              mipLevelCount: 1,
            }),
          },
        ],
      });
      const renderPass = commandEncoder.beginRenderPass({
        colorAttachments: [
          {
            storeOp: "store",
            view: texture.createView({
              dimension: "2d",
              baseArrayLayer: j,
              arrayLayerCount: 1,
              baseMipLevel: i + 1,
              mipLevelCount: 1,
            }),
            loadOp: "clear",
          },
        ],
      });
      renderPass.setPipeline(renderPipeline);
      renderPass.setBindGroup(0, groupBind);
      renderPass.draw(6);
      renderPass.end();
    }
  }
  device.queue.submit([commandEncoder.finish()]);
}
