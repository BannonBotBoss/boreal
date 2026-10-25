/**
 * Behaviour → animation (T-0020). One row per behaviour: the animation id, the "what is happening" line, and the
 * published timing the pose is built from. No clips. Species differ by these rows, not by a new source file.
 *
 * Sagittal frame: hip at x = 0, +x forward, +y up, metres. Wolf rows are world metres (model × WOLF_SCALE). Hare rows
 * are the hare rig's metres (HARE_BODY / HUNT_HOLD).
 */
import { CANID_CADENCE, canidPlan, swingFollow } from './gaitData';
import { WOLF_GIRDLE_Z, WOLF_LEGS } from './animalBehavior';
import { HEAD_AT, TAIL_AT } from './wolfBody';
import { WOLF_SCALE, modeSpeed } from './wolfModes';
import { HUNT_HOLD } from './huntHold';
import { PHYS } from './tuning';
import { boundCadence, boundDuties, boundStride } from './needs/bound';
import { HARE_GAIT, HARE_NEEDS, WOLF_NEEDS } from './needs/species';

export type SpeciesId = 'hare' | 'wolf';
export type PoseKind = 'plant' | 'gait' | 'leap';
export type FootContact = 'ground' | 'target' | 'air';
/** 'off' / 'on' for the whole cycle, or [from, to) in stride phase. */
export type JawSpec = 'off' | 'on' | readonly [number, number];

export interface Bones {
  hipX: number; hipY: number;
  shoulderX: number; shoulderY: number;
  noseX: number; noseY: number;
  /** Ear length (m), up from the nose in the head frame before the head pitch. */
  ear: number;
  tailX: number; tailY: number;
  /** Published head-body length (m). The gate's 5 % keypoint band is this × 0.05. */
  bodyLength: number;
}
export interface FootSpec {
  /** Stride phase of touchdown, 0..1. */
  touchdown: number;
  duty: number;
  /** Stance travel (m) = duty × stride. 0 when the foot stays planted. */
  sweep: number;
  /** Peak swing height (m). 0 when the foot never leaves. */
  lift: number;
  /** Paw x (m, +forward) at mid-stance. */
  restX: number;
  /** Paw y (m) while the foot is down. */
  contactY: number;
  /** What a down foot is touching. */
  down: FootContact;
}
export interface LeapSpec {
  /** Share of the cycle crouching, in the air, and the crouch dip (m). gaitPose's c, fl, and dip. */
  crouch: number; flight: number; dip: number; seconds: number;
}
export interface BehaviourAnim {
  id: string;
  behaviour: string;
  species: SpeciesId;
  /** The concrete line the reference prompt is built from. */
  happening: string;
  cycleS: number;
  /** m/s of the body. 0 when the feet stay planted. */
  speed: number;
  /** Stride frequency (Hz). 0 when the pose is held. */
  hz: number;
  kind: PoseKind;
  bones: Bones;
  /** Clockwise radians of the nose about the shoulder. Positive lowers the nose. */
  head: number;
  /** Metres the trunk is lowered. 0 in this slice (no new crouch depth). */
  drop: number;
  /** Swing follow-through, footTarget's Gait.follow. 0 except the canid gallop. */
  follow: number;
  /** LF, LH, RF, RH. */
  feet: readonly [FootSpec, FootSpec, FootSpec, FootSpec];
  jaw: JawSpec;
  leap?: LeapSpec;
  source: string;
}

const frac = (v: number) => v - Math.floor(v);

/** Clockwise rotation that lowers a forward nose when `a` is positive. */
export function rotDown(x: number, y: number, a: number) {
  const c = Math.cos(a), s = Math.sin(a);
  return { x: x * c + y * s, y: -x * s + y * c };
}
/**
 * Head pitch that puts the nose at `targetNoseY`. The forward solution (nose stays ahead of the shoulder) is kept.
 * If the neck cannot reach, the nose stops at the lowest or highest point on that circle.
 */
