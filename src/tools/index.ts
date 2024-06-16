import { makeShaderDataDefinitions, makeStructuredView } from "webgpu-utils";
import { CreateTextureOptions, getSourceSize, numMipLevels } from "./loader";
import { bilinearFilter } from "./math";
import { GPUSamplerCache, GPUShaderModuleCacheKey } from "./scene/cache";
import { ShaderCode, ShaderContext } from "./shaders";
import { GPUResource, GPUResourceView } from "./type";
import { ResourceBuffer } from "./textures/ResourceBuffer";
import { BuildOptions, Type } from "./scene/types";

export interface GPUSupport {
  gpu: GPU;
  adapter: GPUAdapter;
  device: GPUDevice;
  format: GPUTextureFormat;
}
export async function checkWebGPUSupported(
  adapterOptions?: GPURequestAdapterOptions,
  deviceDescriptor?: GPUDeviceDescriptor & {
    requiredLimits?: Partial<GPUSupportedLimits>;
  }
): Promise<GPUSupport> {
  const gpu = navigator.gpu;
  if (!gpu) throw new Error("Web GPU not available");
  const adapter = await gpu.requestAdapter(adapterOptions);
  if (!adapter) throw new Error("Can not request Web GPU Adapter");
  if (deviceDescriptor?.requiredFeatures) {
    // 检测 requiredFeatures 是否在 adapter 的 features 中
    // features 可以看成一些额外的功能，类似插件的作用
    deviceDescriptor.requiredFeatures = (
      deviceDescriptor.requiredFeatures as GPUFeatureName[]
    ).filter((f) => adapter.features.has(f));
  }
  // requiredLimits 不能超过 adapter 的 limits 中的最大限制值，另外当输入的 requiredLimits 小于 requestDevice 返回的默认值，则会优先使用默认值
  const device = await adapter.requestDevice(deviceDescriptor);
  if (!device) throw new Error("Can not request Web GPU Device");
  return { gpu, adapter, device, format: gpu.getPreferredCanvasFormat() };
}

export type CreateCanvasReturn = {
  canvas: HTMLCanvasElement;
  ctx: GPUCanvasContext;
  width: number;
  height: number;
  aspect: number;
};
export type CreateCanvasConfig = GPUCanvasConfiguration & {
  scale?: boolean;
  virtual?: boolean;
};
export function createCanvas(
  width: number | string,
  height: number | string,
  config?: CreateCanvasConfig,
  className?: string,
  parentID?: string
): CreateCanvasReturn;
export function createCanvas(
  showSize: {
    width: number | string;
    height: number | string;
  },
  pixelSize: {
    width: number;
    height: number;
  },
  config?: CreateCanvasConfig,
  className?: string,
  parentID?: string
): CreateCanvasReturn;
export function createCanvas(
  width:
    | number
    | string
    | {
        width: number | string;
        height: number | string;
      },
  height:
    | number
    | string
    | {
        width: number;
        height: number;
      },
  config?: CreateCanvasConfig,
  className?: string,
  parentID?: string
) {
  const show_pixel_size =
    typeof width === "object" && typeof height === "object";
  const common_size = typeof width !== "object" && typeof height !== "object";
  if (!show_pixel_size && !common_size) throw new Error("");

  // 创建画布
  const canvas = document.createElement("canvas") as HTMLCanvasElement;
  canvas.id = "webgpu-canvas";
  !!className && (canvas.className = className);

  const { scale = true, virtual = false } = config || {};

  // 页面展示的宽高
  const show_width = show_pixel_size ? (width as any).width : width;
  const show_height = show_pixel_size ? (width as any).height : height;
  canvas.style.width =
    typeof show_width === "number" ? `${show_width}px` : show_width;
  canvas.style.height =
    typeof show_height === "number" ? `${show_height}px` : show_height;
  if (virtual) {
    if (typeof show_width !== "number" || typeof show_height !== "number")
      throw new Error("virtual canvas width and height must be number");
  } else
    (parentID ? document.getElementById(parentID) : document.body)?.appendChild(
      canvas
    );

  // 实际像素宽高
  const clientWidth = virtual ? show_width : canvas.clientWidth;
  const clientHeight = virtual ? show_height : canvas.clientHeight;
  const pixel_width = show_pixel_size ? (height as any).width : clientWidth;
  const pixel_height = show_pixel_size ? (height as any).height : clientHeight;
  canvas.width = pixel_width * (scale ? window.devicePixelRatio : 1);
  canvas.height = pixel_height * (scale ? window.devicePixelRatio : 1);
  const ctx = canvas.getContext("webgpu");
  if (!ctx) throw new Error("webgpu context for canvas not available");
  // 配置 canvas 的上下文对象，这样 device 才可以绘制到 canvas 上去
  if (config) ctx.configure(config);
  return {
    canvas,
    ctx,
    width: clientWidth,
    height: clientHeight,
    aspect: clientWidth / clientHeight,
  };
}

