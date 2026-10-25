/**
 * Hunting II (T-0014): pin, bite, hold, consume, release. One transaction row per verb on the wolf|hare pair.
 * The contact is the level. Nothing here uses a timer. Friendship strength is exp(-(now-at)/tau).
 *
 * Numbers are read from SYSTEM_PROPERTIES.hunt. Pose offsets that already live on the rig are duplicated here
 * so this module does not import animals/hare.ts (that file imports the sim, which imports this). Tests check
 * the duplicates against HARE_BODY / HARE_SKIN.
 */
import { SYSTEM_PROPERTIES } from '../config/systemProperties';
import { CONTACTS } from './contactBus';
import { TRANSACTIONS } from './transactions';
import { dietOf } from './needs/diet';
import { HARE_NEEDS, WOLF_NEEDS } from './needs/species';
import { record } from './deltas';
import { GROUND } from './ground';
import { HEAD_AT, JAW_AT, LEG_XZ, wolfTeeth } from './wolfBody';
import { WOLF_SCALE } from './wolfModes';
import { ikReach, WOLF_GIRDLE_Z, WOLF_LEGS } from './animalBehavior';
import { gapeDegrees } from './skeleton';

const P = SYSTEM_PROPERTIES.hunt;
/** Play-seconds of the friend memory, the floor exp(-1), and the gut allometry. Pose figures are the rig's. */
export const HUNT_HOLD = {
  friendTau: P.friendTau as number,
  friendFloor: P.friendFloor as number,
  gutA: P.gutA as number,
  gutB: P.gutB as number,
  /** HARE_SKIN.neck[0].ry (m). Diameter is twice this. */
  neckRy: 0.023,
  /** Modelled nose-to-rump (m), inside ADW head-body 361-479 mm. The pose error is divided by this. */
  bodyLength: 0.45,
  /** Hare hip in front of the wolf origin at heading 0 (m). Inside catchPounce. */
  ahead: 0.4,
  /** HARE_BODY.shoulderZ (m, forward is negative). */
  shoulderZ: -0.12,
  /** HARE_PLAN.track.fore (m): half the fore-track width, the scapula's lateral place. */
  scapulaX: 0.03,
  /** Standing scapula height (m): hip 0.13 plus the shoulder above it. */
  scapulaY: 0.17,
  /** Nape in hare space, hip at the origin, forward -z (m). Between the shoulder (-0.12) and the head (-0.27). */
  napeY: 0.08,
  napeZ: -0.18,
};

/** Wet stomach + caecum + upper colon (kg) from body mass (kg). Belovsky 1984, Theor. Popul. Biol. 25:235, n=6, r^2=0.99.
 *  The paper's mass axis is read as kilograms (a 1.5 kg hare gives ~0.15 kg, ~10 %). Mendel & Mendel 1909, J. Exp. Med.
 *  11:36, put a rabbit's stomach + cecum near 10 % of body weight. If the 1984 fit was grams, this reading is high. */
export const gutContentsKg = (massKg: number) => HUNT_HOLD.gutA * massKg ** HUNT_HOLD.gutB;

/** Closed form. `now` and `at` are the same clock (play / sim seconds, not world-seconds). */
export const friendStrength = (at: number, now: number, tau = HUNT_HOLD.friendTau) => Math.exp(-(now - at) / tau);
/** Live while strength is still at or above the floor, so t = tau (exp(-1)) is still a friend. The next instant is not. */
export const friendLive = (at: number, now: number, tau = HUNT_HOLD.friendTau) => friendStrength(at, now, tau) >= HUNT_HOLD.friendFloor - 1e-12;
/** 1 at a perfect match. |measured - expected| of 1 scores 0. */
export const decayScore = (measured: number, expected: number) => 1 - Math.min(1, Math.abs(measured - expected));
/** 1 when the error is 0. 0 when the error reaches `scale` (the hare's body length). */
export const poseScore = (error: number, scale = HUNT_HOLD.bodyLength) => 1 - Math.min(1, error / Math.max(scale, 1e-9));

