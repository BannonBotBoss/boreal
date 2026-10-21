/**
 * Gait table + selection. Inter-limb phase offsets (fraction of a stride, LH = 0, order LF, LH, RF, RH) from
 * Hildebrand's gait diagrams (Hildebrand 1965 Science 150:701; 1977 Am. Zool. 17:85) and Alexander 1984 (IJRR 3:49).
 * walk/trot/gallop rows are copied from core/animalBehavior gaitFor (Claude) so both systems agree.
 * Gait choice and stride length come from Claude's gaitFor (Froude number, Alexander & Jayes 1983); we only read it.
 */
import { alexanderGait, gaitFor, type GaitName, type LegDims } from '../../core/animalBehavior';
import { gravity } from '../../proc/physics';
import type { GaitId } from './signals';

export interface GaitRow { offsets: readonly number[]; duty: number; /** swing clearance as a fraction of hip height */ lift: number }
export const GAIT_TABLE: Record<GaitId, GaitRow> = {
  walk:   { offsets: [.25, 0, .75, .5], duty: .65, lift: .10 },  // lateral-sequence walk (gaitFor)
  trot:   { offsets: [0, .5, .5, 0], duty: .45, lift: .15 },     // diagonal pairs (gaitFor)
  pace:   { offsets: [0, 0, .5, .5], duty: .5, lift: .15 },      // ipsilateral pairs; duty [verify], lift game calibration
  canter: { offsets: [.3, 0, .6, .3], duty: .4, lift: .18 },     // three-beat, RH+LF diagonal [verify]
  gallop: { offsets: [.45, 0, .6, .9], duty: .3, lift: .20 },    // rotary LH -> RH -> RF -> LF (Biancardi & Minetti 2012); duty falls with speed
  // lagomorph rows (grok, T-0009; replace the unverified 'bound' row): offsets = bounding.ts rowOffsets(boundRows(HARE_AGENT.gait))
  // (tests/bound.test.ts checks they agree). Half-bound: hind pair near unison, fore pair staggered (Hildebrand 1977 J Mammal
  // 58:131; Bertram & Gutmann 2009). Lagomorph gallop: rotary, hind lead on the other side [estimate: no lagomorph hind lag
  // found]. Duty = HIND contact at a medium-fast run, .30 / .20 at the fastest (Hildebrand 1977 Fig. 2, Lepus); the speed-
  // dependent fore/hind duties live in core/agent/bound (bounding.ts uses those). lift: game calibration as the gallop row.
  'half-bound':       { offsets: [0, .58, .92, .55], duty: .3, lift: .20 },
  'gallop-lagomorph': { offsets: [0, .5, .92, .58], duty: .2, lift: .20 },
  pronk:  { offsets: [0, 0, 0, 0], duty: .3, lift: .20 },        // all four together [verify]
};

export interface GaitPlan { id: GaitId; offsets: readonly number[]; duty: number; /** stride length, m */ cycle: number; /** swing clearance, m */ lift: number; froude: number; reverse: boolean }

/** Froude number Fr = v²/(g·h) (Alexander 1976), g from proc/physics (rule 4). */
export const froude = (speed: number, hip: number) => speed * speed / (gravity() * hip);

/**
 * The gait at this speed. Auto = gaitFor's choice (walk/trot/gallop by Froude). An override keeps gaitFor's cycle but
 * shortens it if the override's longer stance would need more leg reach than gaitFor allowed.
 */
export function planGait(speed: number, legs: LegDims, override?: GaitId, prev?: GaitName): GaitPlan {
  // prev: Froude hysteresis (T-0002). Overrides without a reach model (pace, canter, bound, pronk) keep the reach-capped
  // Alexander stride; walk/trot/gallop use gaitFor's measured canid stride, which the girdles and spine reach (T-0003).
  const modelled = !override || override === 'walk' || override === 'trot' || override === 'gallop';
  const g = (modelled ? gaitFor : alexanderGait)(speed < 0 ? 'back' : 'walk', speed, legs, prev)!;
  const id: GaitId = override ?? g.name;
  const row = GAIT_TABLE[id];
  const duty = override ? row.duty : g.duty;
  const cycle = duty > g.duty ? g.cycle * g.duty / duty : g.cycle;
  return { id, offsets: row.offsets, duty, cycle, lift: override ? row.lift * legs.hip : g.lift, froude: froude(Math.max(.15, Math.abs(speed)), legs.hip), reverse: speed < 0 };
}