export function headPitch(bones: Bones, targetNoseY: number) {
  const vx = bones.noseX - bones.shoulderX, vy = bones.noseY - bones.shoulderY;
  const reach = Math.hypot(vx, vy) || 1e-9;
  const want = Math.max(-reach, Math.min(reach, targetNoseY - bones.shoulderY));
  const base = Math.atan2(vy, vx);
  const theta = Math.atan2(want, Math.sqrt(Math.max(0, reach * reach - want * want)));
  return Math.atan2(Math.sin(base - theta), Math.cos(base - theta));
}

/** ADW Lepus americanus head-body 361–479 mm, the same midpoint as WATERLINE.hare. */
export const HARE_BODY_M = (0.361 + 0.479) / 2;
/** ADW tail 39–52 mm (total length 413–518 minus that head-body), midpoint. */
export const HARE_TAIL_M = (0.039 + 0.052) / 2;
/** Wikipedia "Wolf" head-and-body 105–160 cm, the same midpoint as WATERLINE.wolf. */
export const WOLF_BODY_M = (1.05 + 1.60) / 2;
/** Wikipedia "Wolf" ear 9–11 cm and tail 29–50 cm, midpoints. wolfBody.ts cites the same page. */
export const WOLF_EAR_M = (0.09 + 0.11) / 2;
export const WOLF_TAIL_M = (0.29 + 0.50) / 2;
/**
 * Hare swing peak / hip height. animals/locomotion/bounding.ts SWING.fold. Fore .25 is the kept grid value; hind .8 is
 * the largest fold that stays under the hip joint (estimate, bounded by that rule). Tests lock these to SWING.fold.
 */
export const HARE_FOLD = { fore: 0.25, hind: 0.8 } as const;
/** gaitPose jump shares and the 5 cm crouch dip. SYSTEM_PROPERTIES.jump.crouch / flight are the same shares. */
export const LEAP_SHAPE = { crouch: 0.18, flight: 0.65, dip: 0.05 } as const;
/** Hip (m) footTarget divides the jump tuck by. DEER_LEGS.hip. Tests lock this to that field. */
export const TUCK_HIP_M = 1.1;
/** Nose-down pitch already returned by huntHold.holdVisual (gather). Tests lock the rows that use it. */
export const GATHER_HEAD = 0.55;

/** HARE_BODY values the rows are built from. Tests compare them to animals/hare.ts so the two cannot drift. */
export const HARE_BONES: Bones = {
  hipX: 0, hipY: 0.13,
  shoulderX: 0.12, shoulderY: HUNT_HOLD.scapulaY,
  noseX: 0.27, noseY: 0.085,
  ear: 0.066,
  tailX: -HARE_TAIL_M, tailY: 0.13,
  bodyLength: HARE_BODY_M,
};
export const WOLF_BONES: Bones = {
  hipX: 0, hipY: WOLF_LEGS.hind?.hip ?? WOLF_LEGS.hip,
  shoulderX: -WOLF_GIRDLE_Z[0], shoulderY: WOLF_LEGS.hip,
  noseX: -HEAD_AT[2] * WOLF_SCALE, noseY: HEAD_AT[1] * WOLF_SCALE,
  ear: WOLF_EAR_M,
  tailX: -TAIL_AT[2] * WOLF_SCALE - WOLF_TAIL_M, tailY: TAIL_AT[1] * WOLF_SCALE,
  bodyLength: WOLF_BODY_M,
};

const plantFoot = (restX: number, contactY: number, down: FootContact): FootSpec =>
  ({ touchdown: 0, duty: 1, sweep: 0, lift: 0, restX, contactY, down });

function harePlant(fore: FootContact, foreY: number, hind: FootContact, hindY: number): [FootSpec, FootSpec, FootSpec, FootSpec] {
  const f = plantFoot(HARE_BONES.shoulderX, foreY, fore);
  const h = plantFoot(HARE_BONES.hipX, hindY, hind);
  return [f, h, f, h];
}
function wolfPlant(fore: FootContact, foreY: number, hind: FootContact, hindY: number): [FootSpec, FootSpec, FootSpec, FootSpec] {
  const f = plantFoot(WOLF_BONES.shoulderX, foreY, fore);
  const h = plantFoot(WOLF_BONES.hipX, hindY, hind);
  return [f, h, f, h];
}

