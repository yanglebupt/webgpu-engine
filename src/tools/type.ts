import { ResourceBuffer } from "./textures/ResourceBuffer";
import { Texture } from "./textures/Texture";

export type GPUResource = GPUBuffer | GPUSampler | GPUTextureView;
export type GPUResourceView = ResourceBuffer | Texture;
