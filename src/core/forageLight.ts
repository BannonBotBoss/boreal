import { clamp01 } from '../proc/math';

/** Hall et al. 1979 (Drummond TB203 / FEIS): lowbush blueberry does not flower below half of full sunlight.
 *  Lives here so world placement can use it without importing the field (that import cycles through weather). */
export const BERRY_FLOWER_LIGHT = 0.5;
/** 0 at half sun, 1 at full sun. Below the flower threshold a draw is never kept. */
export function berrySuit(light: number) {
  return clamp01((light - BERRY_FLOWER_LIGHT) / (1 - BERRY_FLOWER_LIGHT));
}
