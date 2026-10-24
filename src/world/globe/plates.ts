/**
 * Plate kinematics for the seeded planet (Grok Bot). The 25 MORVEL plates of NNR-MORVEL56 (Argus et al. 2011, G3 12:Q11001,
 * Table 1: Euler pole lat/lon, rate deg/Myr, area sr) are laid on the planet as a seeded power (weighted Voronoi) diagram whose
 * cell areas are fitted to the MORVEL areas. The planet's continents are procedural, so the plate outlines are seeded, but the
 * angular velocities are the measured ones: surface velocity v = omega x r, and each boundary is classified by the relative
 * velocity across it (divergent / convergent / transform, as in Bird 2003, G3 4:1027). Existence over deep time:
 * layerExistence 'plates' (onset ~3.1 Ga [DISPUTED]).
 */
import { hash, random } from '../../proc/rng';
import type { Vec3 } from './planet';
/** [abbrev, pole lat °N, pole lon °E, omega deg/Myr, area sr] — NNR-MORVEL56 Table 1, MORVEL plates. */
export const MORVEL: [string, number, number, number, number][] = [
  ['am', 63.17, -122.82, 0.297, 0.1307], ['an', 65.42, -118.11, 0.250, 1.4327], ['ar', 48.88, -8.49, 0.559, 0.1208], ['au', 33.86, 37.94, 0.632, 0.9214],
  ['cp', 44.44, 23.09, 0.608, 0.2036], ['ca', 35.20, -92.62, 0.286, 0.0730], ['co', 26.93, -124.31, 1.198, 0.0722], ['eu', 48.85, -106.50, 0.223, 1.1963],
  ['in', 50.37, -3.29, 0.544, 0.3064], ['jf', -38.31, 60.04, 0.951, 0.0063], ['lw', 51.89, -69.52, 0.286, 0.1171], ['mq', 49.19, 11.05, 1.144, 0.0079],
  ['nz', 46.23, -101.06, 0.696, 0.3967], ['na', -4.85, -80.64, 0.209, 1.3657], ['nb', 47.68, -68.44, 0.292, 1.4406], ['pa', -63.58, 114.70, 0.651, 2.5768],
  ['ps', -46.02, -31.36, 0.910, 0.1341], ['ri', 20.25, -107.29, 4.536, 0.0025], ['sw', -29.94, -36.87, 1.362, 0.0045], ['sc', 22.52, -106.15, 0.146, 0.0419],
  ['sm', 49.95, -84.52, 0.339, 0.3548], ['sa', -22.62, -112.83, 0.109, 1.0034], ['su', 50.06, -95.02, 0.337, 0.2197], ['sr', -32.50, -111.32, 0.107, 0.0271],
  ['yz', 63.03, -116.62, 0.334, 0.0542]];
const D = Math.PI / 180, unit = (lat: number, lon: number): Vec3 => [Math.cos(lat) * Math.cos(lon), Math.sin(lat), Math.cos(lat) * Math.sin(lon)];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
/** Angular velocity vector, rad/yr, planet frame. */
export const omegaOf = (k: number): Vec3 => { const [, la, lo, w] = MORVEL[k]; const u = unit(la * D, lo * D), s = w * D / 1e6; return [u[0] * s, u[1] * s, u[2] * s]; };
export interface Plates { centres: Vec3[]; weights: number[]; plateAt(p: Vec3): number; velocity(p: Vec3, R: number): Vec3; areas: number[] }
/** Fibonacci sample directions (González 2010) for area fitting. */
function fib(n: number): Vec3[] { const o: Vec3[] = [], g = Math.PI * (3 - Math.sqrt(5)); for (let i = 0; i < n; i++) { const y = 1 - 2 * (i + .5) / n, r = Math.sqrt(1 - y * y); o.push([r * Math.cos(g * i), y, r * Math.sin(g * i)]); } return o; }
export function buildPlates(seed: number, samples = 20000, iters = 60): Plates {
  const rnd = random(hash(`plates-v1:${seed}`)), n = MORVEL.length;
  const centres: Vec3[] = MORVEL.map(() => { const z = 2 * rnd() - 1, t = 2 * Math.PI * rnd(), r = Math.sqrt(1 - z * z); return [r * Math.cos(t), z, r * Math.sin(t)] as Vec3; });
  const weights = new Array(n).fill(0); // power diagram: plate = argmin(angle − weight)
  const plateAt = (p: Vec3) => { let b = 0, bd = Infinity; for (let i = 0; i < n; i++) { const d = Math.acos(Math.max(-1, Math.min(1, dot(p, centres[i])))) - weights[i]; if (d < bd) { bd = d; b = i; } } return b; };
  const pts = fib(samples), target = MORVEL.map(m => m[4] / (4 * Math.PI)); let areas: number[] = [];
  for (let it = 0; it < iters; it++) { const cnt = new Array(n).fill(0), sum = centres.map(() => [0, 0, 0]);
    for (const p of pts) { const k = plateAt(p); cnt[k]++; sum[k][0] += p[0]; sum[k][1] += p[1]; sum[k][2] += p[2]; }
    areas = cnt.map(c => c / samples);
    for (let i = 0; i < n; i++) { // grow/shrink toward the MORVEL area (cap radius ~ sqrt(area)), recentre (Lloyd)
      weights[i] += 0.5 * (Math.sqrt(target[i]) - Math.sqrt(Math.max(areas[i], 1e-5))) * 2;
      const l = Math.hypot(sum[i][0], sum[i][1], sum[i][2]); if (l > 0 && it < iters / 2) centres[i] = [sum[i][0] / l, sum[i][1] / l, sum[i][2] / l]; } }
  const omegas = MORVEL.map((_, k) => omegaOf(k));
  const velocity = (p: Vec3, R: number): Vec3 => { const w = omegas[plateAt(p)]; return [(w[1] * p[2] - w[2] * p[1]) * R, (w[2] * p[0] - w[0] * p[2]) * R, (w[0] * p[1] - w[1] * p[0]) * R]; };
  return { centres, weights, plateAt, velocity, areas: areas.map(a => a * 4 * Math.PI) };
}
export type BoundaryKind = 'divergent' | 'convergent' | 'transform';
/** Boundary points on a lat/lon raster (step deg): where the east or north neighbour is another plate. Kind from the relative
 *  velocity's component along the plate-to-plate normal (|normal| > |tangential| -> divergent/convergent, else transform). */
export function boundaries(pl: Plates, R: number, stepDeg = 0.5) {
  const out: { p: Vec3; kind: BoundaryKind; rate: number }[] = [];
  for (let la = -90 + stepDeg / 2; la < 90; la += stepDeg) for (let lo = -180; lo < 180; lo += stepDeg) {
    const p = unit(la * D, lo * D), a = pl.plateAt(p);
    for (const q of [unit(la * D, (lo + stepDeg) * D), unit(Math.min(90, la + stepDeg) * D, lo * D)]) { const b = pl.plateAt(q); if (b === a) continue;
      const n: Vec3 = [q[0] - p[0], q[1] - p[1], q[2] - p[2]], nl = Math.hypot(...n) || 1; // from plate a toward b
      const va = pl.velocity(p, R), vb = pl.velocity(q, R), dv: Vec3 = [vb[0] - va[0], vb[1] - va[1], vb[2] - va[2]];
      const vn = dot(dv, n) / nl, vt = Math.sqrt(Math.max(0, dot(dv, dv) - vn * vn));
      out.push({ p, kind: Math.abs(vn) < vt ? 'transform' : vn > 0 ? 'divergent' : 'convergent', rate: Math.hypot(vn, vt) }); break; } }
  return out;
}
