/**
 * The shared animal pipeline (Grok Bot, rabbit-clover; Matthew: "all animals should share the same pipeline").
 * Pure TypeScript: no three.js, no DOM. Species-agnostic: every number comes from a species record (core/agent/species).
 *
 *   senses (core/senses scentLevel + sight + hearing)  ->  internal levels (energy, stamina, relaxation)
 *     ->  goal selection (utilities from the levels and what is sensed)  ->  action + motion  ->  contact transactions
 *
 * Rules:
 *  - Nothing moves without a cause the animal can sense or feel: food it senses (approach), the next bite of the patch it is on
 *    (step), a sensed threat (flee), habitat it senses (seek: brighter ground where its food grows). With no cause it rests
 *    or scans in place. Randomness is only natural variation in timing and path (species `timing.jitter`, `flee.zig`).
 *  - Timings are not fixed timers: each bout/scan/alert/flight/pause length is the species' typical value (a calm, fed animal)
 *    scaled by relaxation, hunger and the strength of the sensed cue (see `modulators`).
 *  - Eating is a transaction between the eater and the food on the CONTACTS bus (rising edge when it starts on a patch,
 *    falling edge when it leaves); the food source owns its own units (core/clover grazeTransaction).
 *  - Reserved actions 'held' and 'tame' (the hunting task: pin/bite/hold/release, temporary friendship) are inert here.
 */
import { scentLevel, type SensePoint } from '../senses';
import { CONTACTS } from '../contactBus';
import { clamp01, smoothstep, wrapAngle, angleTurn, stepForward } from '../../proc/math';
import type { AgentSpecies } from './species';

export type Action = 'feed' | 'step' | 'approach' | 'seek' | 'scan' | 'rest' | 'alert' | 'flee' | 'pause' | 'hide' | 'held' | 'tame';
export type Pose = 'head-down' | 'head-up' | 'move' | 'run' | 'rest' | 'crouch';
/** Something the animal can perceive as a possible threat (the player wolf, later other agents). */
export interface Other extends SensePoint { key: string; kind: string; speed: number; crouched?: boolean }
export interface FoodItem extends SensePoint { key: string; r: number; units: number }
/** A food source in the world (core/clover field). */
export interface FoodSource {
  at(x: number, z: number, pad?: number): FoodItem | undefined;
  nearest(x: number, z: number, range: number, except?: string): FoodItem | undefined;
  eat(key: string, units: number, by: string): number;
}
export interface AgentWorld {
  others: readonly Other[];
  wind: SensePoint;
  /** 0 night .. 1 day (render/sky light.night complement) */ daylight: number;
  /** per diet kind */ food: Record<string, FoodSource | undefined>;
  /** habitat quality the animal can sense at a point (e.g. sunlit ground for a grazer); optional */ habitat?: (x: number, z: number) => number;
  walkable?: (x: number, z: number) => boolean;
}
export interface Sensed { level: number; sight: number; sound: number; scent: number; moving: boolean; from?: Other; distance: number }
export interface Agent {
  key: string; species: AgentSpecies; x: number; z: number; heading: number;
  action: Action; goal: string; timer: number; elapsed: number;
  energy: number; stamina: number; relaxation: number;
  target?: { x: number; z: number; key?: string }; food?: string; contact?: string; zig: number;
  sensed: Sensed; speed: number; rng: () => number;
}
export interface AgentEvent { type: 'bolt' | 'hop' | 'eat-start' | 'eat-end'; key: string; x: number; z: number; other?: string }

export function createAgent(species: AgentSpecies, key: string, x: number, z: number, rng: () => number, init: Partial<Pick<Agent, 'energy' | 'stamina' | 'relaxation' | 'heading'>> = {}): Agent {
  const L = species.levels;
  return { key, species, x, z, heading: init.heading ?? rng() * Math.PI * 2, action: 'rest', goal: 'settling', timer: 0, elapsed: 0,
    energy: init.energy ?? L.energy.start, stamina: init.stamina ?? L.stamina.max, relaxation: init.relaxation ?? L.relaxation.max, zig: 0,
    sensed: { level: 0, sight: 0, sound: 0, scent: 0, moving: false, distance: Infinity }, speed: 0, rng };
}

