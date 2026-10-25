/**
 * Clover resource field and sunlit clearings (Grok Bot, T-0009). core/fields.ts. Pure: no three.js, no DOM.
 * Ported from grok/rabbit-clover src/core/clover.ts. groundLight is the instantaneous W/m² field (siteAt light × solar shortwave).
 * The closed-form sun tables stay on lighting().day so a lazy read matches stepping regrowTransaction.
 *  - CLEARINGS: a low-frequency value-noise mask (two octaves, ~70 m and ~28 m cells) that thins the tree entities
 *    (core/population), the look-only far trees (core/flora/stands) and the stand's background shade (core/flora/site), so the
 *    forest has sunlit gaps. Real boreal stands are a mosaic of closed canopy and gaps from windthrow, insects and small fires
 *    (gap fraction ~10-25 % in old stands: Kneeshaw & Bergeron 1998, Ecology 79:783) [verify]; share here is game calibration.
 *  - CLOVER patches grow only where sunlight reaches the ground (site light from the same shared site model the ground flora uses).
 *  - Units map to real biomass (Matthew's 10 000 units per m^2 kept as the full-patch density): 1 unit = 15 mg dry matter of
 *    edible leaf (lamina + petiole), so a full patch holds 150 g DM/m^2 (1.5 t/ha; 'Kopu' white clover stood 1.6 t DM/ha in
 *    spring: Olykan et al. 2021, J. NZ Grasslands 83, doi:10.33584/jnzg.2021.83.3494). One unit is about half a summer leaf (lamina 15-20 mg + petiole
 *    6-11 mg: J. NZ Grasslands 83, 2021, doi:10.33584/jnzg.2021.83.3498).
 *  - Residual: grazing takes leaves, never the stolons and growing points that lie on the ground ("the stolon stays close to
 *    the ground so is rarely grazed": DairyNZ; above-ground stolon 50-55 g DM/m^2: Lincoln College stocking-rate study, hdl:10182/3015).
 *    A patch at 0 units is grazed out (cannot be grazed) but keeps its stolon, and regrows from it.
 *  - Regrowth is a transaction between the patch's stolons and sunlight, in world (real) seconds like every other growth field:
 *    summer white clover grows 50-70 kg DM/ha/day (10 in a mild winter: irrigated swards, Aust. J. Exp. Agric. 45:1577, 2005), so
 *    6 g DM/m^2/day here, which refills a bare patch in ~25 days, matching the 21-28 days after grazing (Miller et al. 1951,
 *    via UC SAREP). Scaled by site light (shade-intolerant), by daylight (none at night), and by temperature (no growth below
 *    5 C: development base < 4 C, Grass Forage Sci. 2006, doi:10.1111/j.1365-2494.2006.00553.x; clover needs ~10 C soil, Teagasc; full rate from 20 C, its
 *    optimum being ~5 C above ryegrass, DairyNZ). Winter frost/snow therefore stops it; drought is not modelled yet.
 *  - Each patch carries a short causal why (core/why): sunned -> sprouted -> grew, then grazed by a hare / regrew.
 *  - Both are rows of the transaction registry (core/transactions): 'eater | clover' graze runs only while CONTACTS has the
 *    eater's feed contact with the patch; 'clover | sun' regrow runs lazily: a patch stores only its units at the world second
 *    it was last grazed (the grazed delta, CLOVER_STATE), and anyone reading it gets units + the closed-form sun-weighted
 *    seconds since then (sunSeconds: per-game-day cumulative tables of daylight x temperature factor). Nothing ticks per frame,
 *    and a patch left for a week of real time is exactly as grown as one watched for a week. Ungrazed patches are full and store
 *    nothing. The grazed map is saved (SAVE_KEY_CLOVER) and captured by the rewind snapshot.
 */
import { hash, random } from '../proc/rng';
import { clamp01, smoothstep } from '../proc/math';
import { WORLD_SEED } from './world';
import { withTip, type Why } from './why';
import { lighting, sunPosition, DAY_OF_YEAR, DAY, START_HOUR, REAL_SECONDS_PER_GAME_HOUR } from './timeOfDay';
import { climate, solar, shortwave } from './weather';
import { siteAt } from './flora/site';
import { TRANSACTIONS, kindOf, type TransactionRow } from './transactions';

