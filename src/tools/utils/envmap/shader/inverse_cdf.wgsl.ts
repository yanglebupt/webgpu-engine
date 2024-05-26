import { textureUV } from "../../../../tools/shaders/utils";

export default (format: string, chunkSize: number[]) => /* wgsl */ `
@group(0) @binding(0) var pdfMap: texture_storage_2d<${format}, read>;
// inverseCDFMap 存在 invocation 直接的写竞争
@group(0) @binding(1) var inverseCDFMap: texture_storage_2d<${format}, write>;

fn calc_inverse_margin_CDF(pos: vec2u, tc: vec2f, height: u32) -> f32 {
  var sum = 0.0;
  let u = tc.y;
  var y: u32;
  for(y=0u; y<height; y++){
    let p = textureLoad(pdfMap, vec2u(0u, y)).b;
    sum += p / f32(height);
    if(sum>=u){
      break;
    }
  }
  let cdfInv = pixel2tex(f32(y), height);
  return cdfInv;
}

fn calc_inverse_condition_CDF(pos: vec2u, tc: vec2f, width: u32) -> f32 {
  var sum = 0.0;
  let u = tc.x;
  var x: u32;
  for(x=0u; x<width; x++){
    let p = textureLoad(pdfMap, vec2u(x, pos.y)).g;
    sum += p / f32(width);
    if(sum>=u){
      break;
    }
  }
  let cdfInv = pixel2tex(f32(x), width);
  return cdfInv;
}

${textureUV}

@compute @workgroup_size(${chunkSize.join(",")})
fn main(
  @builtin(global_invocation_id) id: vec3u
){
  let pos = id.xy;
  let size = textureDimensions(pdfMap);
  let tc = textureUV(pos, size);
  let width = size.x;
  let height = size.y;

  let joint_pdf = textureLoad(pdfMap, pos).r;
  let margin_cdfInv = calc_inverse_margin_CDF(pos, tc, height);
  let condition_cdfInv = calc_inverse_condition_CDF(pos, tc, width);
  textureStore(inverseCDFMap, pos, vec4f(joint_pdf,condition_cdfInv,margin_cdfInv,1.0));
}
`;