// ---- senses -------------------------------------------------------------------------------------------------------------
/** What the animal senses of one other: sight (light x motion or close presence), hearing (footfall noise), scent (core/senses
 *  plume, wind-carried), combined as independent cues and weighted by how much the species fears that kind. */
export function perceive(sp: AgentSpecies, self: SensePoint, o: Other, wind: SensePoint, daylight: number): Sensed {
  const S = sp.senses, fear = sp.fear[o.kind] ?? 0, d = Math.hypot(o.x - self.x, o.z - self.z);
  if (fear <= 0) return { level: 0, sight: 0, sound: 0, scent: 0, moving: false, from: o, distance: d };
  const vision = Math.max(S.sight.night, clamp01(daylight)), motion = smoothstep(S.sight.motion[0], S.sight.motion[1], o.speed);
  const presence = clamp01(1 - d / S.sight.presence) * (o.crouched ? S.sight.crouched : 1);
  const sight = clamp01(vision * Math.max(motion * clamp01(1 - d / S.sight.range), presence));
  const sound = clamp01(smoothstep(S.hearing.loud[0], S.hearing.loud[1], o.speed) * clamp01(1 - d / S.hearing.range) ** 2);
  const scent = scentLevel(self, { key: o.key, kind: o.kind, x: o.x, z: o.z, potency: S.scent.potency }, wind);
  const level = fear * (1 - (1 - sight) * (1 - sound) * (1 - scent));
  return { level, sight, sound, scent, moving: motion > S.sight.movingAt || sound > S.hearing.movingAt, from: o, distance: d };
}
export function senseThreats(a: Agent, w: AgentWorld): Sensed {
  let best: Sensed = { level: 0, sight: 0, sound: 0, scent: 0, moving: false, distance: Infinity };
  for (const o of w.others) { if (o.key === a.key) continue; const s = perceive(a.species, a, o, w.wind, w.daylight); if (s.level > best.level) best = s; }
  return best;
}

// ---- levels -> modulators -----------------------------------------------------------------------------------------------
/** calm 0..1 (relaxation), nerve = 1 - calm, hunger 0..1 (energy below the species' fed level). */
export function moods(a: Pick<Agent, 'species' | 'relaxation' | 'energy'>) {
  const L = a.species.levels, calm = clamp01(a.relaxation / L.relaxation.max), fed = L.energy.fed;
  return { calm, nerve: 1 - calm, hunger: clamp01((fed - a.energy) / fed) };
}
/** Emergent timings and thresholds. At calm 1, hunger 0 and a mid cue (.5) every length equals the species' typical value. */
export function modulators(a: Pick<Agent, 'species' | 'relaxation' | 'energy' | 'stamina'>, cue = .5) {
  const T = a.species.timing, M = a.species.mood, { calm, nerve, hunger } = moods(a);
  return {
    feedBout: T.feed * (1 - M.boutNerve * nerve) * (1 + M.boutHunger * hunger),
    scanChance: clamp01(M.scanChance[0] + (M.scanChance[1] - M.scanChance[0]) * nerve - M.scanHunger * hunger),
    scan: T.scan * (1 + M.scanNerve * nerve) * (1 - M.scanHungerShort * hunger),
    noticeAt: (M.notice[0] + (M.notice[1] - M.notice[0]) * calm) * (1 + M.noticeHunger * hunger),
    fleeAt: M.bolt[0] + (M.bolt[1] - M.bolt[0]) * calm + M.boltHunger * hunger,
    alert: Math.max(T.alertMin, T.alert * (.5 + .5 * calm) * (1.5 - clamp01(cue))),
    flee: T.flee * (.7 + .6 * clamp01(cue)) * (1 + M.fleeNerve * nerve) * Math.min(1, a.stamina / M.fleeStaminaFull),
    pause: T.pause * (1 - M.pauseNerve * nerve),
  };
}
/** Energy, stamina and relaxation for one step (rates from the species record). */
export function updateLevels(a: Agent, dt: number, sensed: Sensed, eatenUnits = 0, unitsPerEnergy = Infinity) {
  const L = a.species.levels, fleeing = a.action === 'flee';
  a.energy = Math.max(0, Math.min(L.energy.max, a.energy - L.energy.drain * (fleeing ? L.energy.fleeMult : 1) * dt + eatenUnits / unitsPerEnergy));
  a.stamina = Math.max(0, Math.min(L.stamina.max, a.stamina + (fleeing ? -L.stamina.max / L.stamina.drainSeconds : L.stamina.max / L.stamina.recoverSeconds) * dt));
  // Relaxation settles toward what the senses report (habituation): a steady faint cue holds it part-way down
  // (max x (1 - level / panic)) instead of draining it to 0; it falls fast toward that level, recovers slowly, and flight
  // pushes it down further.
  const R = L.relaxation, settle = R.max * clamp01(1 - sensed.level / R.panic);
  if (a.relaxation > settle) a.relaxation = Math.max(settle, a.relaxation - R.threatDrop * sensed.level * dt);
  else if (!fleeing) a.relaxation = Math.min(settle, a.relaxation + R.recover * dt);
  if (fleeing) a.relaxation -= R.fleeDrop * dt;
  a.relaxation = Math.max(0, Math.min(R.max, a.relaxation));
}

