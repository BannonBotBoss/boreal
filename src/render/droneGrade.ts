/**
 * Drone-height exposure (issue #156).
 *
 * The game's ACES exposure is 0.5 (`EXPOSURE.base` in core/light), tuned for the forest floor.
 * From a drone the same exposure left the glide dark next to an aerial photograph.
 * Wasson Lake, Devil's Staircase (public domain, Bureau of Land Management), mean sRGB
 * about 75, 78, 74 over the frame (`tasks/evidence/drone-ref/`). One half stop at drone
 * height lifts the picture toward that mid grey. On the ground the scale is 1, so the
 * wolf's exposure does not move. Above the band it eases back off.
 */
import { smoothstep } from '../proc/math';

/** Extra exposure at drone height, as a multiplier on `toneMappingExposure`. 1.5 is half a stop. */
export const DRONE_STOP = 1.5;

/** 1 on the ground and above the descent band, `DRONE_STOP` between about 20 m and 1 km. */
export function droneExposureScale(eyeM: number) {
  const up = smoothstep(8, 24, eyeM);
  const down = 1 - smoothstep(1200, 2500, eyeM);
  return 1 + (DRONE_STOP - 1) * up * down;
}

/** Written each frame by the in-page drone. The post pass reads it. 1 until that pass runs. */
export const DRONE_GRADE = { exposure: 1 };
