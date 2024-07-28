// Spatial Hash Grids

/**
 * hash position function: convert input (xi, yi, zi) position to an unique index
 */
export function hashCoords(xi: number, yi: number, zi: number) {
  const hash = (xi * 92837111) ^ (yi * 689287499) ^ (zi * 283923481);
  return Math.abs(hash);
}
