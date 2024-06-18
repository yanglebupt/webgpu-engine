import { ShaderCode } from "../../../tools/shaders";

const fragment: ShaderCode = {
  code() {
    return /* wgsl */ `
@fragment
fn main(@location(0) color: vec4f) -> @location(0) vec4f {
  return color;
}
`;
  },
};
export default fragment;
