/**
 * Callers and level-driven pant / chew (T-0017). Far callers are a pure function of seed, position and hour.
 * Nothing is stored. A clip starts only when the listener is inside the mixer's cull of a caller whose phase
 * crosses a boundary. Pant and chew are the same module because they replace the other fixed one-shots.
 */
import { stream } from '../proc/rng';
import { WORLD_SEED } from './world';
import { DAY_OF_YEAR, sunPosition } from './timeOfDay';
import { surfaceAt } from './stages/surfaceAt';
import { standAt } from './stand';
import { modeSpeed, STAMINA_UP } from './wolfModes';

/** Habitat at one point. A lake is a stage-2b body of kind 'lake' (>= 2 ha). Ponds, rivers and the base plane are not. */
export interface Habitat { lake: boolean; areaHa: number; land: boolean; canopy: number }
export type CallerKind = 'loon' | 'woodpecker';
export interface Caller { id: string; kind: CallerKind; x: number; z: number; clip: 'loon' | 'woodpecker' }

export const CALLERS = {
  cell: 64, // m. One Bernoulli draw per cell. The hearing cull is 45 m, so a query touches a handful of cells.
  /** Common loon territory 0.7 km² (McIntyre 1988, The Common Loon, cited by Mennill 2014, Waterbirds, doi:10.1675/063.037.sp105). */
  loonTerritoryHa: 70,
  /** Wails per territorial pair per night and per day (Mennill 2014: 166.8 ± 28.1 night, 9.3 ± 28.1 day). */
  loonWailsNight: 166.8,
  loonWailsDay: 9.3,
  /** Hairy woodpecker, eastern North America average 12.5 pairs/km² (Evans & Conner 1979, via Minnesota Breeding Bird Atlas). */
  woodpeckerPerHa: 0.125,
  /** Slow end of 4–9 drums/min while breeding (Pfeiffer, Northern Woodlands, "Drumroll, Please"). The drum itself is
   *  26.1 ± 1.1 beats/s, about one second (Dodenhoff, Stark & Johnson 1998, Condor 100:350). */
  woodpeckerDrumsPerMin: 4,
};

/** One uniform in [0, 1). mulberry32 via stream: a raw FNV ratio on these cell keys over-fills the low tail and would place too many callers. */
const unit = (s: string) => stream(0, s)();
const nightMemo = new Map<number, number>();
/** Hours in the local night (solar elevation < 0 at the half hour). Mennill's night is sunset to sunrise. */
export function nightHours(day = DAY_OF_YEAR) {
  let n = nightMemo.get(day); if (n !== undefined) return n; n = 0;
  for (let h = 0; h < 24; h++) if (sunPosition(h + .5, day).elevation < 0) n++;
  nightMemo.set(day, n); return n;
}
/** Seconds between calls. Infinity when that species is silent at this hour. `rate` is the bird-activity slider. */
export function callGap(kind: CallerKind, hour: number, day = DAY_OF_YEAR, rate = 1) {
  if (!(rate > 0)) return Infinity;
  const night = sunPosition(hour, day).elevation < 0;
  if (kind === 'loon') {
    const nh = nightHours(day), dh = 24 - nh;
    const hours = night ? (nh || 24) : (dh || 24);
    return hours * 3600 / (night ? CALLERS.loonWailsNight : CALLERS.loonWailsDay) / rate;
  }
  if (night) return Infinity; // woodpeckers drum by day
  return 60 / CALLERS.woodpeckerDrumsPerMin / rate;
}
/** Call times in (t0, t1], phase-locked to the caller id. The gap is the published interval, not a stored timer. */
export function callTimes(id: string, kind: CallerKind, t0: number, t1: number, hour: number, day = DAY_OF_YEAR, rate = 1) {
  const g = callGap(kind, hour, day, rate);
  if (!Number.isFinite(g) || g <= 0 || !(t1 > t0)) return [] as number[];
  const phase = unit(`phase:${id}`) * g, out: number[] = [];
  const k0 = Math.floor((t0 + phase) / g) + 1, k1 = Math.floor((t1 + phase) / g);
  for (let k = k0; k <= k1; k++) { const t = k * g - phase; if (t > t0 && t <= t1) out.push(t); }
  return out;
}

