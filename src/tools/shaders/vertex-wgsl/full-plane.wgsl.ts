import { ShaderContext } from "..";

interface ShaderContextParameter {
  flipY: boolean;
}

export default (context: ShaderContext<ShaderContextParameter>) => /* wgsl */ `
  struct VaryStruct {
    @builtin(position) position: vec4f,
    @location(0) tc: vec2f,
    @location(1) pos: vec4f,
  }

  @vertex
  fn main(@builtin(vertex_index) vertexIndex: u32) -> VaryStruct {
    let pos = array<vec2f, 3>(
      vec2f(-1., -1.),
      vec2f(3., -1.),
      vec2f(-1., 3.),
    );

    var o: VaryStruct;
    o.position = vec4f(pos[vertexIndex], 1.0, 1.0); 
    o.tc = pos[vertexIndex] * vec2f(0.5, ${context.flipY ? -0.5 : 0.5}) + 0.5;
    o.pos = o.position;
    return o;
  }
`;
