export default (format: string) => /* wgsl */ `
@group(0) @binding(0) var screen: texture_storage_2d<${format}, write>;

fn textureUV(id: vec3u) -> vec4f {
  // Viewport resolution (in pixels)
  let screen_size = textureDimensions(screen);

  // Pixel coordinates (centre of pixel, origin at bottom left)
  let fragCoord = vec2f(f32(id.x) + .5, f32(screen_size.y - id.y) - .5);  // flipY

  // Normalised pixel coordinates (from 0 to 1)
  let uv = fragCoord / vec2f(screen_size);

  return vec4f(uv, vec2f(screen_size));
}

@compute @workgroup_size(1)
fn main(@builtin(workgroup_id) id: vec3u){
  let uv = textureUV(id).xy;
  var col = vec4f(uv, 0., 1.);
  textureStore(screen, id.xy, col);
}
`;
