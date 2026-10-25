/**
 * Autonomous wolf (T-0010). One call into the shared agent (core/agent stepAgent) plus the shared route (core/plan).
 * The wolf does not call AnimalBrain.decide. A player command still does, in main.ts.
 * Nothing here is wolf-shaped code beyond the species row: food, lures and blockers are data the pipeline already reads.
 */
import { AnimalBrain, type SenseItem } from './animalBehavior';
import { createAgent, stepAgent, writeLocomotion, type Agent, type AgentWorld, type FoodSource } from './agent';
import { WOLF_AGENT } from './species';
import { WOLF_NEEDS } from './needs/species';
import { blocksFrom, headingToward, JUMP_REACH_M, plan, type RoutePlan } from './plan';
import { steerWolf, type WolfPose } from './locomotion';
import { scentLevel } from './senses';
import { stream } from '../proc/rng';
import { wrapAngle } from '../proc/math';
import { heightAt, type Entity } from './world';
import { BLOCK, LEVEL, PHYS } from './tuning';
import type { DoingGoal } from './why';

export interface WolfLure { key: string; kind: string; x: number; z: number; potency?: number }
export interface WolfSense {
  /** Generated rig mass (kg). Omitted: the allometric mass already on WOLF_NEEDS, which metabolicW uses. */
  massKg?: number;
  wind?: { x: number; z: number };
  /** 0 night .. 1 day */
  daylight?: number;
  hares?: readonly WolfLure[];
  scents?: readonly WolfLure[];
  /** A drinkable point. Used only while waterLevel is under the needs thirst line. */
  water?: { x: number; z: number };
  waterLevel?: number;
  walkable?: (x: number, z: number) => boolean;
}
export interface WolfReadout { goal: string; because: string; doing: DoingGoal }

const agents = new WeakMap<AnimalBrain, Agent>();
const reads = new WeakMap<AnimalBrain, WolfReadout>();

/** Drop the autonomous plan (manual control, or a needs steer that is not this step). */
export function clearWolfPlan(brain: AnimalBrain) { agents.delete(brain); reads.delete(brain); }
export function wolfReadout(brain: AnimalBrain): WolfReadout | undefined { return reads.get(brain); }

/** The old autonomous probe: dry ground and a step the body will take. */
export function wolfGround(from: { x: number; z: number }) {
  const h0 = heightAt(from.x, from.z);
  return (x: number, z: number) => {
    const h = heightAt(x, z);
    return h >= LEVEL.wolfWater && Math.abs(h - h0) <= BLOCK.wolf.step;
  };
}

function forageSource(items: readonly { key: string; x: number; z: number }[]): FoodSource {
  const at = (x: number, z: number, pad = 0) => items.find(p => Math.hypot(p.x - x, p.z - z) <= 1 + pad);
  return {
    at: (x, z, pad) => { const p = at(x, z, pad); return p && { key: p.key, x: p.x, z: p.z, r: 1, units: 1 }; },
    nearest: (x, z, range, except) => items.filter(p => p.key !== except && Math.hypot(p.x - x, p.z - z) <= range)
      .sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z))
      .map(p => ({ key: p.key, x: p.x, z: p.z, r: 1, units: 1 }))[0],
    eat: () => 0,
  };
}

function lureLevel(nose: { x: number; z: number }, s: WolfLure, wind: { x: number; z: number }, daylight: number): number {
  const scent = scentLevel(nose, { key: s.key, kind: s.kind, x: s.x, z: s.z, potency: (s.potency ?? 1) * WOLF_AGENT.senses.scent.potency }, wind);
  const d = Math.hypot(s.x - nose.x, s.z - nose.z);
  const sight = Math.max(WOLF_AGENT.senses.sight.night, daylight) * Math.max(0, 1 - d / WOLF_AGENT.senses.sight.range);
  return Math.max(scent, s.kind === 'hare' ? sight : 0);
}

function doingFor(action: Agent['action']): DoingGoal {
  if (action === 'feed' || action === 'step') return 'grazing';
  if (action === 'flee' || action === 'pause') return 'fleeing';
  if (action === 'alert') return 'alerting';
  if (action === 'rest' || action === 'hide') return 'recovering';
  if (action === 'approach' || action === 'seek' || action === 'scan') return 'seeking';
  return 'exploring';
}

