/**
 * Headless animal simulation (T-0036; Matthew 01:57: "the ecosystem depends on a lot more animals, they should be implemented
 * without needing a visual rendering"). PUBLIC MODULE PATH: src/core/sim (keep stable; the ecosystem task builds on it).
 *
 * Pure data + logic, no Three.js: every animal runs the same species template (core/needs/template) through the shared
 * needs engine, stamina, senses, diet (carnivore/herbivore) and group awareness, on a fixed-step tick. Renderers
 * (animals/hare.ts, thought bubbles, the halo) only READ this state through a thin adapter; an embodied animal is
 * `controlled`: its adapter writes x/z/heading/speed/mode/pouncing, the sim gives it needs, senses and capture.
 *
 *   const w = createWorld({ seed, passable, daylight: () => 1 });
 *   const a = createAnimal(w, 'hare', { x, z });     // any id in NEEDS_SPECIES
 *   tick(w, dt);                                     // fixed sub-steps of w.step (coarse ticks allowed: set w.step)
 *   nearbyAnimals(w, x, z, r) / nearbyFood(w, x, z, r) / nearbyWater(w, x, z, r) / takeEvents(w)
 */
import { NEEDS_SPECIES } from '../needs/species';
import type { SpeciesTemplate } from '../needs/template';
import { createNeeds, levelsOf, staminaRates, stepNeeds, type NeedsState } from '../needs/engine';
import { perceive, SENSE_RULES, type Body } from '../needs/senses';
import { notices, perceive as agentPerceive } from '../agent';
import { HARE_AGENT } from '../species';
import { addFeces, bestAvoid, traceHits } from '../traces';
import { boltDistance, captured, dietOf, evadeStep, gameSpeed, HUNT, startEvade, type EvadeState } from '../needs/diet';
import { consumeHold, emptyBag, engageHold, friendLive, preyOf, releaseHold, carryPlace, type HoldBag } from '../huntHold';
import { scatterBend, vigilance } from '../needs/social';
import { chooseGoal } from '../needs/behaviour';
import { stream } from '../../proc/rng';
import { stepForward } from '../../proc/math';
import { SYSTEM_PROPERTIES } from '../../config/systemProperties';
export const SIM = SYSTEM_PROPERTIES.sim;
export type SimState = 'graze' | 'move' | 'freeze' | 'flee' | 'rest' | 'stalk' | 'chase' | 'eat' | 'drink';
export interface SimAnimal {
  id: number; species: string; sp: SpeciesTemplate; x: number; z: number; heading: number; speed: number;
  state: SimState; timer: number; needs: NeedsState; energy: number; stamina: number; alive: boolean;
  /** embodied by the player: the adapter moves it; the sim only senses/feeds/captures */ controlled?: boolean;
  mode?: string; pouncing?: boolean; crouched?: boolean; /** 0 open .. 1 canopy hiding this body (sight only; core/agent perceive) */ cover?: number;
  /** Set while a handling capture is holding this prey in the jaws (T-0014). The id is the wolf's. */
  heldBy?: number; /** Wolf id this prey was released by, and the sim time of that release. */ friendOf?: number; friendAt?: number;
  ev?: EvadeState; level: number; /** s: start of the current own detection; last time it perceived the predator */ seenAt?: number; lastSeen?: number; knowsAt?: number; relayed: boolean; linked: number;
  targetId?: number; pounce: number; pounceCool: number; bite: number; rng: () => number;
}
export interface Food { id: number; kind: string; x: number; z: number; kg: number }
export interface SimEvent { type: 'caught' | 'bolt' | 'ate' | 'relay' | 'pinned'; by?: number; id: number; x: number; z: number; food?: string }
export interface SimWorld {
  time: number; step: number; /** game seconds per sim second (core/timeOfDay clock) */ timeScale: number; seed: number;
  animals: SimAnimal[]; food: Food[]; events: SimEvent[]; nextId: number; acc: number;
  passable: (x: number, z: number) => boolean; water: (x: number, z: number) => boolean;
  daylight: () => number; wind: () => { x: number; z: number }; hour: () => number;
  /** Player captures pin instead of deleting the prey. NPC captures still remove and eat. */ handling: boolean;
  /** The player's pin/bite/hold bag. One set of jaws. */ hold: HoldBag;
}
export interface WorldOptions { seed?: number; step?: number; timeScale?: number; passable?: SimWorld['passable']; water?: SimWorld['water']; daylight?: SimWorld['daylight']; wind?: SimWorld['wind']; hour?: SimWorld['hour']; handling?: boolean }
export function createWorld(o: WorldOptions = {}): SimWorld {
  return { time: 0, step: o.step ?? SIM.step, timeScale: o.timeScale ?? SIM.timeScale, seed: o.seed ?? 1, animals: [], food: [], events: [], nextId: 1, acc: 0,
    passable: o.passable ?? (() => true), water: o.water ?? (() => false), daylight: o.daylight ?? (() => 1), wind: o.wind ?? (() => ({ x: 0, z: 0 })), hour: o.hour ?? (() => 12),
    handling: !!o.handling, hold: emptyBag() };
}
export function createAnimal(w: SimWorld, species: string, pos: { x: number; z: number; heading?: number }, init: Partial<Pick<SimAnimal, 'controlled' | 'energy' | 'needs'>> = {}): SimAnimal {
  const sp = NEEDS_SPECIES[species]; if (!sp) throw new Error(`unknown species ${species}`);
  const id = w.nextId++, rng = stream(w.seed, `sim-${species}:${id}`);
  const a: SimAnimal = { id, species, sp, x: pos.x, z: pos.z, heading: pos.heading ?? rng() * 6.283, speed: 0, state: 'graze', timer: 1 + rng() * 3,
    needs: init.needs ?? createNeeds(), energy: init.energy ?? 100, stamina: 100, alive: true, controlled: init.controlled, level: 0, relayed: false, linked: 0,
    pounce: 0, pounceCool: 0, bite: 0, rng };
  w.animals.push(a); return a;
}
export const addFood = (w: SimWorld, kind: string, x: number, z: number, kg: number): Food => { const f = { id: w.nextId++, kind, x, z, kg }; w.food.push(f); return f; };
export const removeAnimal = (w: SimWorld, a: SimAnimal) => { a.alive = false; const i = w.animals.indexOf(a); if (i >= 0) w.animals.splice(i, 1); };
export const takeEvents = (w: SimWorld) => w.events.splice(0);

