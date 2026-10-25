/**
 * Traces (T-0019). A scent mark, a carcass and a dropping are outputs of an act (mark, consume, digest),
 * stored as the existing delta kinds. Agents smell them through core/senses scentLevel. DELTA_KINDS lifetimes
 * and DELTAS.cap are not changed here.
 *
 * The plume is dimensionless (core/senses.ts). `m` on a scent row is one raised-leg urination, normalized to 1.
 * Peters & Mech 1975 simulated a mark with 5 cc; that volume is not a concentration. Carcass `m` stays kilograms
 * (the consume row). Droppings `m` stays dry kilograms so the residue on expiry is the faeces, not an odor score.
 */
import type { AgentSpecies } from './agent';
import { DELTA_KINDS, DELTAS, near, record, strength, type Delta } from './deltas';
import { GROUND } from './ground';
import { smell, type ScentSource } from './senses';
import { kindOf, TRANSACTIONS } from './transactions';

/** One raised-leg urination per 450 m of travel. Peters & Mech 1975, Am. Sci. 63:628: 584 RLUs in 240 km. */
export const MARK_SPACING_M = 450;
/** Gray wolf prey-scent distance, downwind. Mech 1970, The Wolf, already cited on WOLF_NEEDS.senses.smell. */
export const WOLF_SCENT_RANGE_M = 2400;
/**
 * Deer leave a wolf scat within about 2 m (Kuijper et al., cited by van Ginkel et al. 2019, PLoS ONE 14(11):e0223248:
 * "a very fine-scale risk effect of circa two meters"). The same paper's urine response was inside 0.5 m.
 * One nose cutoff cannot be both, so the cutoff is the scat distance. Urine is smelled only inside that same 2 m.
 */
export const DEER_TRACE_RANGE_M = 2;
/** Hare gut reference for a full carcass odor: Belovsky 1984, 0.096 * W^1.03 at the 1.5 kg species mass. */
export const carcassRefKg = () => 0.096 * 1.5 ** 1.03;

const SRC_MARK = 'Peters & Mech 1975, Am. Sci. 63:628: 584 raised-leg urinations in 240 km of snow tracking (one per 450 m). A mark was simulated with 5 cc. The plume stores that as odor 1 (core/senses is dimensionless).';
const SRC_DROPPINGS = 'The digest act writes one deposit when the gut holds one pellet (hare) or one pellet group (deer). Hare: 167 g DM/day and assimilation 0.36 (HARE_AGENT) give the faeces; 576 pellets/day in summer (Rivera 2005, UMT thesis, 576±108). Deer: dry faeces = mass * 0.022 * (1-0.55) (FAUNA, Ullrey et al. 1970); 34.4 groups/day in July-August, free-ranging Minnesota (Rogers 1987, J. Wildl. Manage. 51:330).';

export interface TraceHit {
  kind: 'scent' | 'carcass' | 'droppings';
  key: string; x: number; z: number;
  /** scentLevel at this nose */ level: number;
  /** BEHAVIOUR response: negative avoids, positive attracts, 0 is only smelled */ weight: number;
  distance: number;
}

const guts = new Map<string, number>();
/** Test isolation. The gut is the undigested remainder between deposits, not a delta. */
export const resetTraceGut = () => { guts.clear(); };

/** Fresh odor in the dimensionless plume. A scent mark is m (1). A carcass scales by one hare gut. A dropping is the deposit's strength; the kilograms stay in m for the residue. */
export function odorOf(d: Delta & { strength: number }) {
  if (d.kind === 'scent') return Math.min(1, Math.max(0, d.m)) * d.strength;
  if (d.kind === 'carcass') return Math.min(1, Math.max(0, d.m) / carcassRefKg()) * d.strength;
  if (d.kind === 'droppings') return d.strength;
  return 0;
}

/** Delta rows as plume sources. `range` is the smeller's species cutoff, not the HUD default. */
export function deltaSources(x: number, z: number, range: number): ScentSource[] {
  return near(x, z, range)
    .filter(d => d.kind === 'scent' || d.kind === 'carcass' || d.kind === 'droppings')
    .map(d => ({
      key: `trace:${d.kind}:${d.x.toFixed(2)}:${d.z.toFixed(2)}`,
      kind: d.kind, x: d.x, z: d.z,
      potency: odorOf(d),
      range,
    }));
}