/** One cell. The jittered point's own habitat decides the species, so a loon is on lake water and a woodpecker is on treed land. */
export function callersInCell(ix: number, iz: number, habitatAt: (x: number, z: number) => Habitat, seed = WORLD_SEED): Caller[] {
  const x = (ix + unit(`call:${seed}:${ix}:${iz}:x`)) * CALLERS.cell, z = (iz + unit(`call:${seed}:${ix}:${iz}:z`)) * CALLERS.cell;
  const h = habitatAt(x, z), areaHa = CALLERS.cell * CALLERS.cell / 10000, out: Caller[] = [];
  if (h.lake && h.areaHa >= 2 && Number.isFinite(h.areaHa)) {
    const pairs = Math.max(1, Math.round(h.areaHa / CALLERS.loonTerritoryHa));
    if (unit(`loon:${seed}:${ix}:${iz}`) < Math.min(1, pairs * areaHa / h.areaHa)) out.push({ id: `loon:${seed}:${ix}:${iz}`, kind: 'loon', x, z, clip: 'loon' });
  } else if (h.land && h.canopy > 0 && unit(`woodpecker:${seed}:${ix}:${iz}`) < CALLERS.woodpeckerPerHa * areaHa) {
    out.push({ id: `woodpecker:${seed}:${ix}:${iz}`, kind: 'woodpecker', x, z, clip: 'woodpecker' });
  }
  return out;
}
/** Callers within `hear` metres. Far callers are not instantiated. */
export function callersNear(x: number, z: number, hear: number, habitatAt: (x: number, z: number) => Habitat, seed = WORLD_SEED) {
  const c = CALLERS.cell, i0 = Math.floor((x - hear) / c), i1 = Math.floor((x + hear) / c), j0 = Math.floor((z - hear) / c), j1 = Math.floor((z + hear) / c);
  const out: Caller[] = [];
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) for (const caller of callersInCell(i, j, habitatAt, seed)) if (Math.hypot(caller.x - x, caller.z - z) <= hear) out.push(caller);
  return out;
}
/** Staged lakes and the stand canopy. Same surface the rest of the game reads. */
export function habitatOf(x: number, z: number, seed = WORLD_SEED): Habitat {
  const p = surfaceAt(x, z, seed), lake = p.lake?.kind === 'lake', land = !p.lake && !p.river;
  return { lake, areaHa: lake ? p.lake!.areaHa : 0, land, canopy: land ? standAt(x, z, p.wetness, seed).canopy : 0 };
}

/** Dog panting locks to the resonant frequency of the chest, 5.33 ± 0.7 Hz (Crawford 1962, J Appl Physiol 17:249). */
export const PANT_HZ = 5.33;
/** Phrase length in resonant cycles. Game calibration: long enough that a 30 Hz frame does not quantize the gap past the gate,
 *  short enough that the one pant voice (mixer cap 1) keeps sounding while the level says pant. The frequency is the measurement. */
export const PANT_CYCLES = 4;
export const pantGap = () => PANT_CYCLES / PANT_HZ;
/** Pant while the gait is at or above a run, or while stamina is still under the recovery line the stamina model already uses. */
export function shouldPant(speed: number, stamina: number, maxStamina: number) {
  return speed >= modeSpeed.run || (maxStamina > 0 && stamina / maxStamina < STAMINA_UP);
}
/** Chews in one meal: one per bite mass. A wolf's hare bite is the whole hare, so one chew at the eat, not 500 ms later. */
export function mealChews(biteKg: number, eatenKg: number) {
  if (!(biteKg > 0) || !(eatenKg > 0)) return 0;
  return Math.ceil(eatenKg / biteKg - 1e-9);
}
