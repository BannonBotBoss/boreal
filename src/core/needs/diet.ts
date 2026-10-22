/**
 * Diet modules (T-0036): ONE interface for every diet kind. A species template picks its kind (diet.kind) and lists its
 * foods (diet.foods, per kg wet: energy, assimilation, preformed water, bite, eat time); the module turns an eat action into
 * Energy + hydration through the shared needs engine. Carnivores add the hunt (capture test + the prey's evasion step);
 * herbivores graze bite bouts (an embodied hare at a clover patch); omnivores use both. Pure TS.
 *
 * Pursuit/evasion: classic prey-evasion theory (Howland 1974, J Theor Biol 47:333): a slower prey escapes a faster pursuer
 * by turning sharply when the pursuer is close, because its turning radius v^2/a is smaller. Each zig is grip-limited here
 * (turn rate = lateralAccel / speed, Wilson et al. 2013 Nature 498:185 cheetah-impala), so a skilled pursuer who cuts the
 * corner can catch, and one who overshoots loses it. Real speeds are scaled to game speed by the player wolf's sprint.
 */
import type { SpeciesTemplate } from './template';
import { eatWater, type NeedsState } from './engine';
import { WOLF_NEEDS } from './species';
import { playerSpeed } from '../playerTuning';
import { SYSTEM_PROPERTIES } from '../../config/systemProperties';
import type { SensePoint } from '../senses';
export const HUNT = SYSTEM_PROPERTIES.hunt;
export type DietKind = SpeciesTemplate['diet']['kind'];
export interface Meal { food: string; kg: number; energy: number; water: number; seconds: number }
export interface DietModule {
  kind: DietKind;
  /** NPC goal hunger drives (behaviour.ts reads it: hunt or forage) */ goal: 'hunt' | 'forage';
  /** foods this species eats, by kind */ eats(sp: SpeciesTemplate, food: string): boolean;
  /** one eat action of `food` (default one bite of it): Energy % and hydration % it adds */ meal(sp: SpeciesTemplate, food: string, kg?: number): Meal;
  /** apply a meal to a needs state + host Energy */ eat(sp: SpeciesTemplate, st: NeedsState, energy: number, food: string, kg?: number): { state: NeedsState; energy: number; meal: Meal };
}
/** Energy % per kJ: 100 % = sp.needs.energy.fullSeconds of the daily FMR. */
export const energyPerKj = (sp: SpeciesTemplate) => 100 / (sp.body.fmrKjPerDay.v * sp.needs.energy.fullSeconds.v / 86400);
function meal(sp: SpeciesTemplate, food: string, kg?: number): Meal {
  const f = sp.diet.foods[food]; if (!f) return { food, kg: 0, energy: 0, water: 0, seconds: 0 };
  const k = kg ?? f.biteKg.v, before = { water: 0, rest: 0 };
  return { food, kg: k, energy: k * f.kJPerKg.v * f.assimilation.v * energyPerKj(sp), water: eatWater(sp, before, food, k).water - before.water || k * f.waterMlPerKg.v * 100 / (sp.needs.water.criticalDeficit.v * sp.body.massKg.v * 1000), seconds: f.eatSeconds.v };
}
const base = (kind: DietKind, goal: 'hunt' | 'forage'): DietModule => ({
  kind, goal, eats: (sp, food) => !!sp.diet.foods[food], meal,
  eat(sp, st, energy, food, kg) {
    const m = meal(sp, food, kg); return { meal: m, state: { ...st, water: Math.min(100, st.water + m.water) }, energy: Math.min(100, energy + m.energy) };
  },
});
export const DIETS: Record<DietKind, DietModule> = { carnivore: base('carnivore', 'hunt'), herbivore: base('herbivore', 'forage'), omnivore: base('omnivore', 'forage') };
export const dietOf = (sp: SpeciesTemplate) => DIETS[sp.diet.kind];

/** Real m/s -> game m/s: the player wolf's game sprint over the wolf's real top speed (keeps real speed ratios). */
export const gameSpeed = (real: number) => real * playerSpeed('sprint') / WOLF_NEEDS.behaviour.evasion.burstSpeed.v;
/** Carnivore capture test: body contact, or a pounce landing close. */
export const captured = (d: number, pouncing: boolean) => d < HUNT.catchContact || (pouncing && d < HUNT.catchPounce);
/** Flight initiation distance (m) for a predator perceived at `level` (0..1): sourced mean x a stealth factor. */
export const boltDistance = (sp: SpeciesTemplate, level: number) => sp.behaviour.flight.distanceM.v * (HUNT.boltBase + HUNT.boltPerLevel * level);
export interface EvadeState { flee: number; zig: number; aim: number; heading: number; jink?: number }
export const startEvade = (self: SensePoint, threat: SensePoint): EvadeState => ({ flee: 0, zig: 0, aim: away(self, threat), heading: away(self, threat) });
/** Heading convention of proc/math stepForward: moves along (-sin h, -cos h). */
export const away = (self: SensePoint, threat: SensePoint) => Math.atan2(self.x - threat.x, self.z - threat.z) + Math.PI;
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
/**
 * One evasion step: speed (burst, then tired), a new zig aim every zigEvery s (away from the threat +- zigAngle, bent by
 * `scatter` away from the group centre when given), and a grip-limited turn toward the aim.
 */
export function evadeStep(sp: SpeciesTemplate, e: EvadeState, self: SensePoint, threat: SensePoint, dt: number, rng: () => number, scatter = 0, threatSpeed = 0, threatGrip = 13): { state: EvadeState; speed: number } {
  const ev = sp.behaviour.evasion, n = { ...e, flee: e.flee + dt, zig: e.zig - dt, jink: (e.jink ?? 0) - dt };
  const speed = gameSpeed(n.flee < sp.stamina.sprintSeconds.v ? ev.burstSpeed.v : ev.tiredSpeed.v); // burst = the species' stamina sprint (one engine for player and NPC)
  // Howland 1974: when the faster pursuer is inside its own turning radius v^2/a, the prey jinks sharply to one side.
  const d = Math.hypot(self.x - threat.x, self.z - threat.z), critical = threatSpeed ** 2 / threatGrip * HUNT.jinkRadii;
  if (ev.zigAngle.v > 0 && n.jink <= 0 && threatSpeed > speed && d < critical) {
    n.jink = HUNT.jinkEvery; n.zig = Math.max(n.zig, HUNT.minZig * 2);
    n.aim = away(self, threat) + (rng() < .5 ? -1 : 1) * HUNT.jinkAngle;
  } else if (n.zig <= 0) {
    const [a, b] = ev.zigEvery.v; n.zig = Math.max(HUNT.minZig, a + (b - a) * rng());
    n.aim = away(self, threat) + scatter + (rng() < .5 ? -1 : 1) * ev.zigAngle.v * rng();
  }
  const maxTurn = ev.lateralAccel.v / Math.max(.5, speed) * dt, diff = wrap(n.aim - n.heading);
  n.heading = wrap(n.heading + Math.max(-maxTurn, Math.min(maxTurn, diff)));
  return { state: n, speed };
}
