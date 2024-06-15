import { InputBindGroupShaderCode } from "../../../../tools/postprocess/ComputePass";
import { ShaderContext } from "../../../../tools/shaders";
import { axis } from "../../../../tools/utils/Dispatch";

interface ShaderContextParams {
  format: GPUTextureFormat;
  chunkSize: number[];
  order: number[];
}

export default (context: ShaderContext<ShaderContextParams>) => {
  const { format, chunkSize, order } = context;
  const [width_idx, height_idx] = order;
  const xy = `${axis[width_idx]}${axis[height_idx]}`;
  return /* wgsl */ `
${InputBindGroupShaderCode(format)}

@compute @workgroup_size(${chunkSize.join(",")})
fn main(@builtin(global_invocation_id) id: vec3u) {
  let pixel = id.${xy};
  let col = textureLoad(inputTexture, pixel, 0u);
  textureStore(outputTexture, pixel, vec4f(pow(col.rgb, vec3f(0.2)), col.a));
}
`;
};
