/**
 * The south pole is the ice sheet, not a copy of the last mercator row.
 * Web Mercator row y = n − 1 is the clamp. South of it the zoom-0 sheet used
 * to repeat one row, so the Antarctic edge was the same blocks at every latitude.
 * Bedmap2's interior stands higher still (Fretwell et al. 2013, The Cryosphere 7:375).
 */
export function antarcticClampLat(n = 256) {
  const y = n - 1;
  return Math.atan(Math.sinh(Math.PI * (1 - 2 * y / n))) * 180 / Math.PI;
}
