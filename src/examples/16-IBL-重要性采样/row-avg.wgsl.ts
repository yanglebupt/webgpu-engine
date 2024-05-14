import { rgb2gray } from "../../tools/shaders/utils";

export default (format: string, avg: number) => /* wgsl */ `
@group(0) @binding(0) var envMap: texture_storage_2d<${format}, read>;
@group(0) @binding(1) var rowAvgMap: texture_storage_2d<${format}, write>;
@group(0) @binding(2) var marginPDFMap: texture_storage_2d<${format}, write>;

${rgb2gray}

@compute @workgroup_size(1)
fn main(@builtin(workgroup_id) id: vec3u){
  let y = id.x;
  let width = textureDimensions(envMap).x;
  var sum = 0.0;
  for(var x=0u; x<width; x++){
    sum += rgb2gray(textureLoad(envMap, vec2u(x, y)).rgb);
  }
  sum /= f32(width);
  textureStore(rowAvgMap, vec2u(0u, y), vec4f(sum,sum,sum,1.0));

  let pdf = sum / ${avg};
  textureStore(marginPDFMap, vec2u(0u, y), vec4f(pdf,pdf,pdf,1.0));
}
`;
