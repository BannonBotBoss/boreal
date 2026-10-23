/** Player wolf tunables (Grok Bot). Base speeds stay in wolfModes.ts; these scale them for gameplay feel. */
import { SYSTEM_PROPERTIES } from '../config/systemProperties';
import { live } from '../config/live';
import { modeSpeed, type WolfMode } from './wolfModes';
import { WOLF_NEEDS } from './needs/species';
import type { SpeciesTemplate } from './needs/template';
export const PLAYER = {
  /** run 4 -> 6 m/s, sprint 7 -> 10.5 m/s; walk and stealth unchanged. */
  speedScale: live(SYSTEM_PROPERTIES.movement.speedScale) as Record<WolfMode, number>,
  /** Pounce (jump) horizontal speed. The jump lasts 0.85 s (animalBehavior), so 8 m/s ~ 6.8 m; running carries more. */
  pounceSpeed: SYSTEM_PROPERTIES.movement.pounceSpeed as number, pounceCarry: SYSTEM_PROPERTIES.movement.pounceCarry as number,
};
/** Base (unscaled) mode speed of a species: its sourced walk / run / sprint (template body.speeds); the stealth modes keep the
 *  wolf's stealth-to-walk ratio. For the wolf these ARE core/wolfModes modeSpeed (2 / 4 / 7), so the wolf is unchanged. */
const baseSpeed = (mode: WolfMode, sp: SpeciesTemplate) => {
  const v = sp.body.speeds, k = v.walk.v / WOLF_NEEDS.body.speeds.walk.v;
  return mode === 'walk' ? v.walk.v : mode === 'run' ? v.run.v : mode === 'sprint' ? v.sprint.v : modeSpeed[mode] * k;
};
/** Player speed (m/s) in a mode for the embodied species (default wolf): the sourced base speed x the feel scale above, never past
 *  the species' own burst speed (template behaviour.evasion.burstSpeed: wolf 15.5, hare 12.5 m/s), so a x1.5 run cannot make a
 *  hare faster than a real one. */
export const playerSpeed = (mode: WolfMode, sp: SpeciesTemplate = WOLF_NEEDS) =>
  Math.min(baseSpeed(mode, sp) * PLAYER.speedScale[mode], sp.behaviour.evasion.burstSpeed.v);
/** Old rule was max(1.2, |speed|): ~1.7 m from a walk, ~3.4 m from a run. The standing minimum is the wolf's (game calibration) scaled
 *  by the species' burst speed relative to the wolf's, so a hare's leap is shorter than a wolf's pounce. */
export const pounceSpeed = (speed: number, sp: SpeciesTemplate = WOLF_NEEDS) =>
  Math.max(PLAYER.pounceSpeed * sp.behaviour.evasion.burstSpeed.v / WOLF_NEEDS.behaviour.evasion.burstSpeed.v, Math.abs(speed) * PLAYER.pounceCarry);
