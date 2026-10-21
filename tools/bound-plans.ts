/** Body plans for the T-0009 bound lab and score (grok-gait). 'host' = the host's HARE_BODY as given; 'bones' = the same
 * body with limb bones from skeletal measurements. Sources and estimates: tasks/handoffs/T-0009-grok-gait.md "Limb lengths". */
import { HARE_BODY as B } from '../src/animals/hare';
import { skeletonOf, type BodyPlan } from '../src/animals/locomotion/bodyPlan';
/** track half-widths [estimate: drawn to the reference] */
const TRACK = { fore: .03, hind: .045 };
export const HOST_PLAN: BodyPlan = { hip: B.hipY, hipZ: B.hipZ, shoulderZ: B.shoulderZ, track: TRACK, foreLeg: B.foreLeg, hindLeg: B.hindLeg, hindFoot: B.hindFoot };
/** femur 94 mm (Lepus americanus specimen, Illinois State Museum); tibia 106 mm = femur × 147.3/130.7 (Lepus europaeus
 * means, Volf 2023 Lynx 54, doi:10.37520/lynx.2023.014) [scaled]; fore leg 185 mm = humerus ~70 + radius ~80 + manus ~35
 * [estimate: scaled from the femur by Lepus proportions]; hind foot 132 mm and standing hip 0.13 m as HARE_BODY. */
export const BONE_PLAN: BodyPlan = { ...HOST_PLAN, foreLeg: .185, hindLeg: .094 + .106, upperShare: .47, foreBend: .6, hindBend: .5 };
export const planFor = (name: string) => skeletonOf(name === 'bones' ? BONE_PLAN : HOST_PLAN);
import { HARE_AGENT } from '../src/core/agent/species';
import type { BoundGait } from '../src/core/agent/bound';
/** The host's gait data (HARE_AGENT.gait, grok). */
export const HOST_GAIT: BoundGait = (() => { if (!HARE_AGENT.gait) throw new Error('HARE_AGENT has no gait'); return HARE_AGENT.gait; })();
