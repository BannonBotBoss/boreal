/**
 * Log arena (T-0018). One fallen bole decays by Olson's single exponential (Olson 1963, Ecology 44:322),
 * M(t) = M0 exp(−k t). k is the Picea abies mass-loss rate, then site factors from the transactions below.
 * The mesh, the litter sprites and the nurse seedlings stay with T-0007. This file is the rates, the decay
 * class and the mass that leaves the bole for the floor.
 *
 * Closed form. No per-frame step. A cell reads it.
 */
import { frustum } from './mass';
import { COMPOSITIONS, MATERIALS } from './materials';
import { SATURATED_WET } from './flora/site';
import { hash, random } from '../proc/rng';
import { TRANSACTIONS } from './transactions';
import { WORLD_SEED } from './world';

/** Picea abies logs, St. Petersburg: 50% of the mass gone at 19 years.
 *  Yatskov, Harmon & Krankina 2003, Can. J. For. Res. 33:1211, time-period table. */
export const LOG_HALF_LIFE_YR = 19;
/** Olson 1963. The 19-year half-life is a field rate (it already includes that climate), so it is not
 *  multiplied by the CBM Q10 again. */
export const LOG_K_REF = Math.log(2) / LOG_HALF_LIFE_YR;
/** Old-growth Norway spruce: the last decay class (8 of 8) at 100 years after fall.
 *  Storaunet & Rolstad 2002, Can. J. For. Res. 32:1801. Their regression is linear in class.
 *  This chain has five classes, so each step is 100/4 years at the reference rate. */
export const LOG_CLASS5_YR = 100;
/** Black spruce downed wood, respiration limited below this moisture (g/g dry).
 *  Bond-Lamberty, Wang & Gower 2002, J. Geophys. Res. 107(D23), the 43.1% breakpoint. */
export const LOG_MC_BREAK = 0.431;
/** Fiber saturation, below which decay fungi cannot use the water in the wood.
 *  Griffin 1977, as cited by Bond-Lamberty et al. 2002. */
export const LOG_MC_FIBER = 0.30;
/** Decay class III black spruce downed wood, mean moisture 1.42 g/g.
 *  Bond-Lamberty et al. 2002, Table 3. */
export const LOG_MC_CLASS3 = 1.42;
/** Mean annual k (1/yr) from respiration, well drained and poorly drained black spruce.
 *  Bond-Lamberty et al. 2002, §3.4: 0.034 and 0.027. The ratio is the oxygen factor.
 *  These are not the mass-loss k (that is LOG_K_REF); only the ratio is used. */
export const LOG_K_WELL = 0.034;
export const LOG_K_POOR = 0.027;
export const LOG_OXYGEN_POOR = LOG_K_POOR / LOG_K_WELL;
/** Invertebrates are credited with 10–20% of early wood loss. The midpoint is the share used here.
 *  Ulyshen 2016, Biol. Rev. 91:70. The studies he reviews are mostly the first 2–3 years; 3 is that upper end. */
export const LOG_INSECT_SHARE = 0.15;
export const LOG_INSECT_YEARS = 3;
/** Picea spp. decay class 5, 0.108 g/cm³. Yatskov et al. 2003, decay-class density table. Floor bulk. */
export const LOG_FLOOR_BULK = 108;
/** Cylinder in render/geometry.ts (.32 to .43 m radius, 4.4 m). The same radii core/ground uses for the solid. */
export const LOG_R0 = 0.43;
export const LOG_R1 = 0.32;
export const LOG_LENGTH = 4.4;

export interface LogSite { wet: number; light: number; age: number }
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/** Wood moisture (g/g dry) from site wetness, then sun.
 *  Wetness 0 is fiber saturation (0.30). Wetness 1 is the class III mean (1.42). The straight line between
 *  those two measured ends is the map. [game calibration] full sun dries that moisture to fiber saturation;
 *  Yatskov et al. 2003 found no extra temperature effect on k among boreal sites, so sun is drying only. */
