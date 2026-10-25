/**
 * The shared animal pipeline (Grok Bot, T-0009; Matthew: "all animals should share the same pipeline"). Ported from grok/rabbit-clover onto core/agent.ts.
 * Pure TypeScript: no three.js, no DOM. Species-agnostic: every number comes from an AgentSpecies record (core/species BEHAVIOUR).
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
 *    falling edge when it leaves); the food source owns its own units (core/fields grazeTransaction).
 *  - Reserved actions 'held' and 'tame' (the hunting task: pin/bite/hold/release, temporary friendship) are inert here.
 */
import { scentLevel, type SensePoint } from './senses';
import { addFeces, bestAvoid, traceHits, type TraceHit } from './traces';
import { CONTACTS } from './contactBus';
import { clamp01, smoothstep, wrapAngle, angleTurn, stepForward } from '../proc/math';
import { f, scope } from '../proc/trace';
import type { Motion, Problem } from './animalBehavior';

export interface AgentSpecies {
  id: string;
  /** display words for actions (the debug readout and future UI) */ labels: Partial<Record<string, string>>;
  senses: {
    /** range m; night = vision floor in the dark (0..1); motion = speed (m/s) band from 'not moving' to 'clearly moving';
     *  presence = m within which a still body is seen; crouched = presence factor for a crouched body; movingAt = motion share
     *  that counts as moving */
    sight: { range: number; night: number; motion: [number, number]; presence: number; crouched: number; movingAt: number };
    /** range m; loud = speed band (m/s) from silent to loud footfalls; movingAt = sound level that counts as moving */
    hearing: { range: number; loud: [number, number]; movingAt: number };
    /** potency of an other's body odor; range (m) is this nose's cutoff for a trace delta (T-0019) */ scent: { potency: number; range: number };
  };
  /** how much each kind of other is feared (0 = ignored) */ fear: Record<string, number>;
  levels: {
    /** energy 0..max; drain per s at rest; fleeMult x drain while fleeing; fed = above this no hunger; full = rests to digest */
    energy: { max: number; start: number; drain: number; fleeMult: number; fed: number; full: number };
    /** stamina: fleeing empties it in drainSeconds; recovers 0 -> max in recoverSeconds of not fleeing */
    stamina: { max: number; drainSeconds: number; recoverSeconds: number };
    /** relaxation: settles toward max x (1 - cue / panic) (habituation to a steady cue); falls at threatDrop x cue per s, recovers
     *  at `recover` per s, and drops a further fleeDrop per s while fleeing */
    relaxation: { max: number; threatDrop: number; fleeDrop: number; recover: number; panic: number };
  };
  /** typical seconds for a calm, fed animal; jitter = +- share of natural variation; react = s before a moving cue can bolt it */
  timing: { feed: number; scan: number; alert: number; alertMin: number; /** s an alert animal holds (freezes) before a moving or rising cue may bolt it */ react: number; /** rad/s the body turns toward the cue while alert (default 4); 0 = a motionless freeze */ alertTurn?: number; flee: number; pause: number; rest: [number, number]; jitter: number };
  /** how relaxation (calm/nerve), hunger and cue strength bend the timings and thresholds (pipeline `modulators`) */
  mood: { boutNerve: number; boutHunger: number; scanChance: [number, number]; scanHunger: number; scanNerve: number; scanHungerShort: number;
    notice: [number, number]; noticeHunger: number; bolt: [number, number]; boltHunger: number; fleeNerve: number; fleeStaminaFull: number;
    pauseNerve: number; resume: number; unhide: number };
  /** relaxed-choice utilities (pipeline `decide`). `investigate` weights a lure (a scent or a seen prey); omitted = the hare, which has none. */
  utility: { feedHere: number; approach: number; approachDistance: number; rest: number; restFull: number; restBase: number; scan: number; seek: number; seekBase: number; noise: number; investigate?: number };
  /** m: food sensed within `food`; habitat probed at `seek`; a feeding step [min, max] and turn (rad); giveUp s for a move */
  reach: { food: number; seek: number; step: [number, number]; stepTurn: number; giveUp: number };
  speed: { feedStep: number; approach: number; flee: number; fleeTired: number; /** m/s^2 from a standstill into flight; omitted = instant */ accel?: number };
  flee: { burstSeconds: number; zig: [number, number]; zigAngle: number; /** flight initiation distance (m): a threat this close bolts it at once */ distance?: number };
  /** per food kind: units eaten per eatSeconds, units per +1 energy */ diet: Record<string, { eatUnits: number; eatSeconds: number; unitsPerEnergy: number }>;
  /**
   * Trace response (T-0019). `response` uses the fear scale: -1 avoids that delta kind, +1 is attracted, 0 only smells it.
   * Droppings, when present, turn eaten units into faeces. The gut writes a delta at one pellet or one pellet group.
   */
  traces: {
    response: Partial<Record<'scent' | 'carcass' | 'droppings', number>>;
    droppings?: { /** dry grams of one deposit */ groupG: number; /** dry faeces grams added per eat unit */ fecesGPerUnit: number; /** sim bite is wet kg; clover units in one wet kg (hare) */ unitsPerWetKg?: number };
  };
  /**
   * Herd row (T-0011). Absent on the hare, and every branch below stays off without it, so the hare path does not call these
   * numbers. Vigilance share, alarm delay, cohesion and the bite that fires a chew. No dice: bout lengths are `herdBouts`.
   */
  social?: {
    /** m: a mate inside this is linked */ link: number;
    /** head-up share when alone (0..1). The intercept is an estimate when the paper only publishes the slope. */ loneVigilance: number;
    /** feeding-share gained per extra linked mate */ vigilancePerMate: number;
    /** group size (1 + mates) at which the slope stops */ vigilanceCap: number;
    /** m: snort audibility */ snort: number;
    /** m/s: speed of sound, for an acoustic cue's travel time */ sound: number;
    /** s: minimum orient; a weaker cue takes attend/cue */ attend: number;
    /** relaxation at or above this, with the cue gone, returns the deer to grazing */ calmAt: number;
    /** m: farther from the group centre than this, the body turns toward it */ cohesionAt: number;
    /** rad/s of that turn */ cohesion: number;
    /** g fresh per bite; a chew event fires each time grazing crosses it */ biteG: number;
    /** rad: flee bend away from the group centre (confusion) */ scatter: number;
    /** rad/s body turn while alert or fleeing */ turn: number;
  };
}

