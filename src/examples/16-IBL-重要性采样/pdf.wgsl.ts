import { rgb2gray } from "../../tools/shaders/utils";

export default (format: string, avg: number) => /* wgsl */ `
@group(0) @binding(0) var envMap: texture_storage_2d<${format}, read>;
@group(0) @binding(1) var rowAvgMap: texture_storage_2d<${format}, read>;

@group(0) @binding(2) var jointPDFMap: texture_storage_2d<${format}, write>;
@group(0) @binding(3) var conditionPDFMap: texture_storage_2d<${format}, write>;

${rgb2gray}

@compute @workgroup_size(1)
fn main(@builtin(workgroup_id) id: vec3u){
  let pos = id.xy;
  let gray = rgb2gray(textureLoad(envMap, pos).rgb);
  let joint_pdf = gray / ${avg};
  let condition_pdf = gray / textureLoad(rowAvgMap, vec2u(0u, pos.y)).r;
  textureStore(jointPDFMap, pos, vec4f(joint_pdf,joint_pdf,joint_pdf,1.0));
  textureStore(conditionPDFMap, pos, vec4f(condition_pdf,condition_pdf,condition_pdf,1.0));
}
`;
