import { TypedArray } from "webgpu-utils";

export type DrawImageBitmapOptions = {
  className?: string;
  parentId?: string;
  canvas?: HTMLCanvasElement;
};
export function drawImageBitmap(
  img: ImageBitmap,
  options?: DrawImageBitmapOptions
): void {
  const canvas = options?.canvas ?? document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;

  const bm = canvas.getContext("bitmaprenderer");
  bm?.transferFromImageBitmap(img);

  options?.className && canvas.classList.add(options?.className);

  options?.parentId &&
    document.getElementById(options?.parentId)?.appendChild(canvas);
}

export function drawHistogram(
  histogram: TypedArray,
  numEntries: number,
  options: DrawImageBitmapOptions & {
    width: number;
    height: number;
    channel: number[];
  }
) {
  const { height, width } = options;
  const numBins = histogram.length / 4;
  const max = [0, 0, 0, 0];
  histogram.forEach((v: number, idx: number) => {
    const ch = idx % 4;
    max[ch] = Math.max(max[ch], v);
  });
  const scale = max.map((m) => Math.max(1 / m, (0.2 * numBins) / numEntries));
  const wp = width / numBins;

  const canvas = options?.canvas ?? document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d")!;

  const colors = [
    "rgb(255, 0, 0)",
    "rgb(0, 255, 0)",
    "rgb(0, 0, 255)",
    "rgb(255, 255, 255)",
  ];
  ctx.globalCompositeOperation = "screen";

  for (let x = 0; x < numBins; ++x) {
    const offset = 4 * x;
    for (const ch of options.channel) {
      ctx.fillStyle = colors[ch];
      const v = histogram[offset + ch] * scale[ch] * height;
      ctx.fillRect(x * wp, height - v, wp, v);
    }
  }

  options?.className && canvas.classList.add(options?.className);

  options?.parentId &&
    document.getElementById(options?.parentId)?.appendChild(canvas);
}