function move(from: WolfPose, heading: number, speed: number, dt: number, walkable: (x: number, z: number) => boolean): WolfPose {
  const next = steerWolf({ ...from, heading }, 0, speed > 0.01 ? 1 : 0, dt, Math.abs(speed));
  if (speed <= 0.01 || walkable(next.x, next.z)) return next;
  return { ...from, heading: wrapAngle(heading + Math.PI * 0.6) };
}

/**
 * One autonomous step. `stamina` is the player's stamina meter (0..100), read, not written.
 * `objects` are the chunk entities (logs, trees, forage, people).
 */
export function autonomousWolfStep(brain: AnimalBrain, pose: WolfPose, dt: number, stamina: number, objects: Entity[], sense: WolfSense = {}): WolfPose {
  if (brain.motion === 'jump') {
    if (brain.jumpTime < PHYS.jumpSeconds) {
      brain.jumpTime += dt;
      const next = move(pose, brain.heading, WOLF_AGENT.speed.approach, dt, sense.walkable ?? wolfGround(pose));
      brain.heading = next.heading; brain.speed = WOLF_AGENT.speed.approach;
      const a = agents.get(brain); if (a) { a.x = next.x; a.z = next.z; a.heading = next.heading; }
      return next;
    }
    brain.jumpTime = 0; brain.jumpCooldown = 1.5; brain.motion = 'walk';
  }
  brain.jumpCooldown = Math.max(0, brain.jumpCooldown - dt);

  let a = agents.get(brain);
  if (!a) {
    a = createAgent(WOLF_AGENT, `wolf:${brain.seed}`, pose.x, pose.z, stream(brain.seed >>> 0, 'wolf-agent'), { heading: pose.heading, energy: brain.energy, stamina });
    agents.set(brain, a);
  }
  a.x = pose.x; a.z = pose.z; a.heading = pose.heading;
  a.energy = brain.energy; a.stamina = Math.max(0, Math.min(100, stamina));

  const wind = sense.wind ?? { x: 0, z: 0 }, daylight = sense.daylight ?? 1, mass = sense.massKg ?? WOLF_NEEDS.body.massKg.v;
  const walkable = sense.walkable ?? wolfGround(pose);
  const forage = objects.filter(e => e.kind === 'forage');
  const lures: { key: string; kind: string; x: number; z: number; level: number }[] = [];
  for (const h of sense.hares ?? []) lures.push({ key: h.key, kind: 'hare', x: h.x, z: h.z, level: lureLevel(pose, { ...h, kind: 'hare' }, wind, daylight) });
  for (const s of sense.scents ?? []) lures.push({ key: s.key, kind: s.kind, x: s.x, z: s.z, level: lureLevel(pose, s, wind, daylight) });
  const thirst = WOLF_NEEDS.behaviour.drives.water.seekBelow.v;
  const waterNow = sense.waterLevel ?? 100;
  if (sense.water && waterNow < thirst) {
    // A drive under its line outranks settling. Rest while full is restFull + restBase; investigate * level has to clear
    // that, plus the utility noise. The margin 0.2 is game calibration (noise is 0.02).
    const U = WOLF_AGENT.utility, L = WOLF_AGENT.levels;
    const restU = U.rest * (1 - a.stamina / L.stamina.max) + (a.energy >= L.energy.full ? U.restFull : 0) + U.restBase;
    const level = (restU + 0.2) / (U.investigate ?? 0.5) + (thirst - waterNow) / thirst;
    lures.push({ key: 'water', kind: 'water', x: sense.water.x, z: sense.water.z, level });
  }
  const world: AgentWorld = {
    others: objects.filter(e => e.kind === 'person').map(e => ({ key: e.key, kind: 'person', x: e.x, z: e.z, speed: 0 })),
    wind, daylight, food: { forage: forageSource(forage) }, lures, walkable,
  };
  stepAgent(a, world, dt);
  // The needs engine owns Energy (main.ts stepNeeds). Discard the pipeline's copy of the same drain.
  a.energy = brain.energy;

  const goalPoint = a.target ?? (a.action === 'flee' ? {
    x: pose.x - Math.sin(a.heading) * 20,
    z: pose.z - Math.cos(a.heading) * 20,
  } : undefined);
  const moving = a.action === 'approach' || a.action === 'seek' || a.action === 'flee' || a.action === 'step';
  const route: RoutePlan | undefined = moving ? plan(pose, goalPoint, blocksFrom(objects), mass, a.action === 'flee' ? WOLF_AGENT.speed.flee : WOLF_AGENT.speed.approach, walkable) : undefined;

  let next = { x: a.x, z: a.z, heading: a.heading };
  let because = a.action === 'rest' || a.action === 'hide' ? (brain.energy <= 0 ? 'energy' : stamina < 30 ? 'stamina' : 'nothing-sensed') : a.goal;
  if (route && route.motion === 'jump' && brain.jumpCooldown === 0 && route.clearM <= JUMP_REACH_M) {
    brain.motion = 'jump'; brain.jumpTime = dt; brain.problem = 'avoid'; brain.speed = WOLF_AGENT.speed.approach;
    brain.heading = route.heading;
    next = move(pose, route.heading, brain.speed, dt, walkable);
    because = `jump ${route.jumpJPerKg.toFixed(1)}<detour ${route.detourJPerKg.toFixed(1)} J/kg`;
    reads.set(brain, { goal: `jumping ${route.block ?? 'log'}`, because, doing: 'seeking' });
  } else if (route && route.motion === 'jump' && brain.jumpCooldown > 0) {
    // The hop is still the cheaper plan, but the legs are recovering. Keep walking at the goal; do not swing out to an end.
    const want = a.action === 'flee' ? WOLF_AGENT.speed.flee : WOLF_AGENT.speed.approach;
    next = move(pose, route.heading, want, dt, walkable);
    const speed = Math.hypot(next.x - pose.x, next.z - pose.z) / Math.max(dt, 1e-6);
    because = 'walking in while the jump recovers';
    reads.set(brain, { goal: a.goal, because, doing: a.action === 'flee' ? 'fleeing' : 'seeking' });
    writeLocomotion(brain, { heading: next.heading, speed, action: a.action });
  } else if (route && route.motion === 'detour' && route.to && route.detourJPerKg < Infinity) {
    const want = a.action === 'flee' ? WOLF_AGENT.speed.flee : WOLF_AGENT.speed.approach;
    next = move(pose, headingToward(pose, route.to), want, dt, walkable);
    const speed = Math.hypot(next.x - pose.x, next.z - pose.z) / Math.max(dt, 1e-6);
    because = `detour ${route.detourJPerKg.toFixed(1)}<jump ${route.jumpJPerKg.toFixed(1)} J/kg`;
    reads.set(brain, { goal: `around ${route.block ?? 'obstacle'}`, because, doing: a.action === 'flee' ? 'fleeing' : 'seeking' });
    writeLocomotion(brain, { heading: next.heading, speed, action: a.action });
  } else if (route && route.motion === 'wait') {
    next = pose;
    writeLocomotion(brain, { heading: pose.heading, speed: 0, action: 'rest' });
    reads.set(brain, { goal: 'waiting: the way is closed', because: route.block ?? 'blocked', doing: 'recovering' });
  } else {
    if (!walkable(next.x, next.z)) next = { ...pose, heading: wrapAngle(pose.heading + Math.PI * 0.6) };
    writeLocomotion(brain, { ...a, heading: next.heading, speed: Math.hypot(next.x - pose.x, next.z - pose.z) / Math.max(dt, 1e-6) });
    reads.set(brain, { goal: a.goal, because: because.slice(0, 64), doing: doingFor(a.action) });
  }
  a.x = next.x; a.z = next.z; a.heading = next.heading; brain.heading = next.heading;
  if (a.action === 'feed' && a.food && a.elapsed >= WOLF_AGENT.diet.forage.eatSeconds) {
    const meal: SenseItem = { key: a.food, x: a.x, y: 0, z: a.z, kind: 'food' };
    brain.meal = meal;
  }
  return next;
}