export function traceHits(sp: AgentSpecies, nose: { x: number; z: number }, wind: { x: number; z: number }, heading: number): TraceHit[] {
  const range = sp.senses.scent.range;
  return smell(nose, deltaSources(nose.x, nose.z, range), wind, heading).map(h => ({
    kind: h.kind as TraceHit['kind'],
    key: h.key, x: h.x, z: h.z, level: h.level, distance: h.distance,
    weight: sp.traces.response[h.kind as 'scent' | 'carcass' | 'droppings'] ?? 0,
  }));
}

/** Strongest avoid above `notice` (scentLevel). Weight is negative on an avoid row. */
export function bestAvoid(hits: readonly TraceHit[], notice: number): TraceHit | undefined {
  let best: TraceHit | undefined, score = 0;
  for (const h of hits) {
    if (!(h.weight < 0) || h.level < notice) continue;
    const s = h.level * -h.weight;
    if (!best || s > score) { best = h; score = s; }
  }
  return best;
}

/**
 * 1 when `to - from` points straight away from `hot`, 0 when it points straight toward, 0.5 when it is perpendicular.
 * Known match: awayScore({x:1,z:0},{x:2,z:0},{x:0,z:0}) = 1. Known mismatch: awayScore({x:1,z:0},{x:0,z:0},{x:0,z:0}) = 0.
 */
export function awayScore(from: { x: number; z: number }, to: { x: number; z: number }, hot: { x: number; z: number }) {
  const ax = from.x - hot.x, az = from.z - hot.z, tx = to.x - from.x, tz = to.z - from.z;
  const al = Math.hypot(ax, az), tl = Math.hypot(tx, tz);
  if (al < 1e-12 || tl < 1e-12) return 0;
  return ((ax * tx + az * tz) / (al * tl) + 1) / 2;
}

let rowsReady = false;
export function ensureTraceRows() {
  if (rowsReady) return;
  rowsReady = true;
  TRANSACTIONS.add({
    a: 'wolf', b: 'ground', verb: 'mark', name: 'mark', needsContact: false, source: SRC_MARK,
    run(a: { key: string; x: number; z: number }) {
      record({ kind: 'scent', x: a.x, z: a.z, t: GROUND.years, m: 1, meta: a.key });
      return 1;
    },
  });
  const drop = (species: string) => TRANSACTIONS.add({
    a: species, b: 'ground', verb: 'droppings', name: 'droppings', needsContact: false, source: SRC_DROPPINGS,
    run(a: { key: string; x: number; z: number; kg: number }) {
      record({ kind: 'droppings', x: a.x, z: a.z, t: GROUND.years, m: a.kg, meta: a.key });
      return a.kg;
    },
  });
  drop('hare');
  drop('deer');
}

/**
 * Travelling wolf, no fresh own mark within MARK_SPACING_M. The cause is the empty stretch of trail, not a clock.
 * `travelledM` is this step's path length; standing still does not mark.
 */
export function tryMark(key: string, x: number, z: number, travelledM: number) {
  ensureTraceRows();
  if (kindOf(key) !== 'wolf' || !(travelledM > 0)) return false;
  const blocked = DELTAS.log.some(d => d.kind === 'scent' && d.meta === key
    && Math.hypot(d.x - x, d.z - z) < MARK_SPACING_M && strength(d) >= (DELTA_KINDS.scent?.until ?? 0));
  if (blocked) return false;
  return TRANSACTIONS.run(key, 'ground', { key, x, z }, 'mark') > 0;
}

/**
 * Add the faeces from `units` just eaten. A deposit is written only when the gut reaches one pellet or one pellet group.
 * Returns how many deposits this call wrote.
 */
export function addFeces(sp: AgentSpecies, key: string, x: number, z: number, units: number) {
  ensureTraceRows();
  const spec = sp.traces.droppings;
  if (!spec || !(units > 0) || !(spec.groupG > 0)) return 0;
  let g = (guts.get(key) ?? 0) + units * spec.fecesGPerUnit;
  let n = 0;
  while (g >= spec.groupG - 1e-9) {
    g -= spec.groupG;
    TRANSACTIONS.run(key, 'ground', { key, x, z, kg: spec.groupG / 1000 }, 'droppings');
    n++;
  }
  guts.set(key, Math.max(0, g));
  return n;
}
