/**
 * HDRImageData contains all decompressed image data.
 */
export interface HDRImageData {
  width: number;
  height: number;
  exposure: number;
  gamma: number;
  data: Float32Array | null;
}