/** Half-bound at `speed`. Leg order on the row is LF, LH, RF, RH. Timing is HARE_GAIT via boundDuties. */
function hareGait(speed: number): { feet: BehaviourAnim['feet']; hz: number; follow: number } {
  const duties = boundDuties(HARE_GAIT, speed); // LF, RF, LH, RH
  const td = HARE_GAIT.touchdown;
  const hz = boundCadence(HARE_GAIT, speed);
  const stride = boundStride(HARE_GAIT, speed);
  const map = [0, 2, 1, 3] as const; // into LF, LH, RF, RH
  const feet = map.map(g => {
    const fore = g < 2;
    return {
      touchdown: td[g], duty: duties[g], sweep: duties[g] * stride,
      lift: (fore ? HARE_FOLD.fore : HARE_FOLD.hind) * HARE_BONES.hipY,
      restX: fore ? HARE_BONES.shoulderX : HARE_BONES.hipX,
      contactY: 0, down: 'ground' as const,
    };
  }) as unknown as BehaviourAnim['feet'];
  return { feet, hz, follow: 0 };
}

/** Canid walk / trot / gallop at `speed` (canidPlan on the wolf's hip). */
function wolfGait(speed: number): { feet: BehaviourAnim['feet']; hz: number; follow: number } {
  const plan = canidPlan(speed, WOLF_LEGS.hip);
  const lift = (plan.gait === 'walk' ? 0.1 : plan.gait === 'trot' ? 0.15 : 0.2) * WOLF_LEGS.hip;
  const sweep = plan.duty * plan.stride;
  const feet = plan.offsets.map((o, i) => ({
    touchdown: frac(1 - o), duty: plan.duty, sweep, lift,
    restX: i % 2 === 0 ? WOLF_BONES.shoulderX : WOLF_BONES.hipX,
    contactY: 0, down: 'ground' as const,
  })) as unknown as BehaviourAnim['feet'];
  return { feet, hz: plan.hz, follow: swingFollow(plan.gait) };
}

const HARE_REACT = HARE_NEEDS.behaviour.alert.reactSeconds.v;
const HARE_EAT = HARE_NEEDS.diet.foods.clover?.eatSeconds.v ?? 3;
const WOLF_REACT = WOLF_NEEDS.behaviour.alert.reactSeconds.v;
const WALK_MPS = CANID_CADENCE[0][0];
const TROT_MPS = CANID_CADENCE[1][0];
const HARE_TROT = HARE_GAIT.cadence.points?.[0]?.[0] ?? HARE_GAIT.cadence.transitionSpeed;
const HARE_FLEE = HARE_NEEDS.body.speeds.sprint.v;

function row(part: Omit<BehaviourAnim, 'drop'> & { drop?: number }): BehaviourAnim {
  return { drop: 0, ...part };
}

const hareGaitRow = (id: string, behaviour: string, happening: string, speed: number, head: number, source: string): BehaviourAnim => {
  const g = hareGait(speed);
  return row({
    id, behaviour, species: 'hare', happening, cycleS: 1 / g.hz, speed, hz: g.hz, kind: 'gait',
    bones: HARE_BONES, head, follow: g.follow, feet: g.feet, jaw: 'off', source,
  });
};
const wolfGaitRow = (id: string, behaviour: string, happening: string, speed: number, head: number, jaw: JawSpec, source: string): BehaviourAnim => {
  const g = wolfGait(speed);
  return row({
    id, behaviour, species: 'wolf', happening, cycleS: 1 / g.hz, speed, hz: g.hz, kind: 'gait',
    bones: WOLF_BONES, head, follow: g.follow, feet: g.feet, jaw, source,
  });
};

