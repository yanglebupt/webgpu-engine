import { ShaderContext } from "../..";
interface ShaderContextParameter {
  bindingStart: number;
}
export const DataDefinitions = (bindingStart: number = 1) => /* wgsl */ `
struct Uniforms {
  color: vec4f,
} 
@group(1) @binding(${bindingStart}) var<uniform> uni: Uniforms;
`;

export default (context: ShaderContext<ShaderContextParameter>) => {
  const { bindingStart = 1 } = context;
  return /* wgsl */ `
${DataDefinitions(bindingStart)}
@fragment
fn main() -> @location(0) vec4f {
  return uni.color;
}
`;
};