// --- spatial grid (rebuilt per step: O(n)) -----------------------------------------------------------------
type Grid = Map<string, SimAnimal[]>;
const key = (x: number, z: number) => `${Math.floor(x / SIM.cell)},${Math.floor(z / SIM.cell)}`;
function grid(list: readonly SimAnimal[]): Grid { const g: Grid = new Map(); for (const a of list) { const k = key(a.x, a.z); (g.get(k) ?? g.set(k, []).get(k)!).push(a); } return g; }
function around(g: Grid, x: number, z: number, r: number, out: SimAnimal[] = []) {
  const c = Math.ceil(r / SIM.cell), cx = Math.floor(x / SIM.cell), cz = Math.floor(z / SIM.cell);
  for (let i = -c; i <= c; i++) for (let j = -c; j <= c; j++) for (const a of g.get(`${cx + i},${cz + j}`) ?? []) if (Math.hypot(a.x - x, a.z - z) <= r) out.push(a);
  return out;
}
export const nearbyAnimals = (w: SimWorld, x: number, z: number, r: number, species?: string) => w.animals.filter(a => (!species || a.species === species) && Math.hypot(a.x - x, a.z - z) <= r);
export const nearbyFood = (w: SimWorld, x: number, z: number, r: number, kind?: string) => w.food.filter(f => f.kg > 0 && (!kind || f.kind === kind) && Math.hypot(f.x - x, f.z - z) <= r).sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z));
/** Nearest water within r (ring search at SIM.waterStep), or undefined. */
export function nearbyWater(w: SimWorld, x: number, z: number, r: number) {
  if (w.water(x, z)) return { x, z, distance: 0 };
  for (let d = SIM.waterStep; d <= r; d += SIM.waterStep) for (let k = 0; k < 16; k++) { const a = k / 16 * 6.2832, px = x + Math.sin(a) * d, pz = z + Math.cos(a) * d; if (w.water(px, pz)) return { x: px, z: pz, distance: d }; }
  return undefined;
}
const senseRange = (sp: SpeciesTemplate) => Math.max(sp.senses.sight.rangeM.v, sp.senses.hearing.rangeM.v, SIM.scentRange);
const body = (a: SimAnimal): Body => ({ x: a.x, z: a.z, kind: a.species, speed: Math.abs(a.speed), crouched: a.crouched });
const fears = (a: SimAnimal, b: SimAnimal) => a.sp.behaviour.flight.fears.includes(b.species);
/** The embodied wolf, as a hare reads it through the agent core (speed, crouch, cover, daylight, wind) against a calm
 *  notice threshold. Other pairs keep the template perceive. A calm miss is level 0 so the 0.25 sim gate cannot override it. */