export function createComputePipeline(
  compute: string,
  device: GPUDevice,
  descriptor?: Partial<GPUComputePipelineDescriptor>
) {
  return device.createComputePipeline({
    layout: "auto",
    compute: {
      module: device.createShaderModule({ code: compute }),
      entryPoint: "main",
      ...descriptor?.compute,
    },
    ...descriptor,
  });
}

export function createRenderPipeline(
  vertex: string,
  fragment: string,
  device: GPUDevice,
  format: GPUTextureFormat,
  vertexBuffers?: Iterable<GPUVertexBufferLayout | null>,
  descriptor?: Partial<GPURenderPipelineDescriptor>
) {
  // 根据 vertex shader 和 fragment shader 创建渲染管线
  return device.createRenderPipeline({
    layout: "auto",
    vertex: {
      module: device.createShaderModule({
        code: vertex,
      }),
      entryPoint: "main",
      buffers: vertexBuffers,
    },
    fragment: {
      module: device.createShaderModule({
        code: fragment,
      }),
      entryPoint: "main",
      targets: [{ format }], // 指定 fragment 的输出颜色格式
    },
    primitive: {
      topology: "triangle-list", // 指定点的组合方式
      ...descriptor?.primitive,
    },
    ...descriptor,
  });
}

export function getBindGroupEntries(...resourcesList: Array<GPUResource[]>) {
  const entries: GPUBindGroupEntry[] = [];
  let binding = 0;
  for (let i = 0; i < resourcesList.length; i++) {
    const resources = resourcesList[i];
    for (let j = 0; j < resources.length; j++) {
      const resource = resources[j];
      entries.push({
        binding,
        resource:
          resource instanceof GPUBuffer ? { buffer: resource } : resource,
      });
      binding++;
    }
  }
  return entries;
}

export type ShaderCodeWithContext = {
  shaderCode: ShaderCode;
  context?: ShaderContext;
};

export function injectShaderCode<T extends Record<string, any>>(
  shader: ShaderCodeWithContext,
  inject: string | Function,
  ...injectContext: any[]
): GPUShaderModuleCacheKey<T> {
  return {
    code: (context: ShaderContext<T>) => {
      return `
        ${
          typeof inject === "function"
            ? Reflect.apply(inject, null, injectContext)
            : inject
        }
        ${shader.shaderCode.DataDefinition}
        ${shader.shaderCode.code(context)}
      `;
    },
    context: shader.context ?? {},
  };
}

export function getAddonBindGroupLayoutEntries(
  shaderCode: ShaderCode,
  visibility: GPUShaderStageFlags,
  startBinding: number = 0,
  resourceViews: Array<GPUResourceView> = []
): GPUBindGroupLayoutEntry[] {
  const defs = makeShaderDataDefinitions(shaderCode.DataDefinition);
  return resourceViews.map((resourceView, idx) => {
    if (resourceView instanceof ResourceBuffer) {
      resourceView.bufferView = makeStructuredView(
        defs.uniforms[resourceView.name]
      );
      return {
        binding: startBinding + idx,
        visibility,
        buffer: { type: resourceView.type },
      };
    } else {
      return {
        binding: startBinding + idx,
        visibility,
        texture: { viewDimension: "2d" },
      };
    }
  });
}

