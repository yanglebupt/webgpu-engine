import { getChunkInfo } from "../../../../tools/postprocess/ComputePass";
import { ShaderCode } from "../../../../tools/shaders";

const TestFragment: ShaderCode = {
  DataDefinition: /*wgsl*/ `
struct UniformData {
  li:f32,
};
@group(0) @binding(2) var<uniform> uni: UniformData;
@group(0) @binding(3) var tex: texture_2d<f32>;`,

  code(context: any) {
    const { chunk_size, wh } = getChunkInfo(context);
    return /* wgsl */ `
${this.DataDefinition}
@compute @workgroup_size(${chunk_size})
fn main(@builtin(global_invocation_id) id: vec3u) {
  let pixel = id.${wh};
  var col = textureLoad(inputTexture, pixel, 0u);
  let col2 = textureLoad(tex, pixel, 0u);
  col*=col2;
  textureStore(outputTexture, pixel, vec4f(pow(col.rgb, vec3f(uni.li)), col.a));
}`;
  },
};

export default TestFragment;
