import { ShaderContext } from "..";

export default (context: ShaderContext) => /* wgsl */ `
const lightDir = vec3f(0, -1, 0);
const lightColor = vec3f(0.5);
const ambientColor = vec3f(0.5);

@fragment
fn main(@location(0) norm: vec3f) -> @location(0) vec4f {
  let n = normalize(norm);
  let l = normalize(lightDir);
  let surfaceColor = ambientColor + lightColor * saturate(dot(n, -l));
  return vec4f(surfaceColor, 1.);
}
`;
