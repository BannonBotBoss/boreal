/** Body plans for the T-0009 bound lab and score. 'host' = the host's HARE_BODY (src/animals/hare.ts: limb bones from skeletal
 * measurements since run 3; 'bones' is kept as an alias). 'blob' = the run-2 HARE_BODY limbs (fore .12, hind .125, the
 * defaults for the bends), kept as the known-short comparison. Sources: HARE_BODY's comment and tasks/handoffs/T-0009-grok.md. */
import { HARE_BODY as B } from '../src/animals/hare';
import { skeletonOf, type BodyPlan } from '../src/animals/locomotion/bodyPlan';
/** track half-widths [estimate: drawn to the reference] */
const TRACK = { fore: .03, hind: .045 };
export const HOST_PLAN: BodyPlan = { hip: B.hipY, hipZ: B.hipZ, shoulderZ: B.shoulderZ, track: TRACK, foreLeg: B.foreLeg, hindLeg: B.hindLeg, hindFoot: B.hindFoot,
  upperShare: B.upperShare, manus: B.manus, foreBend: B.foreBend, hindBend: B.hindBend };
export const BONE_PLAN: BodyPlan = HOST_PLAN;
export const BLOB_PLAN: BodyPlan = { hip: B.hipY, hipZ: B.hipZ, shoulderZ: B.shoulderZ, track: TRACK, foreLeg: .12, hindLeg: .125, hindFoot: B.hindFoot };
export const planFor = (name: string) => skeletonOf(name === 'blob' ? BLOB_PLAN : HOST_PLAN);
import { HARE_AGENT } from '../src/core/agent/species';
import type { BoundGait } from '../src/core/agent/bound';
/** The host's gait data (HARE_AGENT.gait, grok). */
export const HOST_GAIT: BoundGait = (() => { if (!HARE_AGENT.gait) throw new Error('HARE_AGENT has no gait'); return HARE_AGENT.gait; })();
