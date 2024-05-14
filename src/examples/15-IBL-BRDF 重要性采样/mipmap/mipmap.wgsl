@group(0) @binding(0)
var t_base: texture_2d<f32>;
@group(0) @binding(1)
var t_next: texture_storage_2d<rgba8unorm, write>;

@compute @workgroup_size(8,8)
fn generateMipmap(
    @builtin(global_invocation_id) gid: vec3<u32>
)
{
    // 2x2 average.
    var color = textureLoad(t_base, 2u * gid.xy, 0);
    color += textureLoad(t_base, 2u * gid.xy + vec2<u32>(1, 0), 0);
    color += textureLoad(t_base, 2u * gid.xy + vec2<u32>(0, 1), 0);
    color += textureLoad(t_base, 2u * gid.xy + vec2<u32>(1, 1), 0);
    color /= 4.0;

    // Write to the next level.
    textureStore(t_next, gid.xy, color);
}