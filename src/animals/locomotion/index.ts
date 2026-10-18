/** Procedural quadruped locomotion (Grok Bot / Gait Builder). See tools/locomotion-lab.html and AGENT-NOTES.md. */
export * from './signals';
export { GAIT_TABLE, planGait, froude, type GaitPlan, type GaitRow } from './gaits';
export { CPG, createCpg, stepCpg, phases, phaseDiff, type Cpg } from './cpg';
export { stepFoot, footState, forceStep, toWorld, SETTLE_SECONDS, type FootState } from './foot';
export { supportPlane, type Tilt } from './balance';
export { solveLimb, soleOf, clampLimb, FLEX_LIMIT, type LimbAngles } from './ik';
export { spring, springTo, type Spring } from './spring';
export { createLocomotion, referenceLayout, worldToLimb, limbToWorld, SPRINGS, REACH_TOLERANCE, LOCO_LOD, lodAt, type Locomotion } from './controller';
export { JUMP, jumpFrame, flightFoot, apexHeight, airSeconds, jumpSeconds, type Jump, type JumpKind, type JumpStage, type JumpFrame } from './jump';
export { POSTURE, carryWeight } from './posture';