const HARE_HEAD_UP = headPitch(HARE_BONES, 0.22);
const HARE_ALERT = headPitch(HARE_BONES, 0.20);
const HARE_SCAN = headPitch(HARE_BONES, HARE_BONES.shoulderY);
const HARE_DRINK = headPitch(HARE_BONES, 0);
const WOLF_LOW = headPitch(WOLF_BONES, WOLF_BONES.shoulderY);
const WOLF_DRINK = headPitch(WOLF_BONES, 0);

/**
 * The behaviours named in T-0020, for the hare and the wolf. Deer postures and visitor actions are not in this slice.
 * `id` is the animation id (one each).
 */
export const BEHAVIOURS: readonly BehaviourAnim[] = [
  row({
    id: 'hare-graze', behaviour: 'graze', species: 'hare', kind: 'plant', bones: HARE_BONES, head: 0, follow: 0, jaw: 'off',
    happening: 'a snowshoe hare grazing clover with its nose at the bind-pose head height, all four feet planted, side view',
    cycleS: HARE_EAT, speed: 0, hz: 0, feet: harePlant('ground', 0, 'ground', 0),
    source: 'HARE_BODY.headY 0.085 m is the rig head. Clover eatSeconds is HARE_NEEDS (Belovsky bout on the hare agent).',
  }),
  row({
    id: 'hare-head-up', behaviour: 'head-up', species: 'hare', kind: 'plant', bones: HARE_BONES, head: HARE_HEAD_UP, follow: 0, jaw: 'off',
    happening: 'a snowshoe hare with its nose lifted to 22 cm, ears up, feet planted, side view',
    cycleS: HARE_REACT, speed: 0, hz: 0, feet: harePlant('ground', 0, 'ground', 0),
    source: 'Prescott & Richard 2004 shoulder 20–22 cm, the upper end, via the hare.ts girdle note. reactSeconds is HARE_NEEDS.',
  }),
  row({
    id: 'hare-alert', behaviour: 'alert', species: 'hare', kind: 'plant', bones: HARE_BONES, head: HARE_ALERT, follow: 0, jaw: 'off',
    happening: 'a snowshoe hare frozen with its nose at 20 cm, feet planted, side view',
    cycleS: HARE_REACT, speed: 0, hz: 0, feet: harePlant('ground', 0, 'ground', 0),
    source: 'Same shoulder band, the lower end (20 cm). Freeze is HARE_NEEDS.behaviour.alert.freeze.',
  }),
  row({
    id: 'hare-scan', behaviour: 'scan', species: 'hare', kind: 'plant', bones: HARE_BONES, head: HARE_SCAN, follow: 0, jaw: 'off',
    happening: 'a snowshoe hare with its nose level with the shoulder joint, feet planted, side view',
    cycleS: HARE_REACT, speed: 0, hz: 0, feet: harePlant('ground', 0, 'ground', 0),
    source: 'Nose target is HUNT_HOLD.scapulaY, the standing scapula already on the pin layout.',
  }),
  hareGaitRow('hare-trot', 'trot', 'a snowshoe hare in a slow half-bound at its preferred gallop speed, side view', HARE_TROT, 0,
    'HARE_GAIT preferred gallop 2.91 m/s at 4.17 Hz (Heglund & Taylor 1988 at 1.5 kg). Half-bound touchdown is HARE_GAIT.'),
  hareGaitRow('hare-flee', 'flee', 'a snowshoe hare fleeing in a half-bound at its game sprint, side view', HARE_FLEE, 0,
    'Sprint 8.5 m/s is HARE_NEEDS (below the 11.6 m/s Seton top). Cadence is held at the 4.40 Hz max sustained gallop.'),
  row({
    id: 'hare-rest', behaviour: 'rest', species: 'hare', kind: 'plant', bones: HARE_BONES, head: 0, follow: 0, jaw: 'off',
    happening: 'a snowshoe hare standing still on all four feet, side view',
    cycleS: HARE_REACT, speed: 0, hz: 0, feet: harePlant('ground', 0, 'ground', 0),
    source: 'The bind pose. The sample window is the hare react time, not a sleep bout.',
  }),
  row({
    id: 'hare-drink', behaviour: 'drink', species: 'hare', kind: 'plant', bones: HARE_BONES, head: HARE_DRINK, follow: 0, jaw: 'off',
    happening: 'a snowshoe hare with its nose as low as the neck reaches, feet planted, side view',
    cycleS: HARE_REACT, speed: 0, hz: 0, feet: harePlant('ground', 0, 'ground', 0),
    source: 'Pitch is the neck circle (HARE_BONES) aimed at the water y = 0. No separate drink angle was added.',
  }),
  row({
    id: 'hare-sleep', behaviour: 'sleep', species: 'hare', kind: 'plant', bones: HARE_BONES, head: HARE_DRINK, follow: 0, jaw: 'off',
    happening: 'a snowshoe hare with its head down on the neck limit, feet planted, side view',
    cycleS: HARE_REACT, speed: 0, hz: 0, feet: harePlant('ground', 0, 'ground', 0),
    source: 'Same neck limit as drink. A full loaf needs a sourced sternum height; this slice does not add one.',
  }),

  wolfGaitRow('wolf-stalk', 'stalk', 'a gray wolf stalking at the measured canid walk, nose level with the shoulder, side view', WALK_MPS, WOLF_LOW, 'off',
    'Bryce & Williams 2017 walk 1.27 m/s, 1.50 Hz. Duty 0.65 is gaitData. Nose target is the shoulder-joint height.'),
  wolfGaitRow('wolf-crawl', 'crawl', 'a gray wolf crawling at stealth speed, nose level with the shoulder, side view', modeSpeed.stealth, WOLF_LOW, 'off',
    'Speed is modeSpeed.stealth (0.8 m/s), the existing stealth gait. Same walk duty law as the stalk.'),
  wolfGaitRow('wolf-trot', 'trot', 'a gray wolf trotting at the measured canid trot, side view', TROT_MPS, 0, 'off',
    'Bryce & Williams 2017 trot 2.70 m/s, 2.10 Hz. Duty 0.45 (Maes et al. 2008, under 0.5 above 2 m/s).'),
  wolfGaitRow('wolf-flee', 'flee', 'a gray wolf galloping at the game sprint, side view', modeSpeed.sprint, 0, 'off',
    'modeSpeed.sprint is 7 m/s, below the 15.5–17.8 m/s Mech & Boitani top. Cadence is canidPlan. Gallop follow is swingFollow.'),
  row({
    id: 'wolf-leap', behaviour: 'leap', species: 'wolf', kind: 'leap', bones: WOLF_BONES, head: 0, follow: 0, jaw: 'off',
    happening: 'a gray wolf leaping, crouch then a ballistic flight then a landing, side view',
    cycleS: PHYS.jumpSeconds, speed: 0, hz: 0, feet: wolfPlant('ground', 0, 'ground', 0),
    leap: { ...LEAP_SHAPE, seconds: PHYS.jumpSeconds },
    source: 'gaitPose jump: crouch 0.18, flight 0.65, dip 0.05 m, duration PHYS.jumpSeconds 0.85 s. Apex is g·T_air²/8.',
  }),
  row({
    id: 'wolf-pin', behaviour: 'pin', species: 'wolf', kind: 'plant', bones: WOLF_BONES, head: GATHER_HEAD, follow: 0, jaw: 'off',
    happening: 'a gray wolf pinning a hare, forepaws on the hare scapula, hind feet on the ground, nose down, side view',
    cycleS: WOLF_REACT, speed: 0, hz: 0,
    feet: wolfPlant('target', HUNT_HOLD.scapulaY, 'ground', 0),
    source: 'Fore contact y is HUNT_HOLD.scapulaY. Head pitch is holdVisual.head. The pose is the pin contact, sampled across the wolf react time.',
  }),
  row({
    id: 'wolf-bite', behaviour: 'bite', species: 'wolf', kind: 'plant', bones: WOLF_BONES, head: GATHER_HEAD, follow: 0, jaw: 'on',
    happening: 'a gray wolf biting the hare at the nape, forepaws still on the scapula, jaws closed on the neck, side view',
    cycleS: WOLF_REACT, speed: 0, hz: 0,
    feet: wolfPlant('target', HUNT_HOLD.scapulaY, 'ground', 0),
    source: 'Same pin layout. Jaw contact stays on for the cycle (the bite row in huntHold).',
  }),
  wolfGaitRow('wolf-carry', 'carry', 'a gray wolf walking the measured canid walk with the head down and the jaws on a carried hare, side view', WALK_MPS, GATHER_HEAD, 'on',
    'Walk is the Bryce point. Head pitch is holdVisual.head. Jaw contact is the carry (nape on the canine).'),
  row({
    id: 'wolf-consume', behaviour: 'consume', species: 'wolf', kind: 'plant', bones: WOLF_BONES, head: GATHER_HEAD, follow: 0, jaw: 'on',
    happening: 'a gray wolf feeding with its nose down and its jaws on the meal, feet planted, side view',
    cycleS: WOLF_REACT, speed: 0, hz: 0, feet: wolfPlant('ground', 0, 'ground', 0),
    source: 'Head pitch is holdVisual.head. Jaw contact stays on for the sample. No chew rate was added.',
  }),
  row({
    id: 'wolf-release', behaviour: 'release', species: 'wolf', kind: 'plant', bones: WOLF_BONES, head: 0, follow: 0, jaw: 'off',
    happening: 'a gray wolf standing with the head up and the jaws off the hare, feet planted, side view',
    cycleS: WOLF_REACT, speed: 0, hz: 0, feet: wolfPlant('ground', 0, 'ground', 0),
    source: 'The standing bind pose after releaseHold. Sample window is the wolf react time.',
  }),
  row({
    id: 'wolf-rest', behaviour: 'rest', species: 'wolf', kind: 'plant', bones: WOLF_BONES, head: 0, follow: 0, jaw: 'off',
    happening: 'a gray wolf standing still on all four feet, side view',
    cycleS: WOLF_REACT, speed: 0, hz: 0, feet: wolfPlant('ground', 0, 'ground', 0),
    source: 'Bind pose. Sample window is the wolf react time, not the 1.02 h inactivity bout.',
  }),
  row({
    id: 'wolf-drink', behaviour: 'drink', species: 'wolf', kind: 'plant', bones: WOLF_BONES, head: WOLF_DRINK, follow: 0, jaw: 'off',
    happening: 'a gray wolf with its nose as low as the neck reaches, feet planted, side view',
    cycleS: WOLF_REACT, speed: 0, hz: 0, feet: wolfPlant('ground', 0, 'ground', 0),
    source: 'Pitch is the neck circle (WOLF_BONES, HEAD_AT × WOLF_SCALE) aimed at y = 0.',
  }),
  row({
    id: 'wolf-sleep', behaviour: 'sleep', species: 'wolf', kind: 'plant', bones: WOLF_BONES, head: WOLF_DRINK, follow: 0, jaw: 'off',
    happening: 'a gray wolf with its head on the neck limit, feet planted, side view',
    cycleS: WOLF_REACT, speed: 0, hz: 0, feet: wolfPlant('ground', 0, 'ground', 0),
    source: 'Same neck limit as drink. A sternal lie needs a sourced brisket height; this slice does not add one.',
  }),
];

export const FIRST_GATE = ['hare-graze', 'hare-head-up', 'hare-flee', 'wolf-stalk', 'wolf-leap', 'wolf-pin', 'wolf-bite', 'wolf-carry'] as const;

const BY_ID = new Map(BEHAVIOURS.map(b => [b.id, b]));
export function behaviourById(id: string): BehaviourAnim {
  const b = BY_ID.get(id);
  if (!b) throw new Error(`unknown behaviour animation ${id}`);
  return b;
}
/** Nose more than 1 cm below the shoulder joint. */
export const headDownOf = (noseY: number, shoulderY: number) => noseY < shoulderY - 0.01;
export const jawOnAt = (jaw: JawSpec, phase: number) => {
  if (jaw === 'off') return false;
  if (jaw === 'on') return true;
  const p = frac(phase);
  return p >= jaw[0] && p < jaw[1];
};