export const CLEARINGS = { cell: 70, cell2: 28, mix: .35, from: .6, to: .74 };
const lattice = (i: number, j: number, salt: string, seed: number) => hash(`clearing:${salt}:${seed}:${i}:${j}`) / 4294967296;
function valueNoise(x: number, z: number, cell: number, salt: string, seed: number) {
  const fx = x / cell, fz = z / cell, i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j, su = u * u * (3 - 2 * u), sv = v * v * (3 - 2 * v);
  const a = lattice(i, j, salt, seed), b = lattice(i + 1, j, salt, seed), c = lattice(i, j + 1, salt, seed), d = lattice(i + 1, j + 1, salt, seed);
  return a + (b - a) * su + (c - a) * sv + (a - b - c + d) * su * sv;
}
/** 0 under closed forest .. 1 in the middle of a clearing (pure, seeded). */
export function clearingAt(x: number, z: number, seed = WORLD_SEED) {
  const n = (1 - CLEARINGS.mix) * valueNoise(x, z, CLEARINGS.cell, 'a', seed) + CLEARINGS.mix * valueNoise(x + 913, z - 377, CLEARINGS.cell2, 'b', seed);
  return smoothstep(CLEARINGS.from, CLEARINGS.to, n);
}

/** Clover data (white clover, Trifolium repens: creeping stolons, trifoliate leaves 1-2 cm on 5-10 cm petioles; open, sunny
 *  ground, shade-intolerant: FNA / FEIS Trifolium repens) [verify]. Units and rates are Matthew's spec. */
export const CLOVER = {
  unitsPerM2: 10000, mgPerUnit: 15, // full patch = 150 g DM/m^2 edible leaf; eating rate and energy per unit belong to the eater
  stolonGPerM2: 50, // ungrazable stolons + growing points (g DM/m^2): the residual a patch regrows from
  growth: { gPerM2Day: 6, tBase: 5, tOpt: 20 }, // g DM/m^2/day at full sun and >= tOpt (C); 0 at <= tBase
  tile: 16, grid: 3, keep: .55, radius: [.5, 1.4] as [number, number],
  /** site light (0..1, core/flora/site) where clover starts and where it is fully suitable; wet/slope cut-offs */
  light: [.55, .85] as [number, number], wetMax: [.75, .95] as [number, number], slopeMax: 25,
};
export interface CloverPatch { key: string; x: number; z: number; r: number; light: number; max: number; /** units at world second `at` (read through unitsAt / field.unitsOf) */ units: number; at: number; /** g DM of stolon left on the ground */ stolon: number; why: Why }
export interface CloverSite { water: boolean; light: number; wet: number; rock: number; slopeDeg: number }
/** How suitable a site is for clover: sunlit, not water / saturated / bare rock / steep. */
export function cloverSuitability(s: CloverSite) {
  if (s.water || s.slopeDeg > CLOVER.slopeMax) return 0;
  return smoothstep(CLOVER.light[0], CLOVER.light[1], s.light) * (1 - smoothstep(CLOVER.wetMax[0], CLOVER.wetMax[1], s.wet)) * (1 - s.rock);
}
export const CLOVER_WHY: Why = [{ step: 'sunned' }, { step: 'sprouted' }, { step: 'grew' }];
/** Patches of one tile: a jittered grid of candidates, each kept with the suitability where it lands (seeded). */
export function cloverPatchesInTile(tx: number, tz: number, site: (x: number, z: number) => CloverSite, blocked?: (x: number, z: number, r: number) => boolean, seed = WORLD_SEED): CloverPatch[] {
  const r = random(hash(`clover:${seed}:${tx}:${tz}`)), out: CloverPatch[] = [], n = Math.round(CLOVER.tile / CLOVER.grid);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const x = tx * CLOVER.tile + (i + r()) * CLOVER.grid, z = tz * CLOVER.tile + (j + r()) * CLOVER.grid, keep = r(), rad = CLOVER.radius[0] + r() * (CLOVER.radius[1] - CLOVER.radius[0]);
    const s = site(x, z), suit = cloverSuitability(s); // every draw first: masking never shifts the stream
    if (keep >= suit * CLOVER.keep || blocked?.(x, z, rad)) continue;
    const max = Math.round(Math.PI * rad * rad * CLOVER.unitsPerM2);
    out.push({ key: `clover:${tx}:${tz}:${i}:${j}`, x, z, r: rad, light: clamp01(s.light), max, units: max, at: 0, stolon: Math.PI * rad * rad * CLOVER.stolonGPerM2, why: CLOVER_WHY.map(w => ({ ...w })) });
  }
  return out;
}
/** Graze transaction (eater <-> clover patch, while in contact): takes up to `units`, never below 0; returns units eaten. */
export function grazeTransaction(p: CloverPatch, units: number, by: string) {
  const eaten = Math.min(p.units, Math.max(0, units));
  if (eaten > 0) { p.units -= eaten; p.why = withTip(p.why, { step: 'grazed', by }); }
  return eaten;
}
/** The grazed deltas: patch key -> its state at its last graze. Everything else about a patch is derived from the seed. */
export interface CloverDelta { units: number; at: number; stolon: number; by: string }
export const SAVE_KEY_CLOVER = 'boreal.clover.v1';
export const CLOVER_STATE = new Map<string, CloverDelta>();
export const cloverStateJSON = () => JSON.stringify([...CLOVER_STATE]);
export function loadCloverState(json: string | null) { CLOVER_STATE.clear(); if (!json) return; try { for (const [k, d] of JSON.parse(json) as [string, CloverDelta][]) CLOVER_STATE.set(k, d); } catch { /* corrupt save: start full */ } }
const dayFrac = new Map<number, number>();
/** Share of a day (0..1) that is daylight on `day` (the same lighting() blend the game's daylight uses), memoised. */
export function daylightFraction(day = DAY_OF_YEAR) {
  let v = dayFrac.get(day); if (v !== undefined) return v; v = 0;
  for (let i = 0; i < 96; i++) v += lighting(sunPosition((i + .5) / 4, day).elevation).day / 96;
  dayFrac.set(day, v = Math.max(.01, v)); return v;
}
/** Temperature factor of growth: 0 at <= tBase, 1 at >= tOpt. */
export const growthTemp = (tC: number) => clamp01((tC - CLOVER.growth.tBase) / (CLOVER.growth.tOpt - CLOVER.growth.tBase));
/** Units per world second the patch's stolons add now: the day's growth (g/m^2/day x area) spread over the day's daylight
 *  seconds, x daylight now x site light x temperature factor. 0 without stolon, at night, in the cold. */
