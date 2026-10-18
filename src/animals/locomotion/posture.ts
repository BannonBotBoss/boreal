/**
 * Locomotion layer (Grok Bot / Gait Builder): walk posture, tuned to a side-view reference photo of a grey wolf walking
 * (Matthew, 2026-10-18): level back, head carried low and forward (about shoulder height), tail hanging low, hind feet
 * reaching well under the belly, the swinging fore paw flicked back at the wrist, near single-track footfalls.
 * All values are shares of hip height or radians, so any quadruped can reuse them.
 */
import { smooth01 } from '../../proc/math';

export const POSTURE = {
  /** rad added to the head at a walk (three.js rotation.x: negative = nose down) */ headPitch: -.12,
  /** share of the rig's head drop (skull to shoulder line) at a walk; the neck blends with the head, so it angles down too */ headDrop: .3,
  /** rad the tail hangs below the rig's own hang at a walk */ tailDrop: .45,
  /** extra fore-wrist (carpus) fold through the swing, rad; the canid flick-back */ swingWristFlex: .9,
  /** fore swing clearance × this at a walk (the lifted, flicked fore paw) */ foreLift: 1.6,
  /** hind rest point moved forward under the belly, share of hip height */ hindReach: .14,
  /** rad the body pitches front-up at a walk (withers slightly above the croup) */ bodyPitch: .04,
  /** body lowered at a walk, share of hip height (flexes stifle/hock and elbow/carpus) */ bodyDrop: .05,
  /** stance fore pastern slant, rad (paw ahead of the carpus: a visible wrist bend) */ foreFootAngle: .22,
  /** extra stance hock angle, rad */ hindFootAngle: .12,
  /** foot track width as a share of the hip track (1 = straight down; ~.35 is near single-track) */ track: .35,
};

/** How much of the walking carry applies: none standing still, full at a walk, fading out by a fast trot (head extends). */
export function carryWeight(speed: number) {
  const v = Math.abs(speed); return smooth01(v / .5) * (1 - smooth01((v - 2) / 3));
}
