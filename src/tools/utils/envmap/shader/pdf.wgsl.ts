import { rgb2gray } from "../../../../tools/shaders/utils";

export default (
  format: string,
  avg: number,
  chunkSize: number[]
) => /* wgsl */ `
@group(0) @binding(0) var envMap: texture_storage_2d<${format}, read>;
@group(0) @binding(1) var rowAvgMap: texture_storage_2d<${format}, read>;
@group(0) @binding(2) var pdfMap: texture_storage_2d<${format}, write>;

${rgb2gray}

@compute @workgroup_size(${chunkSize.join(",")})
fn main(
  @builtin(global_invocation_id) id: vec3u
){
  let pos = id.xy;
  let row_avg = textureLoad(rowAvgMap, vec2u(0u, pos.y)).r;
  let gray = rgb2gray(textureLoad(envMap, pos).rgb);
  let joint_pdf = gray / ${avg};
  let condition_pdf = gray / row_avg;
  let margin_pdf = row_avg / ${avg};
  textureStore(pdfMap, pos, vec4f(joint_pdf,condition_pdf,margin_pdf,1.0));
}
`;
