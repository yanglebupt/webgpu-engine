import { Texture } from "./textures/Texture";

export type GPUResource = GPUBuffer | GPUSampler | GPUTextureView;
export type GPUResourceView = Record<string, any> | Texture;
