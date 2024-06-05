import { ShaderContext } from "..";

interface ShaderContextParameter {
  mipmapLevel: number;
}

export default (context: ShaderContext<ShaderContextParameter>) => {
  const { mipmapLevel = 0 } = context;
  return /* wgsl */ `
@group(0) @binding(0) var _sampler: sampler;
@group(0) @binding(1) var texture: texture_2d<f32>;

@fragment
fn main(@location(0) uv: vec2f) -> @location(0) vec4f {
  return textureSampleLevel(texture, _sampler, uv, f32(${mipmapLevel}));
}
`;
};