export function regrowthRate(p: CloverPatch, daylight: number, tC: number, day = DAY_OF_YEAR) {
  if (p.stolon <= 0) return 0;
  const area = p.max / CLOVER.unitsPerM2, perDay = CLOVER.growth.gPerM2Day * 1000 / CLOVER.mgPerUnit * area;
  return perDay * clamp01(daylight) * p.light * growthTemp(tC) / (daylightFraction(day) * 86400);
}
/** Regrowth transaction (clover stolons <-> sunlight, world seconds): see regrowthRate. */
export function regrowTransaction(p: CloverPatch, dt: number, daylight: number, tC: number = CLOVER.growth.tOpt, day = DAY_OF_YEAR) {
  if (p.units >= p.max) return 0;
  const add = Math.min(p.max - p.units, Math.max(0, dt) * regrowthRate(p, daylight, tC, day));
  if (add > 0) { p.units += add; if (p.why[p.why.length - 1]?.step === 'grazed') p.why = withTip(p.why, { step: 'regrew', by: 'sunlight' }); }
  return add;
}
/** World seconds per game day and the slots of the per-day sun table. */
const DAY_S = 24 * REAL_SECONDS_PER_GAME_HOUR, SLOTS = 96, SLOT_S = DAY_S / SLOTS;
const sunTables = new Map<string, Float64Array>();
/** Cumulative sun-weighted seconds through game day `d` (day index from the clock origin): slot i holds the integral up to
 *  its end of daylight x growthTemp(climate) / daylightFraction, so a full day sums to ~DAY_S x (mean temperature factor). */
function sunTable(d: number) {
  const k = `${d}:${DAY.offset}`; let t = sunTables.get(k); if (t) return t;
  t = new Float64Array(SLOTS + 1); const doy = DAY_OF_YEAR + d, frac = daylightFraction(doy);
  for (let i = 0; i < SLOTS; i++) { const h = (i + .5) * 24 / SLOTS;
    t[i + 1] = t[i] + SLOT_S * lighting(sunPosition(h, doy).elevation).day * growthTemp(climate(doy, h).tC) / frac; }
  if (sunTables.size > 2000) sunTables.clear(); sunTables.set(k, t); return t;
}
/** Sun-weighted world seconds between w0 and w1 (closed form over the tables; the clock maps world seconds to game days the
 *  same way hourAt/dayAt do). `cap`: stop once this much is reached (a patch cannot grow past full). */