export type Action = 'feed' | 'step' | 'approach' | 'seek' | 'scan' | 'rest' | 'alert' | 'flee' | 'pause' | 'hide' | 'held' | 'tame';
export type Pose = 'head-down' | 'head-up' | 'move' | 'run' | 'rest' | 'crouch';
/** Something the animal can perceive as a possible threat (the player wolf, later other agents). */
export interface Other extends SensePoint { key: string; kind: string; speed: number; crouched?: boolean;
  /** 0 open .. 1 hidden. Multiplies sight only (sound and scent still carry). Canopy closure at the body. */ cover?: number }
/** A herd-mate as a percept: posture and a snort from the previous step, not this one (alarm cannot lap the herd in one frame). */
export interface Mate { key: string; x: number; z: number; heading: number; action: Action; speed: number; alarmed: boolean; snort: boolean }
export interface FoodItem extends SensePoint { key: string; r: number; units: number }
/** A food source in the world (core/fields field). */
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
  /** Something smelled or seen that is not eaten here (a scent plume, a prey body, water). The animal approaches it; it does not feed. */
  lures?: readonly { key: string; kind: string; x: number; z: number; level: number }[];
  /** habitat quality the animal can sense at a point (e.g. sunlit ground for a grazer); optional */ habitat?: (x: number, z: number) => number;
  walkable?: (x: number, z: number) => boolean;
  /** Herd percepts. Omitted for a species with no social row. */ mates?: readonly Mate[];
}
export interface Sensed { level: number; sight: number; sound: number; scent: number; moving: boolean; from?: Other; distance: number;
  /** m to the mate (or the threat) that carried the cue. Flight-initiation uses `distance`, which a herd cue sets to Infinity so the mate is not the predator. */ cueDistance?: number;
  /** the acoustic cue leads sight, so the delay includes travel time */ heard?: boolean }
