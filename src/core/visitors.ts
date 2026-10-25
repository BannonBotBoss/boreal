/**
 * Visitors on the shared agent (T-0012). One person is an AgentSpecies row (PERSON_AGENT) stepped by stepAgent.
 * Hunger picks berries (forage entities, a FoodSource). Thirst walks to water (a lure, the same shape as the wolf's drink).
 * A stranger who sees the wolf turns to watch, and steps back only inside the flight distance. A friend record
 * (core/events relationship === 'friend', the same field the deer read) is a lure, not a threat: they walk over and stay.
 * Nothing here is a second behaviour machine. The sine sway is not in this file.
 */
import { createAgent, poseOf, stepAgent, type Agent, type AgentWorld, type FoodSource, type Pose } from './agent';
import { PERSON_AGENT, PERSON_BERRY_G, PERSON_DAY_S, PERSON_WATER_SEEK } from './species';
import { TRANSACTIONS } from './transactions';
import { stream } from '../proc/rng';
import type { DoingGoal } from './why';

/** IOM 2004 DRI: men 19–30 drink about 3.0 L/day of beverages (of 3.7 L total water). This trip replaces the beverages.
 *  Institute of Medicine, Dietary Reference Intakes for Water…, National Academies Press, 2005. */
export const PERSON_DRINK_L_DAY = 3.0;
/** ICRP Publication 23 Reference Man, 70 kg. Used only to turn litres into the unitless hydration meter.
 *  The visitor mesh mass stays entityMass; this is not assigned to a body. */
export const PERSON_REFERENCE_KG = 70;
/** 100 points = 10% of that reference body as water. 3.0 L/day is 42.857 points per game day. */
export const PERSON_WATER_POINTS_PER_DAY = PERSON_DRINK_L_DAY / PERSON_REFERENCE_KG / 0.10 * 100;
/** One cup, 0.3 L. Ten cups are the 3.0 L beverage day. */
export const PERSON_CUP_L = 0.3;
export const PERSON_CUP_POINTS = PERSON_CUP_L / PERSON_REFERENCE_KG / 0.10 * 100;
/** [estimate] a cup takes about 12 real seconds at the lip. The motor act is not compressed with the day clock. */
export const PERSON_CUP_S = 12;
export const PERSON_DRINK_PER_S = PERSON_CUP_POINTS / PERSON_CUP_S;
export const PERSON_WATER_DRAIN_PER_S = PERSON_WATER_POINTS_PER_DAY / PERSON_DAY_S;
/** [game calibration] added to a friend lure so the bond beats sitting. Same role as the wolf's 0.2 rest margin. */
export const PERSON_FRIEND_PULL = 0.4;
/** Seated drop of the clay figure (m). Standing hip is about 0.53 of stature (Drillis & Contini 1966) and a sit
 *  on the ground is lower; 0.45 m is half the mesh's 0.8 m leg so the figure reads seated and the feet stay in frame.
 *  [game pose] The anatomical ground-sit drop is larger than this mesh can show. */
export const PERSON_SIT_M = 0.45;
/** USDA portion on one bush: 50 berries, 68 g. A wild mat can hold more; this is one picking. */
export const PERSON_PATCH_G = PERSON_BERRY_G * 50;

const MARGIN = 0.2; // same game margin the wolf uses so a lure beats rest (utility noise here is 0)

interface VisitorState { agent: Agent; water: number }
const people = new Map<string, VisitorState>();
const patches = new Map<string, number>();

TRANSACTIONS.add({
  a: 'person', b: 'forage', name: 'pick', needsContact: true,
  source: 'USDA FDC 171711, 57 kcal/100 g raw blueberries; portion 50 berries = 68 g. Cadence one berry/s is an estimate.',
  run: (grams: number) => grams,
});