export function sunSeconds(w0: number, w1: number, cap = Infinity) {
  if (!(w1 > w0)) return 0;
  const g = (w: number) => (START_HOUR + DAY.offset) * REAL_SECONDS_PER_GAME_HOUR + w; // world seconds since game-day-0 midnight
  const at = (gs: number) => { const d = Math.floor(gs / DAY_S), u = (gs - d * DAY_S) / SLOT_S, i = Math.min(SLOTS - 1, Math.floor(u)), t = sunTable(d); return { d, v: t[i] + (t[i + 1] - t[i]) * (u - i) }; };
  const a = at(g(w0)), b = at(g(w1));
  if (a.d === b.d) return b.v - a.v;
  let s = sunTable(a.d)[SLOTS] - a.v;
  for (let d = a.d + 1; d < b.d && s < cap; d++) s += sunTable(d)[SLOTS];
  return s < cap ? s + b.v : s;
}
/** Units per sun-weighted second for a patch (regrowthRate at full daylight and temperature). */
const unitsPerSunSecond = (p: CloverPatch) => p.stolon <= 0 ? 0 : CLOVER.growth.gPerM2Day * 1000 / CLOVER.mgPerUnit * (p.max / CLOVER.unitsPerM2) * p.light / 86400;
/** Units of a patch at world second `now`: the closed form of the regrow row. */
export function unitsAt(p: CloverPatch, now: number) {
  if (p.units >= p.max || now <= p.at) return p.units;
  const k = unitsPerSunSecond(p); if (k <= 0) return p.units;
  return Math.min(p.max, p.units + k * sunSeconds(p.at, now, (p.max - p.units) / k));
}
/** Regrow row (clover | sun): bring a patch's stored state up to `now`. */
export const REGROW_ROW: TransactionRow<{ p: CloverPatch; now: number }> = {
  a: 'clover', b: 'sun', name: 'regrow', needsContact: false,
  source: 'white clover 6 g DM/m^2/day summer (Aust. J. Exp. Agric. 45:1577); base 5 C, full 20 C; site light; refills in ~25 d (Miller et al. 1951)',
  run({ p, now }) { const u = unitsAt(p, now), add = u - p.units; p.units = u; p.at = Math.max(p.at, now);
    if (add > 0 && p.why[p.why.length - 1]?.step === 'grazed') p.why = withTip(p.why, { step: 'regrew', by: 'sunlight' }); return add; },
};
/** Graze row (eater | clover), one per eater kind, run only while CONTACTS has the eater's feed contact with the patch. */
export function cloverGrazeRow(eater: string): TransactionRow<{ p: CloverPatch; units: number; by: string; now: number }> {
  return { a: eater, b: 'clover', name: 'graze', needsContact: true, source: 'eater diet (core/agent/species): bite size x rate; patch residual = stolon',
    run({ p, units, by, now }) { REGROW_ROW.run({ p, now }); const e = grazeTransaction(p, units, by);
      if (e > 0) CLOVER_STATE.set(p.key, { units: p.units, at: p.at, stolon: p.stolon, by }); return e; } };
}
TRANSACTIONS.add(REGROW_ROW);
/** Live clover around the player: tiles made on demand (one per call to `ensure`), state kept while loaded. */
export function createCloverField(site: (x: number, z: number) => CloverSite, blocked?: (x: number, z: number, r: number) => boolean, seed = WORLD_SEED, now: () => number = () => 0) {
  const tiles = new Map<string, CloverPatch[]>(), byKey = new Map<string, CloverPatch>(); let revision = 0;
  const tkey = (i: number, j: number) => `${i}:${j}`;
  /** settle on read: whoever gets a patch gets it grown up to now */
  const settle = (p?: CloverPatch) => { if (p) REGROW_ROW.run({ p, now: now() }); return p; };
  return {
    /** Builds at most `budget` missing tiles within `radius` of (x, z), nearest first; drops tiles beyond 2x radius. */
    ensure(x: number, z: number, radius: number, budget = 1) {
      const i0 = Math.floor((x - radius) / CLOVER.tile), i1 = Math.floor((x + radius) / CLOVER.tile), j0 = Math.floor((z - radius) / CLOVER.tile), j1 = Math.floor((z + radius) / CLOVER.tile);
      const missing: [number, number, number][] = [];
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) if (!tiles.has(tkey(i, j))) missing.push([i, j, Math.hypot((i + .5) * CLOVER.tile - x, (j + .5) * CLOVER.tile - z)]);
      missing.sort((a, b) => a[2] - b[2]);
      for (const [i, j] of missing.slice(0, budget)) { const ps = cloverPatchesInTile(i, j, site, blocked, seed);
        for (const p of ps) { const d = CLOVER_STATE.get(p.key); if (d) { p.units = Math.min(p.max, d.units); p.at = d.at; p.stolon = d.stolon; p.why = withTip(p.why, { step: 'grazed', by: d.by }); } else p.at = now(); }
        tiles.set(tkey(i, j), ps); for (const p of ps) byKey.set(p.key, p); revision++; }
      for (const [k, ps] of tiles) { const [i, j] = k.split(':').map(Number); if (Math.hypot((i + .5) * CLOVER.tile - x, (j + .5) * CLOVER.tile - z) > radius * 2 + CLOVER.tile) { tiles.delete(k); for (const p of ps) byKey.delete(p.key); revision++; } }
      return missing.length - Math.min(budget, missing.length);
    },
    /** Units of a patch now (lazy regrowth; does not write). */
    unitsOf: (p: CloverPatch) => unitsAt(p, now()),
    /** Re-apply the grazed deltas (after a load or a rewind restore) to loaded patches. */
    reload() { const t = now(); for (const p of byKey.values()) { const d = CLOVER_STATE.get(p.key); if (d) { p.units = Math.min(p.max, d.units); p.at = d.at; p.stolon = d.stolon; } else { p.units = p.max; p.at = t; } } revision++; },
    /** Patch under (x, z) (within its radius + pad) with units left, else undefined. */
    at(x: number, z: number, pad = 0, edible = true) { let best: CloverPatch | undefined, bd = Infinity;
      for (const p of byKey.values()) { const d = Math.hypot(p.x - x, p.z - z); if (d < p.r + pad && d < bd && (!edible || unitsAt(p, now()) > 0)) { best = p; bd = d; } } return settle(best); },
    /** Nearest patch with clover left within `range` (centre distance), excluding `except`. */
    nearest(x: number, z: number, range: number, except?: string) { let best: CloverPatch | undefined, bd = range;
      for (const p of byKey.values()) { if (p.key === except || unitsAt(p, now()) <= 0) continue; const d = Math.hypot(p.x - x, p.z - z); if (d < bd) { best = p; bd = d; } } return settle(best); },
    get: (key: string) => settle(byKey.get(key)),
    /** Tools/tests: set a patch to `units` now, as if grazed to it (writes the grazed delta). */
    stage(key: string, units: number, by = 'stage') { const p = byKey.get(key); if (!p) return;
      p.units = Math.max(0, Math.min(p.max, units)); p.at = now(); CLOVER_STATE.set(p.key, { units: p.units, at: p.at, stolon: p.stolon, by }); revision++; return p; },
    /** core/agent FoodSource: eat from a patch (the graze transaction). */
    eat: (key: string, units: number, by: string) => { const p = byKey.get(key); if (!p) return 0;
      if (!TRANSACTIONS.has(kindOf(by), 'clover')) TRANSACTIONS.add(cloverGrazeRow(kindOf(by)));
      return TRANSACTIONS.run(by, key, { p, units, by, now: now() }); },
    list: () => byKey.values(),
    get size() { return byKey.size; },
    get revision() { return revision; },
  };
}
export type CloverField = ReturnType<typeof createCloverField>;

/** Instantaneous sunlight on the ground, W/m²: siteAt().light (0..1 shade) times solar shortwave (weather.ts).
 *  Clover's closed-form sun tables stay on lighting().day. Feeding shortwave into sunSeconds would change the
 *  diurnal shape and miss the lazy-vs-stepped match. Hosts that place patches pass cloverSiteAt; groundLight is
 *  what a reader asks for at one (day, hour). */
export function groundLight(x: number, z: number, day: number, hour: number, cloud = 0) {
  return siteAt(x, z).light * shortwave(Math.max(0, solar(day, hour).cosZ), cloud);
}
/** siteAt mapped onto the clover site record. */
export function cloverSiteAt(x: number, z: number): CloverSite {
  const s = siteAt(x, z);
  return { water: s.water, light: s.light, wet: s.wet, rock: s.rock, slopeDeg: s.slopeDeg };
}
