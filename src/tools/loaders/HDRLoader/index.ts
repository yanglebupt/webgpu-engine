import { fetchWithProgress } from "../../common";
import { decodeHeader, decodeRGBE, flipX, flipY } from "./io-rgbe-main";

/* 
  确保精度，HDR 转成 rgba8unorm 很容易失去精度导致结果 bard
  因此 uint8=false，使用 Float32Array 来创建 `rgba32float` format 的 texture
*/
export interface HDRLoaderOptions {
  onProgress?: (name: string, percentage: number) => void;
  sRGB?: boolean; // 是否转换到 sRGB 空间
  exposure?: number; // 0-1
  uint8?: boolean; // 是否转换到 255，如果是返回 Uint8ClampedArray，否则返回 Float32Array
  returnGray?: boolean; // 因为本身读取 hdr 图片就需要一行一行的解析，那么可以直接在解析的过程中计算灰度图
  returnRowAvgGray?: boolean; // 因为本身读取 hdr 图片就需要一行一行的解析，那么可以直接在解析的过程中计算灰度图
}

export interface HDRLoaderReturn<T> {
  color: T;
  gray: T;
  row_avg: T;
  width: number;
  height: number;
  avg_gray: number;
}

export class HDRLoader {
  async load<T extends Float32Array | Uint8ClampedArray | Uint8Array>(
    filename: string,
    options?: HDRLoaderOptions
  ) {
    const {
      onProgress,
      sRGB = true,
      exposure = 1,
      returnGray = false,
      returnRowAvgGray = false,
      uint8 = false,
    } = options || {};
    const buffer = await (await fetchWithProgress(filename, (percentage) => {
      onProgress && onProgress("downloading", 0.2 * percentage);
    })!)!.arrayBuffer();

    const { header, stream } = decodeHeader(new DataView(buffer));
    const { width, height } = header;
    const pixelCount = width * height;

    const cols = uint8
      ? new Uint8ClampedArray(pixelCount * 4)
      : new Float32Array(pixelCount * 4);
    const grays = returnGray
      ? uint8
        ? new Uint8ClampedArray(pixelCount * 4)
        : new Float32Array(pixelCount * 4)
      : null;
    const row_avgs = returnRowAvgGray
      ? uint8
        ? new Uint8ClampedArray(height * 4)
        : new Float32Array(height * 4)
      : null;

    const gamma = sRGB ? 1.0 / 2.2 : 1.0;
    const scale = uint8 ? 0xff : 1;
    let avg_gray = 0;
    let pixel_idx = 0;
    let row_avg_gray = 0;

    let j = 0;
    let i = 0;
    decodeRGBE(
      { header, stream },
      {
        useReturn: false,
        alpha: true,
        onPixel(r: number, g: number, b: number) {
          r *= exposure;
          g *= exposure;
          b *= exposure;
          cols[j] = Math.pow(r, gamma) * scale;
          cols[j + 1] = Math.pow(g, gamma) * scale;
          cols[j + 2] = Math.pow(b, gamma) * scale;
          cols[j + 3] = scale;
          let gray = r * 0.2126 + g * 0.7152 + b * 0.0722;
          avg_gray += gray / pixelCount;
          row_avg_gray += gray / width;

          if (returnGray) {
            grays![j] = Math.pow(gray, gamma) * scale;
            grays![j + 1] = Math.pow(gray, gamma) * scale;
            grays![j + 2] = Math.pow(gray, gamma) * scale;
            grays![j + 3] = scale;
          }
          if ((pixel_idx + 1) % width == 0) {
            if (returnRowAvgGray) {
              const row_idx = 4 * (parseInt((pixel_idx + 1) / width + "") - 1);
              row_avgs![row_idx] = Math.pow(row_avg_gray, gamma) * scale;
              row_avgs![row_idx + 1] = Math.pow(row_avg_gray, gamma) * scale;
              row_avgs![row_idx + 2] = Math.pow(row_avg_gray, gamma) * scale;
              row_avgs![row_idx + 3] = scale;
            }
            row_avg_gray = 0;
          }
          j += 4;
          i += 1;
          pixel_idx++;
          // onProgress && onProgress("parse hdr", 0.2 + (i / pixelCount) * 0.8);
        },
      }
    );

    if (header.flipX) {
      flipX(cols, header, 4);
      if (returnGray) {
        flipX(grays!, header, 4);
      }
    }
    if (header.flipY) {
      flipY(cols, header, 4);
      if (returnGray) {
        flipY(grays!, header, 4);
      }
      if (returnRowAvgGray) {
        flipY(row_avgs!, { ...header, width: 1 }, 4);
      }
    }

    return {
      color: uint8 ? new Uint8Array(cols) : cols,
      gray: uint8 && returnGray ? new Uint8Array(grays!) : grays,
      row_avg: uint8 && returnRowAvgGray ? new Uint8Array(row_avgs!) : row_avgs,
      width,
      height,
      avg_gray,
    } as HDRLoaderReturn<T>;
  }
}
