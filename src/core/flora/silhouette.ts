/**
 * Blocking width of a drawn tree on a level line of sight (T-0032, grok continuing claude): the mean width its silhouette covers
 * per row, 2.25-8 m above the base (the trunk zone of a lake's far shore), averaged over 8 view azimuths. The geometry is
 * rasterised orthographically (cells of `cell` m, union of all triangles), so gaps between whorls and the empty stem zone under
 * a high crown count as see-through, which the envelope (2 x max radius) did not. Feeds sightDepth's w (Poisson gaps,
 * Nilson 1971). Opaque geometry only: the far-ring trees (default treeGeometry, v2 far crowns) have no alpha. Pure.
 * Check: a 1 x 1 m square prism reads 4/pi = 1.273 m (tests/fartrees.test.ts).
 */
export const SILHOUETTE_BAND = { y0: 2.25, y1: 8, azimuths: 8, cell: .04 };
export function blockingWidth(pos: ArrayLike<number>, index: ArrayLike<number> | null, sx: number, sy: number, band = SILHOUETTE_BAND) {
  const { y0, y1, azimuths, cell } = band, rows = Math.round((y1 - y0) / cell), n = index ? index.length : pos.length / 3;
  let maxR = 0; for (let i = 0; i < pos.length; i += 3) maxR = Math.max(maxR, Math.hypot(pos[i], pos[i + 2]) * sx);
  const half = Math.ceil(maxR / cell) + 2, U = 2 * half + 1, grid = new Uint8Array(rows * U); let sum = 0;
  const P = [[0, 0], [0, 0], [0, 0]];
  for (let a = 0; a < azimuths; a++) {
    const c = Math.cos(a * Math.PI / azimuths), s = Math.sin(a * Math.PI / azimuths); grid.fill(0);
    for (let k = 0; k + 2 < n; k += 3) {
      for (let j = 0; j < 3; j++) { const i = (index ? index[k + j] : k + j) * 3; P[j][0] = (pos[i] * c + pos[i + 2] * s) * sx; P[j][1] = pos[i + 1] * sy; }
      const ymin = Math.min(P[0][1], P[1][1], P[2][1]), ymax = Math.max(P[0][1], P[1][1], P[2][1]); if (ymax < y0 || ymin >= y1) continue;
      const r0 = Math.max(0, Math.floor((ymin - y0) / cell)), r1 = Math.min(rows - 1, Math.floor((ymax - y0) / cell));
      for (let r = r0; r <= r1; r++) {
        const y = y0 + (r + .5) * cell; let lo = Infinity, hi = -Infinity;
        for (let e = 0; e < 3; e++) { const A = P[e], B = P[(e + 1) % 3]; if ((A[1] - y) * (B[1] - y) > 0 || A[1] === B[1]) continue; const u = A[0] + (B[0] - A[0]) * (y - A[1]) / (B[1] - A[1]); lo = Math.min(lo, u); hi = Math.max(hi, u); }
        if (lo > hi) continue; const i0 = Math.max(0, Math.round(lo / cell) + half), i1 = Math.min(U - 1, Math.round(hi / cell) + half); grid.fill(1, r * U + i0, r * U + i1 + 1);
      }
    }
    let cov = 0; for (let i = 0; i < grid.length; i++) cov += grid[i]; sum += cov * cell / rows;
  }
  return sum / azimuths;
}