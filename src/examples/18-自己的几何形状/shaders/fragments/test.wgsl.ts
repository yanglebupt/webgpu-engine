import { InputBindGroupShaderCode } from "../../../../tools/postprocess/RenderPass";

export default () => /* wgsl */ `
${InputBindGroupShaderCode}

@fragment
fn main(@location(0) tc: vec2f) -> @location(0) vec4f {
  let col = textureSample(inputTexture, _sampler, tc);
  return vec4f(pow(col.rgb, vec3f(0.2)), col.a);
}
`;