export interface HoldPrey { key: string; x: number; z: number; massKg: number }
export interface HoldBond { at: number; tau: number; species: string; key: string }
export interface HoldBag {
  phase: 'none' | 'pinned' | 'held';
  preyKey?: string; wolfKey?: string; squeals: number;
  energy: number; water: number; remainsKg: number;
  bond?: HoldBond; prey?: HoldPrey; now: number;
}
export interface HoldArgs { bag: HoldBag; prey: HoldPrey; now: number }
/** What the wolf rig applies while a prey is in the jaws. Radians. Jaw opens downward. */
export interface HoldVisual { jaw: number; head: number; fore: number }

export const emptyBag = (): HoldBag => ({ phase: 'none', squeals: 0, energy: 0, water: 0, remainsKg: 0, now: 0 });

let onSqueal: ((prey: HoldPrey) => void) | undefined;
/** The bite row calls this once, on the rising edge. The game passes the hare-squeak clip. */
export const setSqueal = (fn?: (prey: HoldPrey) => void) => { onSqueal = fn; };

const SRC_PIN = 'Mech 2014, Canadian Field-Naturalist 128(2), doi:10.22621/cfn.v128i2.1584: a wolf caught an Arctic hare leveret with the forepaws and grasped it in the mouth. The observation is a leveret; it is applied here to an adult snowshoe hare.';
const SRC_BITE = `${SRC_PIN} One squeal on the bite edge: ADW Lepus americanus (loud squealing when captured); Minnesota DNR (loud screams when attacked); Macaulay Library ML55380 (Algonquin, 19 Jun 1951, screamed when held, then released).`;
const SRC_HOLD = 'Mech 2014 (same note): the leveret was carried alive by the nape. Limp hang is tonic immobility, not a timer.';
const SRC_EAT = 'Energy is dietOf(WOLF_NEEDS).meal on tissue = body mass minus gut contents. Gut: Belovsky 1984, Theor. Popul. Biol. 25:235, 0.096*W^1.03. The remainder is a carcass delta (Wilmers et al. 2003, already on DELTA_KINDS.carcass).';
const SRC_FRIEND = 'Whishaw, Flannigan & Barnsley 1979, Dev. Psychobiol. 12:595: tonic immobility lasts seconds to several minutes (citing Gallup & Maser 1977). Matthew 2026-10-21: friendship about 3 min. That is 180 play seconds (the game clock is 12x, so 180 world-seconds would feel like 15 s).';

let rowsReady = false;
export function ensureHuntRows() {
  if (rowsReady) return;
  rowsReady = true;
  TRANSACTIONS.add({ a: 'wolf', b: 'hare', verb: 'pin', name: 'pin', needsContact: true, source: SRC_PIN, run(a: HoldArgs) {
    a.bag.phase = 'pinned'; a.bag.preyKey = a.prey.key; a.bag.prey = a.prey; a.bag.now = a.now; return 1;
  } });
  TRANSACTIONS.add({ a: 'wolf', b: 'hare', verb: 'bite', name: 'bite', needsContact: true, source: SRC_BITE, run(a: HoldArgs) {
    if (a.bag.squeals === 0) { a.bag.squeals = 1; onSqueal?.(a.prey); }
    a.bag.phase = 'held'; a.bag.preyKey = a.prey.key; a.bag.prey = a.prey; a.bag.now = a.now; return a.bag.squeals;
  } });
  TRANSACTIONS.add({ a: 'wolf', b: 'hare', verb: 'hold', name: 'hold', needsContact: true, source: SRC_HOLD, run(a: HoldArgs) {
    a.bag.phase = 'held'; a.bag.preyKey = a.prey.key; a.bag.prey = a.prey; a.bag.now = a.now; return 1;
  } });
  TRANSACTIONS.add({ a: 'wolf', b: 'hare', verb: 'consume', name: 'consume', needsContact: true, source: SRC_EAT, run(a: HoldArgs) {
    const gut = gutContentsKg(a.prey.massKg), tissue = Math.max(0, a.prey.massKg - gut);
    const meal = dietOf(WOLF_NEEDS).meal(WOLF_NEEDS, 'hare', tissue);
    a.bag.energy = meal.energy; a.bag.water = meal.water; a.bag.remainsKg = gut; a.bag.now = a.now;
    record({ kind: 'carcass', x: a.prey.x, z: a.prey.z, t: GROUND.years, m: gut, meta: a.prey.key });
    a.bag.phase = 'none'; a.bag.preyKey = undefined; a.bag.prey = undefined; return meal.energy;
  } });
  TRANSACTIONS.add({ a: 'wolf', b: 'hare', verb: 'release', name: 'release', needsContact: true, source: SRC_FRIEND, run(a: HoldArgs) {
    a.bag.bond = { at: a.now, tau: HUNT_HOLD.friendTau, species: 'hare', key: a.prey.key };
    a.bag.phase = 'none'; a.bag.preyKey = undefined; a.bag.prey = undefined; a.bag.now = a.now; return 1;
  } });
}

