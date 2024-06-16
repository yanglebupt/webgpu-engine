import { ShaderCode } from "../../../../tools/shaders";

const TestFragment: ShaderCode = {
  DataDefinition: /* wgsl */ `
struct UniformData {
  li:f32,
};
@group(0) @binding(2) var<uniform> uni: UniformData;
@group(0) @binding(3) var tex: texture_2d<f32>;
`,
  code() {
    return /* wgsl */ `
@fragment
fn main(@location(0) tc: vec2f) -> @location(0) vec4f {
  var col = textureSample(inputTexture, _sampler, tc);
  let col2 = textureSample(tex,_sampler, tc);
  col *= col2;
  return vec4f(pow(col.rgb, vec3f(uni.li)), col.a);
}
`;
  },
};

export default TestFragment;
