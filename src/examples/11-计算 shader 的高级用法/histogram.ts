import { getImageDataFromBitmap } from "../../tools/loader";

// Returns a value from 0 to 1 for luminance.
// where r, g, b each go from 0 to 1.
function srgbLuminance(r: number, g: number, b: number, norm: boolean = true) {
  // from: https://www.w3.org/WAI/GL/wiki/Relative_luminance
  const scale = norm ? 1 : 255;
  r /= scale;
  g /= scale;
  b /= scale;
  return r * 0.2126 + g * 0.7152 + b * 0.0722;
}

export function calcHistogram(img: ImageBitmap | ImageData, numBins: number) {
  const { data, width, height } =
    img instanceof ImageBitmap ? getImageDataFromBitmap(img) : img;
  const histogram: number[] = new Array(numBins * 4).fill(0); // rgb l
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const offset = (y * width + x) * 4; // rgba
      for (let j = 0; j < 4; j++) {
        const l =
          j < 3
            ? data[offset + j] / 255
            : srgbLuminance(
                data[offset + 0],
                data[offset + 1],
                data[offset + 2],
                false
              );
        const bin = Math.min(l * numBins, numBins - 1) | 0;
        histogram[4 * bin + j] += 1; // r, g, b, l, r, g, b, l, .....
      }
    }
  }
  return new Uint32Array(histogram);
}