// ---- goal selection -------------------------------------------------------------------------------------------------------
const jitter = (a: Agent) => 1 + a.species.timing.jitter * (a.rng() * 2 - 1);
function setAction(a: Agent, action: Action, goal: string, seconds = 0) { a.action = action; a.goal = goal; a.timer = seconds; a.elapsed = 0; }
function foodFor(a: Agent, w: AgentWorld) { for (const [kind, diet] of Object.entries(a.species.diet)) { const src = w.food[kind]; if (src) return { kind, diet, src }; } return undefined; }
/** Relaxed choice: feed here, approach sensed food, seek habitat, rest, or scan; utilities from the levels and what is sensed. */
export function decide(a: Agent, w: AgentWorld) {
  const U = a.species.utility, { nerve, hunger } = moods(a), m = modulators(a), f = foodFor(a, w), L = a.species.levels;
  const here = f?.src.at(a.x, a.z), near = f?.src.nearest(a.x, a.z, a.species.reach.food, a.food);
  const noise = () => (a.rng() * 2 - 1) * U.noise;
  const options: [number, () => void][] = [
    [here ? U.feedHere + hunger : -Infinity, () => { a.food = here!.key; setAction(a, 'feed', `grazing ${here!.key}`, m.feedBout * jitter(a)); }],
    [near ? U.approach + hunger - Math.hypot(near.x - a.x, near.z - a.z) / U.approachDistance : -Infinity,
      () => { a.target = { x: near!.x, z: near!.z, key: near!.key }; setAction(a, 'approach', `trotting to sensed ${f!.kind} ${near!.key}`); }],
    [U.rest * (1 - a.stamina / L.stamina.max) + (a.energy >= L.energy.full ? U.restFull : 0) + U.restBase,
      () => setAction(a, 'rest', a.stamina < L.stamina.max * .9 ? 'resting to recover stamina' : a.energy >= L.energy.full ? 'resting: full' : 'resting: nothing to do', (a.species.timing.rest[0] + a.rng() * (a.species.timing.rest[1] - a.species.timing.rest[0])))],
    [U.scan * nerve, () => setAction(a, 'scan', 'scanning: still uneasy', m.scan * jitter(a))],
  ];
  if (!near && !here && w.habitat && hunger > 0) {
    const pick = bestHabitat(a, w);
    if (pick) options.push([U.seek * hunger + U.seekBase, () => { a.target = pick; setAction(a, 'seek', 'hungry, no food sensed: heading for sunlit ground'); }]);
  }
  let best = options[0], bu = -Infinity; for (const o of options) { const u = o[0] + (Number.isFinite(o[0]) ? noise() : 0); if (u > bu) { bu = u; best = o; } }
  best[1]();
}
function bestHabitat(a: Agent, w: AgentWorld) {
  const R = a.species.reach.seek, here = w.habitat!(a.x, a.z); let best: { x: number; z: number } | undefined, bh = here + .05;
  for (let k = 0; k < 8; k++) { const ang = a.heading + k * Math.PI / 4, x = a.x - Math.sin(ang) * R, z = a.z - Math.cos(ang) * R;
    if (w.walkable && !w.walkable(x, z)) continue; const h = w.habitat!(x, z); if (h > bh) { bh = h; best = { x, z }; } }
  return best;
}
function endContact(a: Agent, events: AgentEvent[]) { if (a.contact) { if (CONTACTS.end(a.key, a.contact)) events.push({ type: 'eat-end', key: a.key, x: a.x, z: a.z, other: a.contact }); a.contact = undefined; } }
function beginContact(a: Agent, food: FoodItem, events: AgentEvent[]) {
  if (a.contact === food.key) return; endContact(a, events); a.contact = food.key;
  if (CONTACTS.begin({ a: a.key, b: food.key, at: [a.x, 0, a.z], normal: [0, 1, 0], kind: 'feed', source: 'agent:feed' })) events.push({ type: 'eat-start', key: a.key, x: a.x, z: a.z, other: food.key });
}
const headingTo = (a: Agent, x: number, z: number) => Math.atan2(-(x - a.x), -(z - a.z)); // heading 0 faces -z (proc/math stepForward)
const awayFrom = (a: Agent, o: SensePoint) => Math.atan2(o.x - a.x, o.z - a.z); // the heading whose forward points from o through a

