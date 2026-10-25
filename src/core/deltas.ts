/**
 * Persistence (Grok Bot), PROJECT-RULES rule 9. The world is pure math (seed + position + time); the ONLY stored state is
 * this sparse, capped log of interaction deltas. Each delta fades by its own closed-form decay m(t) = m0·e^(−t/τ) (or the
 * kind's model), is dropped once expired, and its residue merges into the math layer that owns it (carcass and droppings
 * mass → ground decay chain via `addDeposit`). Everything else regenerates from seed.
 */
import { K } from './constants';
import { addDeposit, GROUND } from './ground';
import { weatherAt } from './weather';
import { sunSeconds } from './fields';
import { worldSec } from './worldClock';

export interface Delta { kind: string; x: number; z: number; t: number; m: number; meta?: string } // t in game years, m = magnitude
/** Per-kind lifetime (τ, game days, e-folding) and where the residue goes. */
export const DELTA_KINDS: Record<string, { tau: number; until: number; residue?: { pool: number; kgPerM: number }; source: string }> = {
  // tracks in soft ground/snow: legible ~1–3 days; rain or new snow erases faster (Rezendes 1999, Tracking and the Art of Seeing) [verify]
  footprint: { tau: 1.5, until: .05, source: 'Rezendes 1999 [verify]; weather: ×4 faster in rain/snowfall' },
  // scent marks: wolf raised-leg urination detectable ~2–3 weeks (Peters & Mech 1975, Am. Sci. 63:628) [verify]
  scent: { tau: 10, until: .1, source: 'Peters & Mech 1975 [verify]' },
  // ungulate carcass in boreal summer: soft tissue gone in ~2–4 weeks with scavengers (Wilmers et al. 2003, J. Anim. Ecol. 72:909) [verify]
  carcass: { tau: 8, until: .05, residue: { pool: 0, kgPerM: .3 }, source: 'Wilmers et al. 2003 [verify]; residue = dry mass to fresh litter' },
  // deer pellet groups persist months (Neff 1968, J. Wildl. Manage. 32:597: counts span winter) [verify]
  droppings: { tau: 60, until: .05, residue: { pool: 0, kgPerM: 1 }, source: 'Neff 1968 [verify]' },
  disturbed: { tau: 30, until: .05, source: 'game calibration: moss/litter recovery after scraping [verify]' },
  branch: { tau: 365, until: .05, residue: { pool: 1, kgPerM: 1 }, source: 'fine woody debris k≈0.1/yr (Kurz et al. 2009 CBM-CFS3) [verify]' },
  movedStone: { tau: 3650, until: .05, source: 'stones stay moved; ~decade until moss covers the scar [verify]' },
  felledTree: { tau: 3650, until: .05, residue: { pool: 2, kgPerM: 1 }, source: 'snag/log fall ~decades (Kurz et al. 2009) [verify]' },
  // tau is unused: strength is (max − grams) / max from sunSeconds, not the exponential. until 0.02 drops the row once the patch is ~98% refilled.
  grazed: { tau: 60, until: .02, source: 'T-0015 forage field: meta key|atWorldSec|perSun|max|by; closed form is grams + perSun * sunSeconds (core/fields)' },
};
export const DELTAS = { log: [] as Delta[], cap: 1500 };
const DAY = 1 / K.julian_year_d;
/** Current strength 0..1 of a delta at game time `now` (closed form; rain speeds up track loss). */
/** Depletion still showing, 1 just bitten .. 0 refilled. Uses world seconds, not the game-year `now` of the exponential kinds. */
function grazedStrength(d: Delta) {
  const parts = (d.meta ?? '').split('|');
  if (parts.length < 4) return 0;
  const at = +parts[1], per = +parts[2], max = +parts[3];
  if (!(max > 0) || !Number.isFinite(at) || !Number.isFinite(d.m)) return 0;
  if (!(per > 0)) return Math.max(0, Math.min(1, (max - d.m) / max));
  const room = Math.max(0, max - d.m);
  const grams = Math.min(max, d.m + per * sunSeconds(at, worldSec(), room / per));
  return Math.max(0, Math.min(1, (max - grams) / max));
}
export function strength(d: Delta, now = GROUND.years) {
  const k = DELTA_KINDS[d.kind]; if (!k) return 0;
  if (d.kind === 'grazed') return grazedStrength(d);
  const wet = d.kind === 'footprint' && (weatherAt(d.x, d.z).rainMmH > .1 || weatherAt(d.x, d.z).snow) ? 4 : 1;
  return Math.exp(-Math.max(0, now - d.t) / (k.tau * DAY) * wet);
}
/** One grazed row per patch key (the key is the meta prefix, before the first pipe). Not record(): a 1 m merge would fuse neighbours. */
export function findGrazed(key: string) {
  return DELTAS.log.find(d => d.kind === 'grazed' && (d.meta ?? '').split('|')[0] === key);
}
export function upsertGrazed(d: Omit<Delta, 't' | 'kind'> & { t?: number }) {
  const key = (d.meta ?? '').split('|')[0];
  const row: Delta = { kind: 'grazed', x: d.x, z: d.z, t: d.t ?? GROUND.years, m: d.m, meta: d.meta };
  const i = DELTAS.log.findIndex(o => o.kind === 'grazed' && (o.meta ?? '').split('|')[0] === key);
  if (i >= 0) { DELTAS.log[i] = row; return; }
  DELTAS.log.push(row);
  if (DELTAS.log.length > DELTAS.cap) { DELTAS.log.sort((a, b) => strength(a) * a.m - strength(b) * b.m); expire(DELTAS.log.shift()!); }
}
/** Add a delta; a same-kind delta within `mergeM` metres and a day is reinforced instead (keeps the log sparse). */
export function record(d: Delta, mergeM = 1) {
  const same = DELTAS.log.find(o => o.kind === d.kind && Math.abs(o.x - d.x) < mergeM && Math.abs(o.z - d.z) < mergeM && d.t - o.t < DAY);
  if (same) { same.m = same.m * strength(same, d.t) + d.m; same.t = d.t; return; }
  DELTAS.log.push(d);
  if (DELTAS.log.length > DELTAS.cap) { DELTAS.log.sort((a, b) => strength(a) * a.m - strength(b) * b.m); expire(DELTAS.log.shift()!); } // drop the weakest
}
function expire(d: Delta) { const r = DELTA_KINDS[d.kind]?.residue; if (r) addDeposit({ x: d.x, z: d.z, year: GROUND.years, pool: r.pool, kg: d.m * r.kgPerM, what: `${d.kind} residue` }); }
/** Drop expired deltas, merging their residue into the ground. Call at low rate. */
export function prune(now = GROUND.years) {
  const keep: Delta[] = [];
  for (const d of DELTAS.log) (strength(d, now) < DELTA_KINDS[d.kind].until ? expire(d) : keep.push(d));
  DELTAS.log = keep;
}
export const near = (x: number, z: number, r = 6) => DELTAS.log.filter(d => Math.hypot(d.x - x, d.z - z) < r).map(d => ({ ...d, strength: strength(d) }));
export const SAVE_KEY_DELTAS = 'boreal.deltas.v1';
export const saveDeltas = () => JSON.stringify(DELTAS.log);
export function loadDeltas(json: string | null) { try { const a = JSON.parse(json ?? '[]'); DELTAS.log = Array.isArray(a) ? a : []; } catch { DELTAS.log = []; } }
