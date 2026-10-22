/** Player wolf tunables (Grok Bot). Base speeds stay in wolfModes.ts; these scale them for gameplay feel. */
import { SYSTEM_PROPERTIES } from '../config/systemProperties';
import { live } from '../config/live';
import { modeSpeed, type WolfMode } from './wolfModes';
export const PLAYER = {
  /** run 4 -> 6 m/s, sprint 7 -> 10.5 m/s; walk and stealth unchanged. */
  speedScale: live(SYSTEM_PROPERTIES.movement.speedScale) as Record<WolfMode, number>,
  /** Pounce (jump) horizontal speed. The jump lasts 0.85 s (animalBehavior), so 8 m/s ~ 6.8 m; running carries more. */
  pounceSpeed: SYSTEM_PROPERTIES.movement.pounceSpeed as number, pounceCarry: SYSTEM_PROPERTIES.movement.pounceCarry as number,
};
export const playerSpeed = (mode: WolfMode) => modeSpeed[mode] * PLAYER.speedScale[mode];
/** Old rule was max(1.2, |speed|): ~1.7 m from a walk, ~3.4 m from a run. */
export const pounceSpeed = (speed: number) => Math.max(PLAYER.pounceSpeed, Math.abs(speed) * PLAYER.pounceCarry);
