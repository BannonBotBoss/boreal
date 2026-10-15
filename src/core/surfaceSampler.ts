/**
 * Seeded, area-weighted sampling of points on a triangle mesh (pure maths, no THREE).
 * THREE's MeshSurfaceSampler has the same idea but reports neither which triangle was hit nor barycentric weights,
 * which fur needs to inherit bone weights and the fur direction, so this version returns both.
 */
export interface SurfaceSample { tri: number; u: number; v: number; w: number }

/** Small fast seeded generator: the same seed always gives the same sequence. */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** Triangle areas of an indexed position buffer. */
export function triangleAreas(position: ArrayLike<number>, index: ArrayLike<number>): number[] {
  const areas: number[] = [];
  for (let t = 0; t < index.length; t += 3) {
    const a = index[t] * 3, b = index[t + 1] * 3, c = index[t + 2] * 3;
    const ux = position[b] - position[a], uy = position[b + 1] - position[a + 1], uz = position[b + 2] - position[a + 2];
    const vx = position[c] - position[a], vy = position[c + 1] - position[a + 1], vz = position[c + 2] - position[a + 2];
    areas.push(Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) / 2);
  }
  return areas;
}

/** `count` points spread over the surface, each triangle chosen in proportion to its area. */
export function sampleSurface(position: ArrayLike<number>, index: ArrayLike<number>, count: number, random: () => number, weight?: ArrayLike<number>): SurfaceSample[] {
  const areas = triangleAreas(position, index).map((a, t) => a * (weight ? weight[t] : 1)), cumulative: number[] = [];
  let total = 0;
  for (const a of areas) cumulative.push(total += a);
  const out: SurfaceSample[] = [];
  for (let i = 0; i < count; i++) {
    const target = random() * total;
    let lo = 0, hi = cumulative.length - 1;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (cumulative[mid] < target) lo = mid + 1; else hi = mid; }
    // Uniform point in a triangle (Osada et al.): fold the unit square.
    const r1 = Math.sqrt(random()), r2 = random();
    out.push({ tri: lo, u: 1 - r1, v: r1 * (1 - r2), w: r1 * r2 });
  }
  return out;
}
