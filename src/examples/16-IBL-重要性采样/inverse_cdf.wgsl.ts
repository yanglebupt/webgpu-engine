import { textureUV } from "../../tools/shaders/utils";

export default (format: string) => /* wgsl */ `
@group(0) @binding(0) var marginPDFMap: texture_storage_2d<${format}, read>;
@group(0) @binding(1) var conditionPDFMap: texture_storage_2d<${format}, read>;

@group(0) @binding(2) var inverseMarginCDFMap: texture_storage_2d<${format}, write>;
@group(0) @binding(3) var inverseConditionCDFMap: texture_storage_2d<${format}, write>;

fn calc_inverse_margin_CDF(pos: vec2u, tc: vec2f, height: u32){
  var sum = 0.0;
  var u = tc.y;
  var y: u32;
  for(y=0u; y<height; y++){
    let p = textureLoad(marginPDFMap, vec2u(0u, y)).r;
    sum += p / f32(height);
    if(sum>=u){
      break;
    }
  }
  let cdfInv = pixel2tex(f32(y), height);
  textureStore(inverseMarginCDFMap, vec2u(0u, pos.y), vec4f(cdfInv,cdfInv,cdfInv,1.0));
}

fn calc_inverse_condition_CDF(pos: vec2u, tc: vec2f, width: u32){
  var sum = 0.0;
  var u = tc.x;
  var x: u32;
  for(x=0u; x<width; x++){
    let p = textureLoad(conditionPDFMap, vec2u(x, pos.y)).r;
    sum += p / f32(width);
    if(sum>=u){
      break;
    }
  }
  let cdfInv = pixel2tex(f32(x), width);
  textureStore(inverseConditionCDFMap, pos, vec4f(cdfInv,cdfInv,cdfInv,1.0));
}

${textureUV}

@compute @workgroup_size(2)
fn main(
  @builtin(workgroup_id) id: vec3u,
  @builtin(local_invocation_id) local_invocation_id: vec3u
){
  let pos = id.xy;
  let size = textureDimensions(conditionPDFMap);
  let tc = textureUV(pos, size);
  let width = size.x;
  let height = size.y;
  let z = local_invocation_id.x;

  switch z {
    case 0: {
      calc_inverse_margin_CDF(pos, tc, height);
      break;
    }
    case 1: {
      calc_inverse_condition_CDF(pos, tc, width);
      break;
    }
    default { return; }
  }
}
`;
