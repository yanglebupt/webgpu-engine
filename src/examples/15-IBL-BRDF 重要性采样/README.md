## Texture Format 要求

texture format 需要使用 `rgba32float` 才可以得到清晰的结果，否则很暗。因为如果使用 `rgba8unorm`，从 `image: f32--- 写入texture: uint ---> shader 读取 f32 ---写入 canvas texture: uint` 每一步都会损失精度，导致最后的结果很暗。

## IBL BRDF IS 注意点

由于 IBL BRDF IS 需要 mipmap level，而且 diffuse 和 specular 两个部分采用不同的 mipmap level，并且整个过程我们采用 compute pass 来计算 pre-filtered evn map

- 对 envMap 计算 mipmaps，然后以 `texture_2d<f32>` 的格式传入 compute shader 中，因为这种格式可以使用 mipmap level，同时开启 `float32-filterable` feature 就可以了使用 mipmap filter 了。需要注意的是在 compute shader 中仍然可以正常使用 `texture_2d<f32>`，因此这里不需要使用 storage texture
- 如果不支持 `float32-filterable`，那就需要自己使用 compute shader 来完成该操作。我们将提取到的 mipmap filter，存入到 `texture_storage_2d_array<rgba32float, write>` 中
- 对于 specular 需要根据 `roughness(Cook-Torrance Microfacet)/shininess(Phong)` 写入到不同的 mipmap level中，然后在 renderPass 中使用就可以进行 filter 了。但是 storage texture 不支持写入(textureStore)不同的 mipmal level 中去，只支持写入对 `2d-array` 写入不同的 `array_index`