import { generateMips } from "./generateMips";

export function startPlayingAndWaitForVideo(video: HTMLVideoElement) {
  return new Promise((resolve, reject) => {
    video.addEventListener("error", reject);
    if ("requestVideoFrameCallback" in video) {
      video.requestVideoFrameCallback(resolve);
    } else {
      const timeWatcher = () => {
        if ((video as HTMLVideoElement).currentTime > 0) {
          resolve("");
        } else {
          requestAnimationFrame(timeWatcher);
        }
      };
      timeWatcher();
    }
    video.play().catch(reject);
  });
}

export function waitForClick() {
  return new Promise((resolve) => {
    window.addEventListener(
      "click",
      () => {
        resolve("");
      },
      { once: true }
    );
  });
}
export async function createVideo(url: string) {
  const video = document.createElement("video") as HTMLVideoElement;
  video.src = url;
  video.muted = true;
  video.preload = "auto";
  video.loop = true;
  video.autoplay = false;
  const [width, height] = await (new Promise((resolve) => {
    video.onloadedmetadata = () => {
      resolve([video.videoWidth, video.videoHeight]);
    };
  }) as Promise<[number, number]>);
  return { video, width, height };
}

export async function loadImageBitmap(url: string) {
  const res = await fetch(url);
  const blob = await res.blob();
  const img = await createImageBitmap(blob, { colorSpaceConversion: "none" });
  return { img, width: img.width, height: img.height };
}

export function getImageDataFromBitmap(img: ImageBitmap) {
  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0);
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return imgData;
}

export function numMipLevels(...sizes: number[]) {
  return 1 + (Math.log2(Math.max(...sizes)) | 0);
}

export function getSourceSize(
  source: ImageBitmap | HTMLCanvasElement | HTMLVideoElement | ImageData
) {
  if (source instanceof HTMLVideoElement) {
    return [source.videoWidth, source.videoHeight];
  } else {
    return [source.width, source.height];
  }
}

export type CreateTextureOptions = {
  mips?: boolean;
  flipY?: boolean;
  label?: string;
  format?: GPUTextureFormat;
  colorSpace: PredefinedColorSpace;
};

export function createTextureFromSources(
  device: GPUDevice,
  sources: (ImageBitmap | HTMLCanvasElement | HTMLVideoElement)[],
  options?: CreateTextureOptions
) {
  const [width, height] = getSourceSize(sources[0]);
  const texture = device.createTexture({
    label: options?.label ?? "",
    format: options?.format ?? "rgba8unorm",
    mipLevelCount: options?.mips ? numMipLevels(width, height) : 1,
    size: [width, height, sources.length],
    usage:
      GPUTextureUsage.COPY_DST |
      GPUTextureUsage.TEXTURE_BINDING |
      GPUTextureUsage.RENDER_ATTACHMENT,
  });
  sources.forEach((source, layer) => {
    device.queue.copyExternalImageToTexture(
      { source, flipY: options?.flipY },
      { texture, origin: [0, 0, layer] },
      { width, height }
    );
  });
  if (texture.mipLevelCount > 1) {
    // 直接将生成的 mip 写入 texture 即可，不需要返回手动一个个写入
    generateMips(device, texture);
  }
  return texture;
}

export function createTextureFromSource(
  device: GPUDevice,
  source: ImageBitmap | HTMLCanvasElement | HTMLVideoElement,
  options?: CreateTextureOptions
) {
  return createTextureFromSources(device, [source], options);
}

export async function createTextureFromImages(
  device: GPUDevice,
  urls: string[],
  options?: CreateTextureOptions
) {
  const sources = (
    await Promise.all(urls.map((url) => loadImageBitmap(url)))
  ).map(({ img }) => img);
  return createTextureFromSources(device, sources, options);
}

export async function createTextureFromImage(
  device: GPUDevice,
  url: string,
  options?: CreateTextureOptions
) {
  const { img: source } = await loadImageBitmap(url);
  return createTextureFromSource(device, source, options);
}