export interface VisitorBody { key: string; x: number; z: number; heading: number; seed: number }
export interface VisitorInput {
  dt: number;
  wolf?: { x: number; z: number; speed: number };
  friend: boolean;
  forage: readonly { key: string; x: number; z: number }[];
  water?: { x: number; z: number };
  walkable: (x: number, z: number) => boolean;
  daylight: number;
  wind: { x: number; z: number };
}
export interface VisitorInit { energy?: number; water?: number }
export interface VisitorReadout {
  goal: string; because: string; doing: DoingGoal; action: Agent['action']; posture: Pose;
  heading: number; x: number; z: number; speed: number; energy: number; water: number;
}

/** The saved relationship, the same field deer use. Speak writes 'friend'. Anything else is a stranger. */
export function visitorFriend(record: { relationship?: string | null } | undefined): boolean {
  return record?.relationship === 'friend';
}

/** Seeded stores, one draw, then only eating, drinking and the day drain change them. */
export function visitorStores(seed: number): { energy: number; water: number } {
  const r = stream(seed >>> 0, 'visitor-stores');
  return { energy: 50 + r() * 50, water: 40 + r() * 60 };
}

/** Pull a drink point that sits in the water back to the last walkable step toward it. */
export function drinkPoint(from: { x: number; z: number }, water: { x: number; z: number }, walkable: (x: number, z: number) => boolean) {
  if (walkable(water.x, water.z)) return { x: water.x, z: water.z };
  const dx = water.x - from.x, dz = water.z - from.z, len = Math.hypot(dx, dz);
  if (len < 1e-6) return { x: from.x, z: from.z };
  let last = { x: from.x, z: from.z };
  const n = Math.ceil(len / 0.5);
  for (let i = 1; i <= n; i++) {
    const t = Math.min(1, (i * 0.5) / len);
    const p = { x: from.x + dx * t, z: from.z + dz * t };
    if (!walkable(p.x, p.z)) return last;
    last = p;
  }
  return last;
}

export function visitorSitDrop(posture: Pose, scale: number) {
  return posture === 'rest' ? PERSON_SIT_M * scale : 0;
}

/** 1 when actual matches expected. A zero expected scores 1 only when actual is also ~0 (the rest case). */
export function trackScore(actual: number, expected: number) {
  if (Math.abs(expected) < 1e-9) return Math.abs(actual) < 0.05 ? 1 : 0;
  return 1 - Math.abs(actual - expected) / Math.abs(expected);
}

export function visitorPatchGrams(key: string) { return patches.get(key); }

function patchGrams(key: string) {
  const g = patches.get(key);
  if (g !== undefined) return g;
  patches.set(key, PERSON_PATCH_G);
  return PERSON_PATCH_G;
}

function forageSource(items: readonly { key: string; x: number; z: number }[]): FoodSource {
  const hit = (x: number, z: number, pad = 0) => items.find(p => patchGrams(p.key) > 0 && Math.hypot(p.x - x, p.z - z) <= 1 + pad);
  return {
    at: (x, z, pad) => { const p = hit(x, z, pad); return p && { key: p.key, x: p.x, z: p.z, r: 1, units: patchGrams(p.key) }; },
    nearest: (x, z, range, except) => items.filter(p => p.key !== except && patchGrams(p.key) > 0 && Math.hypot(p.x - x, p.z - z) <= range)
      .sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z) || (a.key < b.key ? -1 : 1))
      .map(p => ({ key: p.key, x: p.x, z: p.z, r: 1, units: patchGrams(p.key) }))[0],
    eat: (key, units, by) => {
      const left = patchGrams(key);
      const take = Math.min(left, units);
      const ran = TRANSACTIONS.run(by, key, take);
      if (ran > 0) patches.set(key, left - ran);
      return ran;
    },
  };
}

function restUtility(a: Agent) {
  const U = a.species.utility, L = a.species.levels;
  return U.rest * (1 - a.stamina / L.stamina.max) + (a.energy >= L.energy.full ? U.restFull : 0) + U.restBase;
}

function lureLevel(a: Agent, extra: number) {
  return (restUtility(a) + MARGIN) / (a.species.utility.investigate ?? 0.5) + extra;
}

