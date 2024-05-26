## Texture Format 要求

texture format 需要使用 `rgba32float` 才可以得到清晰的结果，否则很暗。因为如果使用 `rgba8unorm`，从 `image: f32--- 写入texture: uint ---> shader 读取 f32 ---写入 canvas texture: uint` 每一步都会损失精度，导致最后的结果很暗。

## IBL BRDF IS 注意点

由于 IBL BRDF IS 需要 mipmap level，而且 diffuse 和 specular 两个部分采用不同的 mipmap level，并且整个过程我们采用 compute pass 来计算 pre-filtered evn map

- 对 envMap 计算 mipmaps，然后以 `texture_2d<f32>` 的格式传入 compute shader 中，因为这种格式可以使用 mipmap level，同时开启 `float32-filterable` feature 就可以了使用 mipmap filter 了。需要注意的是在 compute shader 中仍然可以正常使用 `texture_2d<f32>`，因此这里不需要使用 storage texture
- 如果不支持 `float32-filterable`，那就需要自己实现 `textureFilter` 来完成对 mipmap level 采样filter 的操作
- 对于 phone specular 需要根据 `roughness(Cook-Torrance Microfacet)/shininess(Phong)` 写入到不同的 mipmap level 中，因此这里可以通过循环设置 `createView` 来指定不同的 level
- 对于 PBR Material specular 的 Split-Sum-Approximation 方式，也需要写入不同的 mipmap level，而且还会产生一个额外贴图 
- dispatch 策略：优先将所有的 invocation 分给 sample numbers 进行并行，内部串行几次没问题，图像宽高进行 dispatch 并行就行了，`roughness` 进行循环

## IBL IS 注意点

- 因为整个过程的概率是灰度值，可以将计算的 `pdf\inverse cdf` 值保存到一张 texture 的不同通道中
- 推导一下 phone specular 以及对应的 PBR Material specular Split-Sum-Approximation 方式