function threatLevel(a: SimAnimal, b: SimAnimal, env: { daylight: number; wind: { x: number; z: number } }) {
  if (!(b.controlled && a.species === 'hare')) return perceive(a.sp, a, body(b), env).level;
  const s = agentPerceive(HARE_AGENT, { x: a.x, z: a.z }, { key: `wolf:${b.id}`, kind: 'wolf', x: b.x, z: b.z, speed: Math.abs(b.speed), crouched: !!b.crouched, cover: b.cover ?? 0 }, env.wind, env.daylight);
  const calm = notices(HARE_AGENT, s, HARE_AGENT.levels.relaxation.max, HARE_AGENT.levels.energy.fed, HARE_AGENT.levels.stamina.max);
  return calm ? Math.max(s.level, SENSE_RULES.notice) : 0;
}
const eatsAnimal = (a: SimAnimal, b: SimAnimal) => a.sp.diet.kind !== 'herbivore' && !!a.sp.diet.foods[b.species];

/** Advance the world by dt seconds in fixed sub-steps of w.step. */
export function tick(w: SimWorld, dt: number) {
  w.acc += dt;
  while (w.acc >= w.step - 1e-9) { w.acc -= w.step; stepWorld(w, w.step); }
}
function stepWorld(w: SimWorld, dt: number) {
  w.time += dt; const g = grid(w.animals), env = { daylight: w.daylight(), wind: w.wind() };
  // 1. senses: each animal perceives the animals it fears (own detection)
  for (const a of w.animals) {
    a.level = 0; let threat: SimAnimal | undefined;
    for (const b of around(g, a.x, a.z, senseRange(a.sp))) if (b !== a && fears(a, b)) { const p = threatLevel(a, b, env); if (p > a.level) { a.level = p; threat = b; } }
    if (a.level >= SENSE_RULES.notice) { if (a.lastSeen === undefined || w.time - a.lastSeen > SYSTEM_PROPERTIES.social.memorySeconds) a.seenAt = w.time; a.lastSeen = w.time; a.targetId = threat!.id; }
    else if (a.lastSeen !== undefined && w.time - a.lastSeen > SYSTEM_PROPERTIES.social.memorySeconds) { a.seenAt = undefined; a.lastSeen = undefined; }
  }
  // 2. group awareness: linked mates (within social.linkM) share detections; each link adds relaySeconds (BFS from detectors)
  for (const a of w.animals) { a.linked = around(g, a.x, a.z, a.sp.social.linkM.v).filter(b => b !== a && b.species === a.species).length; a.relayed = false; }
  const knows = new Map<SimAnimal, number>();
  for (const s of w.animals) {
    if (s.seenAt === undefined) continue;
    const hop = new Map<SimAnimal, number>([[s, 0]]), q = [s];
    while (q.length) { const a = q.shift()!, h = hop.get(a)!; if (h >= SYSTEM_PROPERTIES.social.maxHops) continue;
      for (const b of around(g, a.x, a.z, a.sp.social.linkM.v)) if (b.species === s.species && !hop.has(b)) { hop.set(b, h + 1); q.push(b); } }
    for (const [b, h] of hop) { const t = s.seenAt + s.sp.social.relaySeconds.v * h; if (t <= w.time && (!knows.has(b) || t < knows.get(b)!)) { knows.set(b, t); if (h > 0) { b.relayed = b.seenAt === undefined; if (b.targetId === undefined) b.targetId = s.targetId; } } }
  }
  for (const a of w.animals) a.knowsAt = knows.get(a);
  // 3. act
  for (const a of [...w.animals]) {
    if (!a.alive) continue;
    if (!a.controlled) { if (a.sp.behaviour.flight.fears.length && a.sp.diet.kind === 'herbivore') stepPrey(w, a, dt, g, env); else stepPredator(w, a, dt, g, env); }
    // 4. capture by any predator (NPC or embodied): body contact or a landing pounce
    if (a.sp.diet.kind !== 'herbivore') for (const b of around(g, a.x, a.z, HUNT.catchPounce)) {
      if (!b.alive || b === a || !eatsAnimal(a, b) || !captured(Math.hypot(b.x - a.x, b.z - a.z), !!a.pouncing)) continue;
      if (a.controlled && w.handling && b.species === 'hare') {
        if (b.heldBy === a.id) continue;
        if (w.animals.some(o => o.heldBy === a.id)) continue;
        if (b.friendOf === a.id && b.friendAt !== undefined && friendLive(b.friendAt, w.time)) continue;
        b.heldBy = a.id; b.speed = 0; b.state = 'rest'; b.ev = undefined; b.targetId = undefined;
        engageHold(`wolf:${a.id}`, `hare:${b.id}`, preyOf(b.id, b.x, b.z), w.time, w.hold);
        w.events.push({ type: 'pinned', by: a.id, id: b.id, x: b.x, z: b.z });
        continue;
      }
      removeAnimal(w, b); w.events.push({ type: 'caught', by: a.id, id: b.id, x: b.x, z: b.z });
      if (!a.controlled) { const r = dietOf(a.sp).eat(a.sp, a.needs, a.energy, b.species); a.needs = r.state; a.energy = r.energy; a.state = 'eat'; a.timer = r.meal.seconds; a.targetId = undefined; }
    }
    // 5. needs + stamina through the shared engine (game time for needs; stamina in sim seconds)
    const r = stepNeeds(a.sp, a.needs, { dtGame: dt * w.timeScale, speed: a.speed, energy: a.energy, drinking: a.state === 'drink' });
    a.needs = r.state; if (!a.controlled) a.energy = r.energy;
    const st = staminaRates(a.sp), sprinting = a.state === 'flee' || a.state === 'chase';
    a.stamina = Math.max(0, Math.min(100, a.stamina + (sprinting && a.speed > 0 ? -st.sprint : st.recover) * dt));
  }
  placeHeld(w);
}
function move(w: SimWorld, a: SimAnimal, dt: number) {
  if (a.speed <= 0) return;
  const n = stepForward(a.x, a.z, a.heading, a.speed, dt);
  if (w.passable(n.x, n.z)) { a.x = n.x; a.z = n.z; } else { a.heading += Math.PI * .6; if (a.ev) { a.ev.heading = a.heading; a.ev.aim = a.heading; } }
}
const toward = (a: SimAnimal, x: number, z: number) => Math.atan2(x - a.x, z - a.z) + Math.PI;
/** Prey (herbivore with fears): graze bouts (longer with linked mates), freeze on a known predator, bolt, evade, scatter. */
function placeHeld(w: SimWorld) {
  if (!w.handling) return;
  for (const b of w.animals) {
    if (b.heldBy === undefined) continue;
    const wolf = w.animals.find(a => a.id === b.heldBy);
    if (!wolf) { b.heldBy = undefined; continue; }
    const p = carryPlace({ x: wolf.x, z: wolf.z, heading: wolf.heading });
    b.x = p.hip.x; b.z = p.hip.z; b.speed = 0; b.heading = wolf.heading;
  }
}
/** Drop the jaws and write the friend memory. The render adapter calls this; tests can too. */
export function releasePrey(w: SimWorld, prey: SimAnimal, wolfId: number) {
  releaseHold(w.hold, preyOf(prey.id, prey.x, prey.z), w.time);
  const bond = w.hold.bond;
  prey.heldBy = undefined; prey.friendOf = wolfId; prey.friendAt = w.time; prey.speed = 0; prey.state = 'graze'; prey.ev = undefined; prey.targetId = undefined;
  return bond;
}
/** Eat the held prey: tissue becomes energy on the bag, gut contents become a carcass delta, the prey leaves the world. */
export function consumePrey(w: SimWorld, prey: SimAnimal, _wolfId: number) {
  consumeHold(w.hold, preyOf(prey.id, prey.x, prey.z), w.time);
  const meal = { energy: w.hold.energy, water: w.hold.water, remainsKg: w.hold.remainsKg };
  prey.heldBy = undefined; removeAnimal(w, prey);
  return meal;
}
function stepPrey(w: SimWorld, a: SimAnimal, dt: number, g: Grid, env: { daylight: number; wind: { x: number; z: number } }) {
  if (a.heldBy !== undefined) { a.speed = 0; a.state = 'rest'; return; }
  if (a.friendOf !== undefined) {
    if (a.friendAt === undefined || !friendLive(a.friendAt, w.time)) { a.friendOf = undefined; a.friendAt = undefined; }
    else if (a.targetId === a.friendOf) { a.targetId = undefined; a.level = 0; }
  }
  const threat = a.targetId !== undefined ? w.animals.find(b => b.id === a.targetId) : undefined;
  const d = threat ? Math.hypot(a.x - threat.x, a.z - threat.z) : Infinity, known = a.knowsAt !== undefined && !!threat;
  const stalking = !!threat?.crouched, rand = (lo: number, hi: number) => lo + (hi - lo) * a.rng();
  a.timer -= dt; a.speed = 0;
  if (a.state !== 'flee' && a.state !== 'freeze' && known) { a.state = 'freeze'; a.timer = a.sp.behaviour.alert.reactSeconds.v * rand(.6, 1.6); }
  if (a.state === 'freeze' && threat && (d < boltDistance(a.sp, a.level) || a.timer <= 0 && known && !stalking)) {
    a.state = 'flee'; a.ev = startEvade(a, threat); a.heading = a.ev.heading; w.events.push({ type: 'bolt', id: a.id, x: a.x, z: a.z });
  } else if (a.state === 'freeze' && a.timer <= 0 && !known) { a.state = 'graze'; a.timer = rand(2, 5); }
  if (a.state === 'flee' && threat) {
    const mates = around(g, a.x, a.z, a.sp.social.linkM.v).filter(b => b.species === a.species);
    const r = evadeStep(a.sp, a.ev ?? startEvade(a, threat), a, threat, dt, a.rng, scatterBend(a.sp, mates, mates.indexOf(a), threat), Math.abs(threat.speed), threat.sp.behaviour.evasion.lateralAccel.v);
    a.ev = r.state; a.heading = r.state.heading; a.speed = r.speed;
    if (d > HUNT.safeDistance) { a.state = 'graze'; a.timer = rand(3, 6); a.targetId = undefined; }
  } else if (a.state === 'flee') { a.state = 'graze'; a.timer = rand(3, 6); }
  else if (a.state === 'move') {
    a.speed = a.sp.body.speeds.walk.v;
    if (a.timer <= 0) { a.state = 'graze'; a.timer = rand(2, 6) * vigilance(a.sp, a.linked).graze; } // linked mates: longer graze bouts
  } else if (a.state === 'graze') {
    const food = dietOf(a.sp).goal === 'forage' ? nearbyFood(w, a.x, a.z, SIM.biteReach).find(f => a.sp.diet.foods[f.kind]) : undefined;
    if (food && a.energy < SIM.fullAt) {
      a.bite += dt * vigilance(a.sp, a.linked).grazeShare / (1 - a.sp.social.vigilance.loneShare.v) ; // more mates: more time head-down
      const F = a.sp.diet.foods[food.kind];
      if (a.bite >= F.eatSeconds.v) {
        a.bite = 0; const kg = Math.min(food.kg, F.biteKg.v), r = dietOf(a.sp).eat(a.sp, a.needs, a.energy, food.kind, kg); food.kg -= kg; a.needs = r.state; a.energy = r.energy;
        w.events.push({ type: 'ate', id: a.id, x: a.x, z: a.z, food: food.kind });
        const perKg = a.species === 'hare' ? HARE_AGENT.traces.droppings?.unitsPerWetKg : undefined;
        if (perKg) addFeces(HARE_AGENT, `hare:${a.id}`, a.x, a.z, kg * perKg);
      }
    }
    if (a.timer <= 0) {
      a.state = 'move'; a.timer = rand(.6, 1.4);
      const seen = a.energy < SIM.fullAt ? nearbyFood(w, a.x, a.z, a.sp.senses.sight.rangeM.v).find(f => a.sp.diet.foods[f.kind] && Math.hypot(f.x - a.x, f.z - a.z) > SIM.biteReach) : undefined;
      a.heading = seen ? toward(a, seen.x, seen.z) : a.heading + rand(-1.2, 1.2);
    }
  }
  // A trace is a cause only when one is smelled. An empty log leaves the bout timers alone. A known predator outranks it.
  if (!known && a.species === 'hare') {
    const hit = bestAvoid(traceHits(HARE_AGENT, a, env.wind, a.heading), HARE_AGENT.mood.notice[0]);
    if (hit) {
      a.heading = Math.atan2(hit.x - a.x, hit.z - a.z);
      a.speed = hit.level >= HARE_AGENT.mood.bolt[0] ? HARE_AGENT.speed.flee : HARE_AGENT.speed.approach;
      a.state = 'move';
    }
  }
  move(w, a, dt);
}
/** NPC predator / generalist: behaviour model goal; hunt = stalk the nearest perceived prey, chase on its bolt, pounce. */
function stepPredator(w: SimWorld, a: SimAnimal, dt: number, g: Grid, env: { daylight: number; wind: { x: number; z: number } }) {
  a.timer -= dt; a.pounceCool = Math.max(0, a.pounceCool - dt); a.crouched = false; a.pouncing = a.pounce > 0;
  if (a.pounce > 0) { a.pounce = Math.max(0, a.pounce - dt); move(w, a, dt); return; }
  if (a.state === 'eat' || a.state === 'rest') { a.speed = 0; if (a.timer > 0) return; a.state = 'move'; }
  const hour = w.hour(), choice = chooseGoal(a.sp, levelsOf(a.needs, a.energy), { hour, sunrise: 6, sunset: 18 });
  let prey = a.targetId !== undefined ? w.animals.find(b => b.id === a.targetId) : undefined;
  if (choice.goal === 'hunt' || a.state === 'stalk' || a.state === 'chase') {
    if (!prey) { let best = 0; for (const b of around(g, a.x, a.z, senseRange(a.sp))) if (eatsAnimal(a, b)) { const p = perceive(a.sp, a, body(b), env).level; if (p > best) { best = p; prey = b; } } if (prey && best < SENSE_RULES.notice) prey = undefined; }
    if (prey) {
      a.targetId = prey.id; const d = Math.hypot(prey.x - a.x, prey.z - a.z); a.heading = toward(a, prey.x, prey.z);
      if (a.state !== 'chase' && (prey.state === 'flee' || d < SIM.chaseAt)) a.state = 'chase';
      else if (a.state !== 'chase') a.state = 'stalk';
      if (a.state === 'stalk') { a.crouched = true; a.speed = a.sp.body.speeds.walk.v * SIM.stalkSpeed; }
      else if (a.stamina > 0) { a.speed = gameSpeed(a.sp.behaviour.evasion.burstSpeed.v); if (d < SIM.pounceAt && !a.pounceCool) { a.pounce = SIM.pounceSeconds; a.pounceCool = SIM.pounceCooldown; a.speed *= SIM.pounceCarry; } }
      else { a.state = 'rest'; a.timer = a.sp.stamina.recoverSeconds.v; a.targetId = undefined; a.speed = 0; }
      if (prey.state !== 'flee' && d > HUNT.safeDistance) { a.state = 'move'; a.targetId = undefined; }
    } else a.state = 'move';
  }
  if (a.state === 'move' || a.state === 'graze') {
    a.targetId = undefined;
    if (choice.goal === 'rest' || choice.goal === 'bed-down') { a.state = 'rest'; a.timer = SIM.restBout; a.speed = 0; }
    else { a.speed = a.sp.body.speeds.walk.v; if (a.timer <= 0) { a.timer = 2 + a.rng() * 4; a.heading += (a.rng() - .5) * 1.5; } }
  }
  move(w, a, dt);
}