function doingFor(a: Agent, water: number): { doing: DoingGoal; because: string } {
  const nE = `energy ${Math.round(a.energy)}%`, nW = `water ${Math.round(water)}%`;
  if (a.action === 'feed' || a.action === 'step') return { doing: 'grazing', because: nE };
  if (a.action === 'flee' || a.action === 'pause') return { doing: 'fleeing', because: 'wolf' };
  if (a.action === 'alert') return { doing: 'alerting', because: 'wolf' };
  if (a.goal.includes('water')) return { doing: 'drinking', because: nW };
  if (a.goal.includes('wolf') || a.goal.includes('friend')) {
    return a.action === 'approach' ? { doing: 'seeking', because: 'friend' } : { doing: 'recovering', because: 'friend' };
  }
  if (a.action === 'rest' || a.action === 'hide') return { doing: 'recovering', because: 'rest' };
  if (a.action === 'approach' || a.action === 'seek') return { doing: 'seeking', because: nE };
  return { doing: 'exploring', because: a.goal.slice(0, 60) || 'nothing sensed' };
}

function readout(s: VisitorState): VisitorReadout {
  const a = s.agent, d = doingFor(a, s.water);
  return {
    goal: a.goal, because: d.because, doing: d.doing, action: a.action, posture: poseOf(a),
    heading: a.heading, x: a.x, z: a.z, speed: a.speed, energy: a.energy, water: s.water,
  };
}

const reads = new Map<string, VisitorReadout>();
export function visitorReadout(key: string): VisitorReadout | undefined { return reads.get(key); }

/** Drop agents whose chunk unloaded. Far state comes back from the seed, not from this map. */
export function dropVisitors(keep: ReadonlySet<string>) {
  for (const key of people.keys()) if (!keep.has(key)) { people.delete(key); reads.delete(key); }
}

/** One step. `init` applies only when this key is new. */
export function stepVisitor(body: VisitorBody, input: VisitorInput, init?: VisitorInit): VisitorReadout {
  let s = people.get(body.key);
  if (!s) {
    const seeded = visitorStores(body.seed);
    const agent = createAgent(PERSON_AGENT, `person:${body.key}`, body.x, body.z, stream(body.seed >>> 0, `visitor:${body.key}`), {
      heading: body.heading, energy: init?.energy ?? seeded.energy,
    });
    s = { agent, water: init?.water ?? seeded.water };
    people.set(body.key, s);
  }
  const a = s.agent;
  a.x = body.x; a.z = body.z; a.heading = body.heading;

  const lures: { key: string; kind: string; x: number; z: number; level: number }[] = [];
  if (input.water && s.water < PERSON_WATER_SEEK) {
    const at = drinkPoint(body, input.water, input.walkable);
    lures.push({ key: 'water', kind: 'water', x: at.x, z: at.z, level: lureLevel(a, Math.max(0, (PERSON_WATER_SEEK - s.water) / PERSON_WATER_SEEK)) });
  }
  const wolf = input.wolf;
  const others = wolf && !input.friend ? [{ key: 'player', kind: 'wolf', x: wolf.x, z: wolf.z, speed: wolf.speed }] : [];
  if (wolf && input.friend) lures.push({ key: 'friend', kind: 'wolf', x: wolf.x, z: wolf.z, level: lureLevel(a, PERSON_FRIEND_PULL) });

  const world: AgentWorld = {
    others, wind: input.wind, daylight: input.daylight,
    food: { forage: forageSource(input.forage) }, lures, walkable: input.walkable,
  };
  stepAgent(a, world, input.dt);
  if (a.action === 'scan' && a.goal.includes('water')) s.water = Math.min(100, s.water + PERSON_DRINK_PER_S * input.dt);
  s.water = Math.max(0, s.water - PERSON_WATER_DRAIN_PER_S * input.dt);
  const out = readout(s);
  reads.set(body.key, out);
  return out;
}
