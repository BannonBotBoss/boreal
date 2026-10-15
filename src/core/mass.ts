/**
 * Procedural mass (Grok Bot): mass = Σ over parts/regions of (volume from the generator's own geometry) × (density of
 * that region's composition, core/materials.ts). Never a typed mass. Every region is traced, so the inspector shows
 * the breakdown table (region, volume, mix, density, mass) and the total + weight.
 */
import { COMPOSITIONS, density, describeMix } from './materials';
import { f } from '../proc/trace';
import { weight } from '../proc/physics';
export type Part = { region: string; volume: number };
export function massOf(plan: string, parts: Part[], mixFor: (region: string) => string = r => r) {
  let total = 0, vol = 0;
  for (const p of parts) {
    const mix = COMPOSITIONS[plan][mixFor(p.region)], d = density(mix), m = p.volume * d; total += m; vol += p.volume;
    f('mass', p.region, `${p.volume.toFixed(4)} m³ × ${d.toFixed(0)} kg/m³ (${describeMix(mix)}) = ${m.toFixed(2)} kg`);
  }
  f('physics', 'body plan', plan); f('physics', 'volume (m³)', vol); const m = f('physics', 'mass (kg)', total); f('physics', 'weight (N)', weight(m));
  return m;
}
const PI = Math.PI;
export const ellipsoid = (a: number, b: number, c: number) => 4 / 3 * PI * a * b * c; // semi-axes
export const frustum = (r0: number, r1: number, h: number) => PI * h * (r0 * r0 + r0 * r1 + r1 * r1) / 3;
export const cone = (r: number, h: number) => PI * r * r * h / 3;
/** Animal region of a rig-local point (normalized 0..1 in its bounds; z 0 = nose since -z is forward). */
export function regionOf(nx: number, ny: number, nz: number) {
  if (ny < .35 && nz > .12) return 'legs';
  if (nz < .2 && ny > .45) return 'head';
  if (nz < .32 && ny > .45) return 'neck';
  if (nz > .9 && ny > .35) return 'tail';
  return 'torso';
}
/** Solid volume per region from surface sample points: columns on an xz grid, filled between the lowest and highest
 * sample in each column. Exact under uniform scaling (×2 size -> ×8 volume). */
export function regionVolumes(points: readonly { x: number; y: number; z: number }[], min: { x: number; y: number; z: number }, size: { x: number; y: number; z: number }, grid = 24): Part[] {
  const cols = new Map<string, [number, number]>(), cell = (size.x / grid) * (size.z / grid);
  for (const p of points) {
    const nx = (p.x - min.x) / size.x, ny = (p.y - min.y) / size.y, nz = (p.z - min.z) / size.z, r = regionOf(nx, ny, nz);
    const k = `${r}:${Math.min(grid - 1, Math.floor(nx * grid))}:${Math.min(grid - 1, Math.floor(nz * grid))}`, c = cols.get(k);
    if (c) { c[0] = Math.min(c[0], p.y); c[1] = Math.max(c[1], p.y); } else cols.set(k, [p.y, p.y]);
  }
  const vol: Record<string, number> = {};
  for (const [k, [lo, hi]] of cols) { const r = k.split(':')[0]; vol[r] = (vol[r] ?? 0) + cell * (hi - lo); }
  return Object.entries(vol).map(([region, volume]) => ({ region, volume }));
}
