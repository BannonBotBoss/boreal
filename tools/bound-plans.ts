/** Body plans for the T-0009 bound lab and score. 'host' = the host's HARE_BODY (src/animals/hare.ts: limb bones from skeletal
 * measurements since run 3; 'bones' is kept as an alias) with LEPORID_LIMITS. 'game' (alias 'canid-limits') = HOST_PLAN as
 * hare.ts HARE_PLAN builds it today (no limits: dog ranges). 'blob' = the run-2 HARE_BODY limbs (fore .12, hind .125, the
 * defaults for the bends), kept as the known-short comparison. Sources: HARE_BODY's comment and tasks/handoffs/T-0009-grok.md.
 * Run 3 (grok-gait) adds the proposed bodies (contract note in the T-0009 grok-gait handoff), with SPLIT and BLADE below:
 *   'split'  = host + split hind foot (metatarsus + toes) + LEPORID_LIMITS (with the sourced rabbit knee);
 *   'blade'  = game + the shoulder blade in the fore chain (dog ranges);
 *   'v3'     = split + blade (LEPORID_LIMITS).
 *   'hare'   = hare.ts HARE_PLAN as the game builds it since run 5 (= v3), run with its posture (HARE_RIG.pose, level);
 *   'game' / 'canid-limits' stay the run 4 game body (no blade, no split, dog ranges) as the comparison.
 * A ':level' suffix (e.g. 'v3:level') runs the body with the level-trunk posture RUN_POSE_LEVEL instead of RUN_POSE. */
import { HARE_BODY as B, HARE_PLAN, HARE_RIG } from '../src/animals/hare';
import { skeletonOf, type BodyPlan } from '../src/animals/locomotion/bodyPlan';
import { LEPORID_LIMITS } from '../src/animals/locomotion/ik';
import { RUN_POSE, RUN_POSE_LEVEL, type RunPose } from '../src/animals/locomotion/bounding';
/** track half-widths [estimate: drawn to the reference] */
const TRACK = { fore: .03, hind: .045 };
export const HOST_PLAN: BodyPlan = { hip: B.hipY, hipZ: B.hipZ, shoulderZ: B.shoulderZ, track: TRACK, foreLeg: B.foreLeg, hindLeg: B.hindLeg, hindFoot: B.hindFoot,
  upperShare: B.upperShare, manus: B.manus, foreBend: B.foreBend, hindBend: B.hindBend, limits: LEPORID_LIMITS };
export const BONE_PLAN: BodyPlan = HOST_PLAN;
/** HOST_PLAN as the game builds it today (hare.ts HARE_PLAN names no joint limits yet: dog ranges) — the before/after comparison. */
export const NOLIMIT_PLAN: BodyPlan = { ...HOST_PLAN, limits: undefined };
export const BLOB_PLAN: BodyPlan = { hip: B.hipY, hipZ: B.hipZ, shoulderZ: B.shoulderZ, track: TRACK, foreLeg: .12, hindLeg: .125, hindFoot: B.hindFoot };
/**
 * Split hind foot, from Lepus brachyurus (Japanese hare) bone means, males/females (Linear measurements of the bones of Lepus
 * brachyurus, Pentalagus furnessi and Oryctolagus cuniculus, Exp Anim 30(2):113, 1981, doi:10.1538/expanim1978.30.2_113,
 * Tables 4-6, read 2026-10-21): talus 14.9/14.6, Os metatarsale III 46.9/47.6, digit III phalanges proximal 22.4/22.6,
 * media 12.2/12.3, distalis 10.9 mm. Ankle-to-tip span = talus + MT III + phalanges = 107.7 mm, toes (MTP to tip) 45.7 mm =
 * .424 of it [the talus as the ankle-to-metatarsal span is an estimate]. Applied to HARE_BODY.hindFoot .132: toes .056,
 * metatarsus (hock to MTP) .076 m.
 */
export const SPLIT = { hindToes: B.hindToes };
/**
 * Shoulder blade: Lepus brachyurus lateral length of the scapula 68.9/70.2 mm vs humerus greatest length 84.1/86.3 mm (same
 * paper, Table 1): scapula = .816 x humerus. Snowshoe humerus .077 (HARE_BODY's comment) -> scapula .063 m. Blade pivot at
 * hip height and rest angle .47 rad: bodyPlan.ts SCAPULA_REST (Fischer et al. 2002).
 */
export const BLADE = { scapula: B.scapula };
export const SPLIT_PLAN: BodyPlan = { ...HOST_PLAN, ...SPLIT };
export const BLADE_PLAN: BodyPlan = { ...NOLIMIT_PLAN, ...BLADE };
export const V3_PLAN: BodyPlan = { ...HOST_PLAN, ...SPLIT, ...BLADE };
const PLANS: Record<string, BodyPlan> = { host: HOST_PLAN, bones: HOST_PLAN, game: NOLIMIT_PLAN, 'canid-limits': NOLIMIT_PLAN, blob: BLOB_PLAN, split: SPLIT_PLAN, blade: BLADE_PLAN, v3: V3_PLAN, hare: HARE_PLAN };
export const planOf = (name: string): BodyPlan => PLANS[name.split(':')[0]] ?? HOST_PLAN;
export const planFor = (name: string) => skeletonOf(planOf(name));
export const poseFor = (name: string): RunPose => name.endsWith(':level') ? RUN_POSE_LEVEL : name.split(':')[0] === 'hare' ? HARE_RIG.pose : RUN_POSE;
import { HARE_AGENT } from '../src/core/agent/species';
import type { BoundGait } from '../src/core/agent/bound';
/** The host's gait data (HARE_AGENT.gait, grok). */
export const HOST_GAIT: BoundGait = (() => { if (!HARE_AGENT.gait) throw new Error('HARE_AGENT has no gait'); return HARE_AGENT.gait; })();