export function woodMoisture(wet: number, light: number): number {
  const shaded = LOG_MC_FIBER + (LOG_MC_CLASS3 - LOG_MC_FIBER) * clamp01(wet);
  return shaded + (LOG_MC_FIBER - shaded) * clamp01(light);
}
/** 1 at and above the 43.1% breakpoint, proportional below it. */
export function moistureFactor(wet: number, light: number): number {
  return Math.min(1, woodMoisture(wet, light) / LOG_MC_BREAK);
}
/** Poorly drained sites respire at 0.027/0.034 of well-drained sites. The cut is SATURATED_WET. */
export function oxygenFactor(wet: number): number {
  return clamp01(wet) > SATURATED_WET ? LOG_OXYGEN_POOR : 1;
}
/** 0.15 while the wood is moist and aerobic (the field rate already includes them). 0 when it is too dry
 *  or poorly aerated, and the early rate then drops by that share. */
export function insectShare(wet: number, light: number): number {
  const active = woodMoisture(wet, light) >= LOG_MC_BREAK && oxygenFactor(wet) === 1;
  return active ? LOG_INSECT_SHARE : 0;
}

export interface Arena {
  wet: number; light: number; age: number;
  mc: number; moisture: number; oxygen: number; insects: number;
  /** Rate after the early window, and the rate inside it. Equal when insects are active. */
  kLate: number; kEarly: number; k: number;
  remain: number; klass: 1 | 2 | 3 | 4 | 5;
}
const SRC_WATER = 'Bond-Lamberty, Wang & Gower 2002, JGR 107(D23): respiration limited below 43.1% moisture; fiber saturation 30% (Griffin 1977); class III mean 1.42 g/g (their Table 3). Full sun dries to fiber saturation [game calibration].';
const SRC_OXYGEN = 'Bond-Lamberty et al. 2002, §3.4: poorly drained black spruce k 0.027 /yr, well drained 0.034 /yr. Applied where site wetness exceeds SATURATED_WET.';
const SRC_SUN = 'Yatskov, Harmon & Krankina 2003, Can. J. For. Res. 33:1211: among boreal sites, temperature did not correlate with k. Sun enters as drying inside the water row, not as a second Q10.';
const SRC_INSECTS = 'Ulyshen 2016, Biol. Rev. 91:70: invertebrates credited with 10–20% of early wood loss (midpoint 0.15), mostly in the first 2–3 years.';

TRANSACTIONS.add({
  a: 'log', b: 'water', verb: 'wet', name: 'wet', needsContact: false, source: SRC_WATER,
  run: (s: LogSite) => moistureFactor(s.wet, s.light),
});
TRANSACTIONS.add({
  a: 'log', b: 'oxygen', verb: 'air', name: 'air', needsContact: false, source: SRC_OXYGEN,
  run: (s: LogSite) => oxygenFactor(s.wet),
});
TRANSACTIONS.add({
  a: 'log', b: 'sun', verb: 'sun', name: 'sun', needsContact: false, source: SRC_SUN,
  run: (s: LogSite) => clamp01(s.light),
});
TRANSACTIONS.add({
  a: 'log', b: 'insects', verb: 'feed', name: 'feed', needsContact: false, source: SRC_INSECTS,
  run: (s: LogSite) => insectShare(s.wet, s.light),
});

/** Years at the reference rate that leave this fraction. Linear class, five steps across 100 years. */
export function decayClass(remain: number): 1 | 2 | 3 | 4 | 5 {
  const r = Math.min(1, Math.max(1e-15, remain));
  const tEff = -Math.log(r) / LOG_K_REF;
  const c = 1 + 4 * Math.min(1, tEff / LOG_CLASS5_YR);
  return Math.min(5, Math.max(1, Math.floor(c))) as 1 | 2 | 3 | 4 | 5;
}
function remainOf(age: number, kEarly: number, kLate: number): number {
  const a = Math.max(0, age), t1 = Math.min(a, LOG_INSECT_YEARS);
  return Math.exp(-kEarly * t1) * Math.exp(-kLate * (a - t1));
}
/** Site factors from the registry, then the closed-form fraction and class. */
export function arenaOf(site: LogSite): Arena {
  const wet = clamp01(site.wet), light = clamp01(site.light), age = Math.max(0, site.age);
  const s = { wet, light, age };
  const moisture = TRANSACTIONS.run('log', 'water', s, 'wet');
  const oxygen = TRANSACTIONS.run('log', 'oxygen', s, 'air');
  TRANSACTIONS.run('log', 'sun', s, 'sun');
  const insects = TRANSACTIONS.run('log', 'insects', s, 'feed');
  const kLate = LOG_K_REF * moisture * oxygen;
  const kEarly = insects > 0 ? kLate : kLate * (1 - LOG_INSECT_SHARE);
  const remain = remainOf(age, kEarly, kLate);
  return {
    wet, light, age, mc: woodMoisture(wet, light), moisture, oxygen, insects,
    kLate, kEarly, k: age < LOG_INSECT_YEARS ? kEarly : kLate, remain, klass: decayClass(remain),
  };
}