const preyMass = () => HARE_NEEDS.body.massKg.v;
export const preyOf = (id: number, x: number, z: number, massKg = preyMass()): HoldPrey => ({ key: `hare:${id}`, x, z, massKg });

/** Rising edge: begin the hunt contact if needed, then pin, bite, hold. A second call on the same prey only re-runs hold. */
export function engageHold(wolfKey: string, preyKey: string, prey: HoldPrey, now: number, bag: HoldBag): HoldBag {
  ensureHuntRows();
  if (CONTACTS.touching(wolfKey, preyKey).length === 0) {
    CONTACTS.begin({ a: wolfKey, b: preyKey, at: [prey.x, 0, prey.z], normal: [0, 1, 0], kind: 'hunt', source: 'hunt:hold' });
  }
  bag.wolfKey = wolfKey; bag.now = now;
  const same = bag.phase !== 'none' && bag.preyKey === preyKey;
  if (!same) bag.squeals = 0;
  const args = { bag, prey, now };
  if (!same) { TRANSACTIONS.run(wolfKey, preyKey, args, 'pin'); TRANSACTIONS.run(wolfKey, preyKey, args, 'bite'); }
  TRANSACTIONS.run(wolfKey, preyKey, args, 'hold');
  return bag;
}
export function consumeHold(bag: HoldBag, prey: HoldPrey, now: number) {
  ensureHuntRows();
  const wolfKey = bag.wolfKey ?? 'wolf:player';
  const energy = TRANSACTIONS.run(wolfKey, prey.key, { bag, prey, now }, 'consume');
  CONTACTS.end(wolfKey, prey.key);
  bag.squeals = 0;
  return energy;
}
export function releaseHold(bag: HoldBag, prey: HoldPrey, now: number) {
  ensureHuntRows();
  const wolfKey = bag.wolfKey ?? 'wolf:player';
  const n = TRANSACTIONS.run(wolfKey, prey.key, { bag, prey, now }, 'release');
  CONTACTS.end(wolfKey, prey.key);
  bag.squeals = 0;
  return n;
}