export interface Agent {
  key: string; species: AgentSpecies; x: number; z: number; heading: number;
  action: Action; goal: string; timer: number; elapsed: number;
  energy: number; stamina: number; relaxation: number;
  target?: { x: number; z: number; key?: string }; food?: string; contact?: string; zig: number;
  /** g fresh taken since the last chew (social species). 0 for the hare. */ bitten: number;
  sensed: Sensed; speed: number; rng: () => number;
}
export interface AgentEvent { type: 'bolt' | 'hop' | 'eat-start' | 'eat-end' | 'chew' | 'snort'; key: string; x: number; z: number; other?: string }

export function createAgent(species: AgentSpecies, key: string, x: number, z: number, rng: () => number, init: Partial<Pick<Agent, 'energy' | 'stamina' | 'relaxation' | 'heading'>> = {}): Agent {
  const L = species.levels;
  return { key, species, x, z, heading: init.heading ?? rng() * Math.PI * 2, action: 'rest', goal: 'settling', timer: 0, elapsed: 0,
    energy: init.energy ?? L.energy.start, stamina: init.stamina ?? L.stamina.max, relaxation: init.relaxation ?? L.relaxation.max, zig: 0, bitten: 0,
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
  // Cover is the hidden fraction (canopy closure). Sight falls in proportion; this is not a Beer-Lambert path.
  const open = 1 - clamp01(o.cover ?? 0);
  const sight = clamp01(vision * open * Math.max(motion * clamp01(1 - d / S.sight.range), presence));
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

/** Mates inside the link distance. */
export function linkedMates(a: Pick<Agent, 'key' | 'x' | 'z' | 'species'>, w: Pick<AgentWorld, 'mates'>): number {
  const S = a.species.social; if (!S || !w.mates) return 0;
  let n = 0;
  for (const m of w.mates) if (m.key !== a.key && Math.hypot(m.x - a.x, m.z - a.z) <= S.link) n++;
  return n;
}
/**
 * Vigilance share from the feeding-time slope. `linked` is extra animals inside the link.
 * extra mates past vigilanceCap-1 do not add (the female plateau at group size 4). Share is clamped so a bout stays finite.
 */
export function groupVigilance(sp: AgentSpecies, linked: number) {
  const S = sp.social;
  if (!S) return { share: 0, feeding: 1, grazeShare: 1 };
  const extra = Math.min(Math.max(0, linked), Math.max(0, S.vigilanceCap - 1));
  const feeding = (1 - S.loneVigilance) + S.vigilancePerMate * extra;
  const share = Math.min(.95, Math.max(.02, 1 - feeding));
  return { share, feeding, grazeShare: 1 - share };
}
/** Head-up and head-down seconds. At calm and fed, scan/(scan+feed) equals the vigilance share. No roll. */
export function herdBouts(a: Pick<Agent, 'species' | 'relaxation' | 'energy'>, linked: number) {
  const { nerve, hunger } = moods(a), M = a.species.mood, { share, grazeShare } = groupVigilance(a.species, linked);
  const scan = a.species.timing.scan * (1 + M.scanNerve * nerve) * (1 - M.scanHungerShort * hunger);
  const feed = scan * (grazeShare / share) * (1 + M.boutHunger * hunger) * (1 - M.boutNerve * nerve);
  return { scan, feed, share };
}
/** Seconds before a herd cue bolts the animal: sound-travel when the cue was heard, plus attention that lengthens as the cue weakens. */
export function alarmDelay(distance: number, cue: number, heard: boolean, sp: Pick<AgentSpecies, 'social'>) {
  const S = sp.social; if (!S) return 0;
  return (heard ? distance / S.sound : 0) + S.attend / Math.max(cue, .05);
}
const alarmingMate = (m: Mate) => m.snort || m.alarmed || m.action === 'flee' || m.action === 'alert' || m.action === 'pause';
/** Strongest herd cue this step, or undefined when no mate is alarming inside the link. Distance is Infinity: the mate is not the predator. */
export function senseHerd(a: Agent, w: AgentWorld): Sensed | undefined {
  const S = a.species.social; if (!S || !w.mates?.length) return undefined;
  const sp = a.species; let best: Sensed | undefined;
  for (const m of w.mates) {
    if (m.key === a.key || !alarmingMate(m)) continue;
    const d = Math.hypot(m.x - a.x, m.z - a.z); if (d > S.link) continue;
    const vision = Math.max(sp.senses.sight.night, clamp01(w.daylight));
    const speed = m.action === 'flee' ? Math.max(m.speed, sp.senses.sight.motion[1]) : m.speed;
    const motion = smoothstep(sp.senses.sight.motion[0], sp.senses.sight.motion[1], speed);
    const posture = (m.action === 'alert' || m.action === 'pause' || m.action === 'flee' || m.alarmed) ? clamp01(1 - d / sp.senses.sight.presence) : 0;
    const sight = clamp01(vision * Math.max(motion * clamp01(1 - d / sp.senses.sight.range), posture));
    const hoof = clamp01(smoothstep(sp.senses.hearing.loud[0], sp.senses.hearing.loud[1], speed) * clamp01(1 - d / sp.senses.hearing.range) ** 2);
    const snort = m.snort ? clamp01(1 - d / S.snort) ** 2 : 0;
    const sound = Math.max(hoof, snort);
    const level = 1 - (1 - sight) * (1 - sound);
    if (level <= 0) continue;
    const heard = sound > sight;
    // The threat is behind the fleeing mate (heading 0 faces -z, so behind is +sin, +cos). awayFrom that point runs with the mate.
    const from: Other = { key: m.key, kind: 'wolf', x: m.x + Math.sin(m.heading) * 8, z: m.z + Math.cos(m.heading) * 8, speed: 0 };
    const sensed: Sensed = { level, sight, sound, scent: 0, moving: motion > sp.senses.sight.movingAt || sound > sp.senses.hearing.movingAt, from, distance: Infinity, cueDistance: d, heard };
    if (!best || sensed.level > best.level) best = sensed;
  }
  return best;
}
/** Threats, unless a herd cue is stronger. A hare (no social row) is exactly senseThreats. */
function senseNow(a: Agent, w: AgentWorld): Sensed {
  const threat = senseThreats(a, w);
  if (!a.species.social) return threat;
  scope(a.key);
  f('herd', 'linked', linkedMates(a, w));
  const herd = senseHerd(a, w);
  f('herd', 'alarm', herd?.level ?? 0);
  f('herd', 'mates', w.mates?.length ?? 0);
  scope('');
  if (herd && herd.level > threat.level) return herd;
  if (threat.level > 0 && threat.sound > threat.sight && threat.sound >= threat.scent) return { ...threat, heard: true, cueDistance: threat.distance };
  return threat;
}
/** Heading toward the group centre when it is farther than cohesionAt, else undefined (stay on the current heading). */
export function herdYaw(a: Agent, w: AgentWorld): number | undefined {
  const S = a.species.social; if (!S || !w.mates) return undefined;
  let cx = 0, cz = 0, n = 0;
  for (const m of w.mates) { if (m.key === a.key || Math.hypot(m.x - a.x, m.z - a.z) > S.link) continue; cx += m.x; cz += m.z; n++; }
  if (!n) return undefined;
  cx /= n; cz /= n;
  if (Math.hypot(cx - a.x, cz - a.z) <= S.cohesionAt) return undefined;
  return headingTo(a, cx, cz);
}
/** Signed bend (rad) away from the linked group centre while fleeing. Same sign as needs/social scatterBend. */
function herdScatter(a: Agent, w: AgentWorld): number {
  const S = a.species.social, threat = a.sensed.from;
  if (!S || !w.mates || !S.scatter || !threat) return 0;
  let cx = 0, cz = 0, n = 0;
  for (const m of w.mates) { if (m.key === a.key || Math.hypot(m.x - a.x, m.z - a.z) > S.link) continue; cx += m.x; cz += m.z; n++; }
  if (!n) return 0;
  cx /= n; cz /= n;
  const ax = a.x - threat.x, az = a.z - threat.z, gx = a.x - cx, gz = a.z - cz;
  return (ax * gz - az * gx >= 0 ? -1 : 1) * S.scatter;
}
/** Rig posture. feed/step graze; scan scans; alert/pause/hide alert; flee flees; approach/seek walk; anything else scans. */
export function deerPosture(action: Action): 'graze' | 'scan' | 'alert' | 'flee' | 'walk' {
  if (action === 'feed' || action === 'step') return 'graze';
  if (action === 'alert' || action === 'pause' || action === 'hide') return 'alert';
  if (action === 'flee') return 'flee';
  if (action === 'approach' || action === 'seek') return 'walk';
  if (action === 'scan') return 'scan';
  return 'scan';
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
/** True when the percept is at or above the notice threshold for these levels. A calm animal (relaxation at max)
 *  needs a stronger cue than a nervous one: noticeAt rises with calm (mood.notice). */
export function notices(sp: AgentSpecies, sensed: Sensed, relaxation: number, energy: number, stamina: number) {
  return sensed.level >= modulators({ species: sp, relaxation, energy, stamina }, sensed.level).noticeAt;
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
  const social = a.species.social;
  // A herd animal does not roll a preference. The hare still does (utility.noise).
  const noise = () => social ? 0 : (a.rng() * 2 - 1) * U.noise;
  const bouts = () => herdBouts(a, linkedMates(a, w));
  const restSpan = a.species.timing.rest;
  const options: [number, () => void][] = [
    [here && (!social || hunger > 0) ? U.feedHere + hunger : -Infinity, () => { a.food = here!.key; setAction(a, 'feed', `grazing ${here!.key}`, social ? bouts().feed : m.feedBout * jitter(a)); }],
    [near ? U.approach + hunger - Math.hypot(near.x - a.x, near.z - a.z) / U.approachDistance : -Infinity,
      () => { a.target = { x: near!.x, z: near!.z, key: near!.key }; setAction(a, 'approach', `trotting to sensed ${f!.kind} ${near!.key}`); }],
    [U.rest * (1 - a.stamina / L.stamina.max) + (a.energy >= L.energy.full ? U.restFull : 0) + U.restBase,
      () => setAction(a, 'rest', a.stamina < L.stamina.max * .9 ? 'resting to recover stamina' : a.energy >= L.energy.full ? 'resting: full' : 'resting: nothing to do', social ? (restSpan[0] + restSpan[1]) / 2 : restSpan[0] + a.rng() * (restSpan[1] - restSpan[0]))],
    [U.scan * nerve, () => setAction(a, 'scan', 'scanning: still uneasy', social ? bouts().scan : m.scan * jitter(a))],
  ];
  if (!near && !here && w.habitat && hunger > 0) {
    const pick = bestHabitat(a, w);
    if (pick) options.push([U.seek * hunger + U.seekBase, () => { a.target = pick; setAction(a, 'seek', 'hungry, no food sensed: heading for sunlit ground'); }]);
  }
  // A lure is a cause the animal can smell or see (T-0010). Inside about one body length it holds; farther, it approaches.
  // 1.2 m is a game clearance so the body does not step onto the plume. Hare rows leave `investigate` unset and pass no lures.
  const lure = (U.investigate ?? 0) > 0 ? bestLure(a, w) : undefined;
  if (lure) {
    const d = Math.hypot(lure.x - a.x, lure.z - a.z);
    const u = (U.investigate ?? 0) * lure.level + hunger * U.approach;
    if (d < 1.2) options.push([u, () => setAction(a, 'scan', `holding on ${lure.kind} ${lure.key}`, m.scan * jitter(a))]);
    else options.push([u, () => { a.target = { x: lure.x, z: lure.z, key: lure.key }; setAction(a, 'approach', `following ${lure.kind} ${lure.key}`); }]);
  }
  let best = options[0], bu = -Infinity; for (const o of options) { const u = o[0] + (Number.isFinite(o[0]) ? noise() : 0); if (u > bu) { bu = u; best = o; } }
  best[1]();
}
function bestLure(a: Agent, w: AgentWorld) {
  let best: { key: string; kind: string; x: number; z: number; level: number } | undefined;
  for (const l of w.lures ?? []) {
    if (l.level <= 0) continue;
    if (!best || l.level > best.level + 1e-9 || (Math.abs(l.level - best.level) <= 1e-9 && l.key < best.key)) best = l;
  }
  return best;
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
  endContact(a, events);
  // A herd animal has no rolled flight length and snorts as it bolts. The hare keeps the jittered flee bout.
  const seconds = a.species.social ? 0 : modulators(a, s.level).flee * jitter(a);
  setAction(a, 'flee', `fleeing ${s.from?.kind ?? 'threat'} (${cueName(s)})`, seconds); a.zig = 0;
  if (s.from) a.heading = awayFrom(a, s.from);
  events.push({ type: 'bolt', key: a.key, x: a.x, z: a.z });
  if (a.species.social) events.push({ type: 'snort', key: a.key, x: a.x, z: a.z, other: s.from?.key });
}
const cueName = (s: Sensed) => s.sight >= s.sound && s.sight >= s.scent ? 'seen' : s.sound >= s.scent ? 'heard' : 'smelled';

/** Herd alert: bolt inside the flight distance, else wait out the cue's delay, else settle once relaxation has recovered. No timer renewal. */
function socialWatch(a: Agent, w: AgentWorld, s: Sensed, m: ReturnType<typeof modulators>, events: AgentEvent[], dt: number): number {
  const sp = a.species, social = sp.social!;
  const delay = alarmDelay(s.cueDistance ?? s.distance, s.level, !!s.heard, sp);
  scope(a.key); f('herd', 'delay', delay); scope('');
  const wolfClose = sp.flee.distance !== undefined && s.distance <= sp.flee.distance;
  if (wolfClose || (a.elapsed >= delay && s.level >= m.noticeAt && (s.level >= m.fleeAt || s.moving))) { startFlight(a, s, events); return 0; }
  if (s.level < m.noticeAt && a.relaxation >= social.calmAt) { decide(a, w); return 0; }
  if (s.from) a.heading = angleTurn(a.heading, headingTo(a, s.from.x, s.from.z), social.turn * dt);
  return 0;
}
/** Herd flight lasts while the cue stays above notice and stamina remains. No zig roll and no pause timer. */
function socialFlee(a: Agent, w: AgentWorld, s: Sensed, m: ReturnType<typeof modulators>, dt: number): number {
  const sp = a.species, social = sp.social!, F = sp.flee;
  if (a.stamina <= 0) { setAction(a, 'hide', 'out of stamina: freezing'); return 0; }
  if (s.level < m.noticeAt) { setAction(a, 'alert', 'cue lost, settling', 0); return 0; }
  let speed = a.elapsed < F.burstSeconds ? sp.speed.flee : sp.speed.fleeTired;
  if (sp.speed.accel !== undefined) speed = Math.min(speed, a.speed + sp.speed.accel * dt);
  const aim = s.from ? awayFrom(a, s.from) + herdScatter(a, w) : a.heading;
  a.heading = angleTurn(a.heading, aim, social.turn * dt);
  return speed;
}
/** Graze in place. A chew fires each time the fresh mass crosses one bite. The bout ends in a head-up, not a rolled step. */
function socialGraze(a: Agent, w: AgentWorld, f: ReturnType<typeof foodFor>, events: AgentEvent[], dt: number): number {
  const social = a.species.social!;
  const item = a.food ? f?.src.at(a.x, a.z, .1) : undefined;
  if (!item || item.key !== a.food || item.units <= 0) { endContact(a, events); decide(a, w); return 0; }
  beginContact(a, item, events);
  const eaten = f!.src.eat(item.key, f!.diet.eatUnits / f!.diet.eatSeconds * dt, a.key);
  a.bitten += eaten;
  while (a.bitten >= social.biteG) { a.bitten -= social.biteG; events.push({ type: 'chew', key: a.key, x: a.x, z: a.z, other: item.key }); }
  if (a.timer <= 0) { endContact(a, events); setAction(a, 'scan', 'head up between bites', herdBouts(a, linkedMates(a, w)).scan); }
  return eaten;
}
function socialScan(a: Agent, w: AgentWorld, f: ReturnType<typeof foodFor>) {
  const here = f?.src.at(a.x, a.z, .1);
  if (here && moods(a).hunger > 0) { a.food = here.key; setAction(a, 'feed', `grazing ${here.key}`, herdBouts(a, linkedMates(a, w)).feed); }
  else decide(a, w);
}

/** Positive trace responses become lures. An avoid is handled before the bout, so it is not also a lure. */
function attractWorld(a: Agent, w: AgentWorld, hits: readonly TraceHit[]): AgentWorld {
  if ((a.species.utility.investigate ?? 0) <= 0) return w;
  const extra = hits.filter(h => h.weight > 0 && h.level > 0).map(h => ({ key: h.key, kind: h.kind, x: h.x, z: h.z, level: h.level * h.weight }));
  return extra.length ? { ...w, lures: [...(w.lures ?? []), ...extra] } : w;
}
/** One step of the pipeline. Moves the agent and returns events (sound cues, contact edges). */
export function stepAgent(a: Agent, w: AgentWorld, dt: number): AgentEvent[] {
  const events: AgentEvent[] = [], sp = a.species, s = senseNow(a, w); a.sensed = s;
  if (a.action === 'held' || a.action === 'tame') { a.speed = 0; updateLevels(a, dt, s); return events; }
  const m = modulators(a, s.level), social = sp.social; a.timer -= dt; a.elapsed += dt; let speed = 0, eaten = 0;
  const hits = traceHits(a.species, a, w.wind, a.heading);
  // A live body outranks a trace. Otherwise a fresh mark or carcass is the cause of leaving, and a carcass can be a lure.
  const avoid = s.level < m.noticeAt ? bestAvoid(hits, m.noticeAt) : undefined;
  if (!avoid) w = attractWorld(a, w, hits);
  const f = foodFor(a, w);
  // threat interrupts (any calm action). A herd animal does not roll the freeze length.
  const calmAction = a.action !== 'alert' && a.action !== 'flee' && a.action !== 'pause' && a.action !== 'hide';
  if (avoid) {
    if (a.contact) endContact(a, events);
    a.target = undefined;
    // The odor is the direction. Heading 0 faces -z, and this is the same away-heading as a live threat.
    a.heading = awayFrom(a, avoid);
    const hot = avoid.level >= m.fleeAt;
    speed = hot ? sp.speed.flee : sp.speed.approach;
    const goal = `avoiding ${avoid.kind}`;
    if (a.goal !== goal) setAction(a, hot ? 'flee' : 'approach', goal);
    else a.action = hot ? 'flee' : 'approach';
  } else {
  if (calmAction && s.level >= m.noticeAt) { endContact(a, events); setAction(a, 'alert', `head up: ${cueName(s)} ${s.from?.kind ?? 'something'}`, social ? 0 : m.alert * jitter(a)); }
  switch (a.action) {
    case 'alert':
      if (social) { speed = socialWatch(a, w, s, m, events, dt); break; }
      // freeze first, then flee (species timing.react); a threat inside the flight initiation distance bolts it at once
      if ((sp.flee.distance !== undefined && s.distance <= sp.flee.distance) || (a.elapsed >= sp.timing.react && (s.level >= m.fleeAt || (s.moving && s.level >= m.noticeAt)))) { startFlight(a, s, events); break; }
      if (s.from) a.heading = angleTurn(a.heading, headingTo(a, s.from.x, s.from.z), (sp.timing.alertTurn ?? 4) * dt); // turns an ear and an eye to it (a freezing species: not at all)
      if (a.timer <= 0) { if (s.level >= m.noticeAt) { const held = a.elapsed; setAction(a, 'alert', `watching ${s.from?.kind ?? 'something'}`, m.alert * jitter(a)); a.elapsed = held; } else decide(a, w); } // still watching: the freeze keeps counting
      break;
    case 'flee': {
      if (social) { speed = socialFlee(a, w, s, m, dt); break; }
      const F = sp.flee; a.zig -= dt;
      if (a.zig <= 0 && s.from) { a.zig = F.zig[0] + a.rng() * (F.zig[1] - F.zig[0]); a.heading = awayFrom(a, s.from) + (a.rng() * 2 - 1) * F.zigAngle; }
      speed = a.elapsed < F.burstSeconds ? sp.speed.flee : sp.speed.fleeTired;
      if (sp.speed.accel !== undefined) speed = Math.min(speed, a.speed + sp.speed.accel * dt); // accelerating over the first bounds
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
      if (social) { eaten = socialGraze(a, w, f, events, dt); break; }
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
      if (social) { if (a.timer <= 0) socialScan(a, w, f); break; }
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
  }
  // A calm herd animal that has drifted past cohesionAt turns back toward the group. Flight, the alert freeze and a trace avoid do not.
  if (!avoid && social && a.action !== 'flee' && a.action !== 'alert' && a.action !== 'pause' && w.mates?.length) {
    const yaw = herdYaw(a, w); if (yaw !== undefined) a.heading = angleTurn(a.heading, yaw, social.cohesion * dt);
  }
  // motion (turns back from unwalkable ground)
  if (speed > 0) { const n = stepForward(a.x, a.z, a.heading, speed, dt); if (!w.walkable || w.walkable(n.x, n.z)) { a.x = n.x; a.z = n.z; } else a.heading = wrapAngle(a.heading + Math.PI * .6); }
  a.speed = speed;
  updateLevels(a, dt, s, eaten, f?.diet.unitsPerEnergy);
  if (eaten > 0) addFeces(sp, a.key, a.x, a.z, eaten);
  return events;
}
export const poseOf = (a: Pick<Agent, 'action'>): Pose => ({ feed: 'head-down', step: 'head-down', approach: 'move', seek: 'move', scan: 'head-up', alert: 'head-up', pause: 'head-up', flee: 'run', rest: 'rest', hide: 'crouch', held: 'crouch', tame: 'rest' } as const)[a.action];
/** Species display name of the current action (the hare's own words: graze, alert, flight, relax ...). */
export const actionName = (a: Pick<Agent, 'action' | 'species'>) => a.species.labels[a.action] ?? a.action;

/** Debug readout: levels and the current goal. */
export function agentReadout(a: Pick<Agent, 'key' | 'energy' | 'stamina' | 'relaxation' | 'goal'>) {
  const n = (v: number) => Math.round(v);
  return `${a.key} energy ${n(a.energy)} stamina ${n(a.stamina)} relaxation ${n(a.relaxation)} goal ${a.goal}`;
}
/** Copy the plan onto a locomotion brain. Does not call AnimalBrain.decide; the brain keeps gait and footfalls. */
export function writeLocomotion(brain: { heading: number; speed: number; motion: Motion; problem: Problem }, a: Pick<Agent, 'heading' | 'speed' | 'action'>) {
  brain.heading = a.heading;
  brain.speed = a.speed;
  brain.motion = a.speed <= 0.05 ? 'idle' : a.action === 'flee' ? 'run' : 'walk';
  brain.problem = a.action === 'flee' ? 'escape'
    : (a.action === 'feed' || a.action === 'scan' || a.action === 'step' || a.action === 'approach' || a.action === 'seek') ? 'feed'
    : (a.action === 'rest' || a.action === 'hide') ? 'recover' : 'explore';
}
export interface AgentSnap { energy: number; stamina: number; relaxation: number; action: Action; goal: string; x: number; z: number; heading: number; bitten: number }
export function agentSnapshot(a: Agent): AgentSnap {
  return { energy: a.energy, stamina: a.stamina, relaxation: a.relaxation, action: a.action, goal: a.goal, x: a.x, z: a.z, heading: a.heading, bitten: a.bitten };
}
export function restoreAgent(a: Agent, s: AgentSnap) {
  a.energy = s.energy; a.stamina = s.stamina; a.relaxation = s.relaxation;
  a.action = s.action; a.goal = s.goal; a.x = s.x; a.z = s.z; a.heading = s.heading; a.bitten = s.bitten ?? 0;
}