function startFlight(a: Agent, s: Sensed, events: AgentEvent[]) {
  if (a.stamina <= 0) { setAction(a, 'hide', 'too tired to run: freezing'); return; }
  endContact(a, events); setAction(a, 'flee', `fleeing ${s.from?.kind ?? 'threat'} (${cueName(s)})`, modulators(a, s.level).flee * jitter(a)); a.zig = 0;
  if (s.from) a.heading = awayFrom(a, s.from); events.push({ type: 'bolt', key: a.key, x: a.x, z: a.z });
}
const cueName = (s: Sensed) => s.sight >= s.sound && s.sight >= s.scent ? 'seen' : s.sound >= s.scent ? 'heard' : 'smelled';

/** One step of the pipeline. Moves the agent and returns events (sound cues, contact edges). */
export function stepAgent(a: Agent, w: AgentWorld, dt: number): AgentEvent[] {
  const events: AgentEvent[] = [], sp = a.species, s = senseThreats(a, w); a.sensed = s;
  if (a.action === 'held' || a.action === 'tame') { a.speed = 0; updateLevels(a, dt, s); return events; }
  const m = modulators(a, s.level), f = foodFor(a, w); a.timer -= dt; a.elapsed += dt; let speed = 0, eaten = 0;
  // threat interrupts (any calm action)
  const calmAction = a.action !== 'alert' && a.action !== 'flee' && a.action !== 'pause' && a.action !== 'hide';
  if (calmAction && s.level >= m.noticeAt) { endContact(a, events); setAction(a, 'alert', `head up: ${cueName(s)} ${s.from?.kind ?? 'something'}`, m.alert * jitter(a)); }
  switch (a.action) {
    case 'alert':
      if (s.level >= m.fleeAt || (s.moving && s.level >= m.noticeAt && a.elapsed >= sp.timing.react)) { startFlight(a, s, events); break; }
      if (s.from) a.heading = angleTurn(a.heading, headingTo(a, s.from.x, s.from.z), 4 * dt); // turns an ear and an eye to it
      if (a.timer <= 0) { if (s.level >= m.noticeAt) setAction(a, 'alert', `watching ${s.from?.kind ?? 'something'}`, m.alert * jitter(a)); else decide(a, w); }
      break;
    case 'flee': {
      const F = sp.flee; a.zig -= dt;
      if (a.zig <= 0 && s.from) { a.zig = F.zig[0] + a.rng() * (F.zig[1] - F.zig[0]); a.heading = awayFrom(a, s.from) + (a.rng() * 2 - 1) * F.zigAngle; }
      speed = a.elapsed < F.burstSeconds ? sp.speed.flee : sp.speed.fleeTired;
      if (a.stamina <= 0) setAction(a, 'hide', 'out of stamina: freezing');
      else if (a.timer <= 0) setAction(a, 'pause', 'pausing to check behind', m.pause * jitter(a));
      break; }
    case 'pause':
      if (s.from) a.heading = angleTurn(a.heading, headingTo(a, s.from.x, s.from.z), 3 * dt);
      if (a.timer <= 0) { if (s.level >= m.noticeAt * sp.mood.resume && a.stamina > 0) startFlight(a, s, events); else decide(a, w); }
      break;
    case 'hide':
      if (s.level < m.noticeAt * sp.mood.resume || (a.stamina >= sp.levels.stamina.max * sp.mood.unhide && s.moving)) { if (s.level >= m.noticeAt && s.moving) startFlight(a, s, events); else decide(a, w); }
      break;
    case 'feed': {
      const item = a.food ? f?.src.at(a.x, a.z, .1) : undefined;
      if (!item || item.key !== a.food || item.units <= 0) { endContact(a, events); decide(a, w); break; }
      beginContact(a, item, events);
      eaten = f!.src.eat(item.key, f!.diet.eatUnits / f!.diet.eatSeconds * dt, a.key);
      if (a.timer <= 0) {
        if (item.units <= 0) { endContact(a, events); a.food = undefined; decide(a, w); }
        else if (a.rng() < m.scanChance) setAction(a, 'scan', 'lifting head between bites', m.scan * jitter(a));
        else { // next section of the plant: a short step forward, kept inside the patch
          const reach = sp.reach.step[0] + a.rng() * (sp.reach.step[1] - sp.reach.step[0]), turn = (a.rng() * 2 - 1) * sp.reach.stepTurn;
          let p = stepForward(a.x, a.z, a.heading + turn, reach, 1);
          if (Math.hypot(p.x - item.x, p.z - item.z) > item.r * .85) { const back = headingTo(a, item.x + (a.rng() - .5) * item.r, item.z + (a.rng() - .5) * item.r); p = stepForward(a.x, a.z, back, reach, 1); }
          a.target = { ...p, key: item.key }; setAction(a, 'step', `next section of ${item.key}`);
        }
      }
      break; }
    case 'scan':
      if (a.timer <= 0) { const here = f?.src.at(a.x, a.z, .1); if (here) { a.food = here.key; setAction(a, 'feed', `grazing ${here.key}`, m.feedBout * jitter(a)); } else decide(a, w); }
      break;
    case 'rest': if (a.timer <= 0) decide(a, w); break;
    case 'step': case 'approach': case 'seek': {
      const t = a.target; if (!t) { decide(a, w); break; }
      const d = Math.hypot(t.x - a.x, t.z - a.z); a.heading = angleTurn(a.heading, headingTo(a, t.x, t.z), 5 * dt);
      speed = a.action === 'step' ? sp.speed.feedStep : sp.speed.approach;
      if (a.action === 'approach' && a.elapsed === dt) events.push({ type: 'hop', key: a.key, x: a.x, z: a.z });
      const item = a.action !== 'seek' && t.key ? f?.src.at(a.x, a.z, 0) : undefined;
      if (item && item.key === t.key && (a.action === 'approach' || d < .05)) { a.target = undefined; a.food = item.key; beginContact(a, item, events); setAction(a, 'feed', `grazing ${item.key}`, m.feedBout * jitter(a)); speed = 0; }
      else if (d < Math.max(.05, speed * dt)) { a.target = undefined; if (a.action === 'step' && a.food) setAction(a, 'feed', `grazing ${a.food}`, m.feedBout * jitter(a)); else decide(a, w); speed = 0; }
      else if (a.elapsed > sp.reach.giveUp) { a.target = undefined; decide(a, w); speed = 0; }
      break; }
  }
  // motion (turns back from unwalkable ground)
  if (speed > 0) { const n = stepForward(a.x, a.z, a.heading, speed, dt); if (!w.walkable || w.walkable(n.x, n.z)) { a.x = n.x; a.z = n.z; } else a.heading = wrapAngle(a.heading + Math.PI * .6); }
  a.speed = speed;
  updateLevels(a, dt, s, eaten, f?.diet.unitsPerEnergy);
  return events;
}
export const poseOf = (a: Pick<Agent, 'action'>): Pose => ({ feed: 'head-down', step: 'head-down', approach: 'move', seek: 'move', scan: 'head-up', alert: 'head-up', pause: 'head-up', flee: 'run', rest: 'rest', hide: 'crouch', held: 'crouch', tame: 'rest' } as const)[a.action];
/** Species display name of the current action (the hare's own words: graze, alert, flight, relax ...). */
export const actionName = (a: Pick<Agent, 'action' | 'species'>) => a.species.labels[a.action] ?? a.action;