export function getResourcesfromViews(
  device: GPUDevice,
  cached: { sampler: GPUSamplerCache },
  resourceViews: Array<GPUResourceView> = []
) {
  return resourceViews.map((resourceView) => {
    if (resourceView instanceof ResourceBuffer) {
      resourceView.upload(device);
      return resourceView.buffer;
    } else {
      resourceView.upload(device, cached.sampler);
      return resourceView.texture.createView();
    }
  });
}

export function updateResourceViews(
  device: GPUDevice,
  resourceViews: Array<GPUResourceView> = []
) {
  resourceViews.forEach((resourceView: any) => {
    if (Type.isUpdatable(resourceView)) resourceView.update(device);
  });
}

//////////
///////////
////////////
// 后续可以删除这部分
export function extractMipmapFromTexture() {}

type MipMapTextureType = {
  data: Uint8Array;
  width: number;
  height: number;
  smooth?: boolean;
};

const createNextMipLevelRgba8Unorm = (
  { data: src, width: srcWidth, height: srcHeight }: MipMapTextureType,
  smooth: boolean = false
) => {
  // compute the size of the next mip
  const dstWidth = Math.max(1, (srcWidth / 2) | 0);
  const dstHeight = Math.max(1, (srcHeight / 2) | 0);
  const dst = new Uint8Array(dstWidth * dstHeight * 4);

  const getSrcPixel = (x: number, y: number) => {
    const offset = (y * srcWidth + x) * 4;
    return src.subarray(offset, offset + 4);
  };

  for (let y = 0; y < dstHeight; ++y) {
    for (let x = 0; x < dstWidth; ++x) {
      // compute texcoord of the center of the destination texel
      const u = (x + 0.5) / dstWidth;
      const v = (y + 0.5) / dstHeight;

      // compute the same texcoord in the source - 0.5 a pixel
      const au = u * srcWidth - 0.5;
      const av = v * srcHeight - 0.5;

      // compute the src top left texel coord (not texcoord)
      const tx = au | 0;
      const ty = av | 0;

      // compute the mix amounts between pixels
      const t1 = au % 1;
      const t2 = av % 1;

      // get the 4 pixels
      const tl = getSrcPixel(tx, ty);
      const tr = getSrcPixel(tx + 1, ty);
      const bl = getSrcPixel(tx, ty + 1);
      const br = getSrcPixel(tx + 1, ty + 1);

      // copy the "sampled" result into the dest.
      const dstOffset = (y * dstWidth + x) * 4;
      dst.set(bilinearFilter(tl, tr, bl, br, t1, t2, smooth), dstOffset);
    }
  }
  return { data: dst, width: dstWidth, height: dstHeight };
};

export function createMipMaps(
  src: Uint8Array,
  srcWidth: number,
  srcHeight: number,
  smooth: boolean = false
) {
  // populate with first mip level (base level)
  let mip = { data: src, width: srcWidth, height: srcHeight };
  const mips = [mip];

  while (mip.width > 1 || mip.height > 1) {
    mip = createNextMipLevelRgba8Unorm(mip, smooth);
    mips.push(mip);
  }
  return mips;
}

export function createTextureFromSourceCPUMipmaps(
  device: GPUDevice,
  source: ImageData,
  options?: CreateTextureOptions & { smooth?: boolean }
) {
  const [width, height] = getSourceSize(source);
  const texture = device.createTexture({
    label: options?.label ?? "",
    format: "rgba8unorm-srgb",
    mipLevelCount: options?.mips ? numMipLevels(width, height) : 1,
    size: [width, height],
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
  });
  if (texture.mipLevelCount > 1) {
    const mips = createMipMaps(
      new Uint8Array(source.data),
      width,
      height,
      options?.smooth
    );
    mips.forEach(({ data, width, height }, mipLevel) => {
      device.queue.writeTexture(
        { texture, mipLevel },
        data,
        { bytesPerRow: width * 4 },
        { width, height }
      );
    });
  }
  return texture;
}