export interface Floor {
  W: number; D: number; respB: number; respF: number; below: number;
}
/** Bole W and floor stock D over one interval of constant rate. pass is the share of each loss that
 *  stays in the next pool (CBM medium toNext); the rest of that loss is CO₂. */
function segment(W0: number, D0: number, aw: number, dt: number, kFloor: number, pass: number, acc: Floor) {
  if (!(dt > 0)) return;
  const eA = Math.exp(-aw * dt), eF = Math.exp(-kFloor * dt);
  const W = W0 * eA, lost = W0 - W;
  let D: number;
  if (Math.abs(kFloor - aw) < 1e-8) D = (D0 + pass * aw * W0 * dt) * eF;
  else D = D0 * eF + pass * aw * W0 * (eA - eF) / (kFloor - aw);
  if (D < 0) D = 0;
  const exited = D0 + pass * lost - D;
  acc.W = W; acc.D = D;
  acc.respB += (1 - pass) * lost;
  acc.respF += (1 - pass) * exited;
  acc.below += pass * exited;
}
/** Mass still in the bole (W), still in the floor wood (D), respired from each, and passed below the floor. */
export function integrateFloor(m0: number, age: number, kEarly: number, kLate: number, kFloor: number, pass: number): Floor {
  const acc: Floor = { W: m0, D: 0, respB: 0, respF: 0, below: 0 };
  const a = Math.max(0, age), t1 = Math.min(a, LOG_INSECT_YEARS);
  segment(acc.W, acc.D, kEarly, t1, kFloor, pass, acc);
  segment(acc.W, acc.D, kLate, a - t1, kFloor, pass, acc);
  return acc;
}
export function budget(m0: number, site: LogSite, kFloor: number, pass: number) {
  const a = arenaOf(site);
  return { ...a, ...integrateFloor(m0, a.age, a.kEarly, a.kLate, kFloor, pass) };
}

/** Dry kg. Water in the composition is not wood. Volume is the generated frustum × scale³. */
export function logDryMass(scale: number): number {
  const mix = COMPOSITIONS.log.body;
  const dry = MATERIALS.spruceWood * mix.spruceWood + MATERIALS.bark * mix.bark;
  return frustum(LOG_R0, LOG_R1, LOG_LENGTH) * scale ** 3 * dry;
}
/** Uniform draw of when the bole fell, as a fraction of the stand age. Same seed, same fall. */
export function fallFraction(seed: number, worldSeed = WORLD_SEED): number {
  return random(hash(`log-fall:${worldSeed}:${seed}`))();
}
/** Ground cells the axis crosses. Mass is split across them so none is dropped. Cell size is the ground cell. */
export function cellsUnder(x: number, z: number, rotation: number, scale: number, cell = 2): string[] {
  const half = LOG_LENGTH / 2 * scale, hx = Math.cos(rotation) * half, hz = -Math.sin(rotation) * half;
  const steps = Math.max(1, Math.ceil((LOG_LENGTH * scale) / cell));
  const keys = new Set<string>();
  for (let i = 0; i <= steps; i++) {
    const t = i / steps, px = x - hx + 2 * hx * t, pz = z - hz + 2 * hz * t;
    keys.add(`${Math.floor(px / cell)}:${Math.floor(pz / cell)}`);
  }
  return [...keys];
}

/** Elapsed game years. ground.ts registers the clock. Until then a log uses the stand age only. */
let yearsOf = () => 0;
export function setLogYears(fn: () => number) { yearsOf = fn; }
export const logYears = () => yearsOf();