const dist = (a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
/** Heading 0 faces -z. A model offset (already in world metres) yaws about +y. */
export function yawOf(h: number, p: { x: number; y: number; z: number }) {
  const c = Math.cos(h), s = Math.sin(h);
  return { x: p.x * c + p.z * s, y: p.y, z: -p.x * s + p.z * c };
}
/** Right-handed rotation about +x (three.js rotation.x). */
export function rotX(pitch: number, p: { x: number; y: number; z: number }) {
  const c = Math.cos(pitch), s = Math.sin(pitch);
  return { x: p.x, y: p.y * c - p.z * s, z: p.y * s + p.z * c };
}

let canineMemo: { x: number; y: number; z: number } | undefined;
/** Upper canine, world metres from the wolf origin at heading 0. Head + tooth, times WOLF_SCALE. */
export function upperCanine() {
  if (canineMemo) return canineMemo;
  const t = wolfTeeth().find(n => !n.jaw && n.h > 0.01);
  if (!t) return canineMemo = { x: 0, y: HEAD_AT[1] * WOLF_SCALE, z: HEAD_AT[2] * WOLF_SCALE };
  return canineMemo = {
    x: (HEAD_AT[0] + t.at[0]) * WOLF_SCALE,
    y: (HEAD_AT[1] + t.at[1]) * WOLF_SCALE,
    z: (HEAD_AT[2] + t.at[2]) * WOLF_SCALE,
  };
}
/** Paw reach from the glenoid: IK chord of the upper+lower plus the foot (m). */
export const pawReach = () => ikReach(WOLF_LEGS) + (WOLF_LEGS.foot ?? 0);

const napeLocal = () => ({ x: 0, y: HUNT_HOLD.napeY, z: HUNT_HOLD.napeZ });
/** Pitch that puts the nape straight above the hip (the body hangs). */
export const carryPitch = () => Math.atan2(-HUNT_HOLD.napeZ, HUNT_HOLD.napeY);

export interface PinLayout {
  reach: number; pawToScapula: number; pinScore: number; standError: number; standScore: number;
  glenoid: { x: number; y: number; z: number }; scapula: { x: number; y: number; z: number };
}
/** Canonical pin at heading 0: hare hip `ahead` metres in front, scapulae on the fore track, glenoids at the shoulders. */
export function pinLayout(heading = 0): PinLayout {
  const reach = pawReach();
  const gx = Math.abs(LEG_XZ[0][0]) * WOLF_SCALE;
  const glenoid = yawOf(heading, { x: -gx, y: WOLF_LEGS.hip, z: WOLF_GIRDLE_Z[0] });
  const scapula = yawOf(heading, { x: -HUNT_HOLD.scapulaX, y: HUNT_HOLD.scapulaY, z: -HUNT_HOLD.ahead + HUNT_HOLD.shoulderZ });
  const pawToScapula = dist(glenoid, scapula);
  const standing = yawOf(heading, { x: -gx, y: 0, z: WOLF_GIRDLE_Z[0] });
  const standError = dist(standing, scapula);
  return {
    reach, pawToScapula, pinScore: poseScore(Math.max(0, pawToScapula - reach)), standError, standScore: poseScore(standError),
    glenoid, scapula,
  };
}

export interface CarryPlace {
  pitch: number; hip: { x: number; y: number; z: number }; nape: { x: number; y: number; z: number }; canine: { x: number; y: number; z: number };
}
/** Hip so the pitched nape sits on the upper canine. */
export function carryPlace(wolf: { x: number; z: number; heading: number }): CarryPlace {
  const pitch = carryPitch();
  const nape = yawOf(wolf.heading, rotX(pitch, napeLocal()));
  const canine = yawOf(wolf.heading, upperCanine());
  const at = { x: wolf.x + canine.x, y: canine.y, z: wolf.z + canine.z };
  return { pitch, canine: at, nape: at, hip: { x: at.x - nape.x, y: at.y - nape.y, z: at.z - nape.z } };
}
/** Nape-to-canine error. The carry place scores 0. A hare left on the ground at the pin spot does not. */
export function carryError(wolf: { x: number; z: number; heading: number }, pitched: boolean) {
  const place = carryPlace(wolf);
  if (pitched) return dist(place.nape, place.canine);
  const hipOff = yawOf(wolf.heading, { x: 0, y: 0, z: -HUNT_HOLD.ahead });
  const napeOff = yawOf(wolf.heading, napeLocal());
  const nape = { x: wolf.x + hipOff.x + napeOff.x, y: napeOff.y, z: wolf.z + hipOff.z + napeOff.z };
  return dist(nape, place.canine);
}

/** Jaw opening that clears the neck, and the published gape at the wolf's mass. */
export function graspAngle() {
  const t = wolfTeeth().find(n => !n.jaw && n.h > 0.01);
  const jawLen = t ? Math.hypot(t.at[0] - JAW_AT[0], t.at[1] - JAW_AT[1], t.at[2] - JAW_AT[2]) * WOLF_SCALE : 0.2;
  const neck = HUNT_HOLD.neckRy * 2;
  const rad = 2 * Math.asin(Math.min(1, (neck / 2) / Math.max(jawLen, 1e-6)));
  const gape = gapeDegrees(WOLF_NEEDS.body.massKg.v, jawLen) * Math.PI / 180;
  return { rad, jawLen, gape, neck };
}
/** Nose-down head (gather uses +0.65), jaw open by the grasp angle, fore legs reaching. */
export function holdVisual(): HoldVisual {
  return { jaw: graspAngle().rad, head: 0.55, fore: 0.9 };
}

ensureHuntRows();
