import { SYSTEM_PROPERTIES } from '../config/systemProperties';
import { live } from '../config/live';
/**
 * Paw footstep timing and variation (Grok Bot, wolf walk). Pure (no DOM/audio) so it is testable and shared by both player
 * paths: the default game wolf (touchdowns found from its gait phase, core/animalBehavior touchdownsBetween) and the ?loco=1
 * controller (its own touchdown events). The old default path played one identical-length slice every half stride, sped up
 * by the ground-cost bug, with a hard 40 ms cut: a steady machine-like tick.
 */
/** minGap: paws landing closer than this (s) merge into one sound (trot pairs, gallop hind pair). Rates: fore paws a little
 *  lower than hind (heavier forequarters carry ~60 % of a dog's weight; Lee et al. 1999 JEB 202:3565). Jitter is per step. */
export const PAW = live(SYSTEM_PROPERTIES.footsteps);
export { touchdownStrength } from '../core/animalBehavior';
/** Playback rate and level (0..~1.2) for one paw sound: `legs` are the leg indices (LF 0, LH 1, RF 2, RH 3) landing together. */
export function pawSound(legs: readonly number[], strength: number, rng: () => number) {
  const fore = legs.length > 0 && legs.every(i => i % 2 === 0), hind = legs.length > 0 && legs.every(i => i % 2 === 1);
  const rate = (fore ? PAW.foreRate : hind ? PAW.hindRate : 1) * (1 + (rng() * 2 - 1) * PAW.pitchJitter);
  const level = (.35 + .65 * Math.min(1, Math.max(0, strength))) * (1 - PAW.gainJitter * rng()) * (1 + PAW.pairBoost * Math.max(0, legs.length - 1));
  return { rate, level };
}
/** Cooldown gate: true if a paw sound may play at `time` (s), and remembers it. */
export function pawGate(state: { last: number }, time: number) {
  if (time - state.last < PAW.minGap) return false;
  state.last = time; return true;
}
