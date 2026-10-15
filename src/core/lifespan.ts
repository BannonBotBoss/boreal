/**
 * Player animal age (Grok Bot). Age is a 'clock' field (core/stateFields): it follows the world clock while playing and
 * holds while the start/pause menu freezes that clock.
 * Game time runs 12× real (timeOfDay: 300 real s per game hour), so one game year ≈ 30.4 real days.
 * Wild maximum lifespans [verify]: grey wolf ~13 y (Mech & Boitani 2003, Wolves: Behavior, Ecology and Conservation);
 * white-tailed deer ~20 y (Ditchkoff 2011, in Biology and Management of White-tailed Deer); grizzly bear ~30 y
 * (McLellan 2015, J. Wildl. Manage. 79:749); snowshoe hare ~5 y (Krebs et al. 2001). Players start as young adults.
 */
import { REAL_SECONDS_PER_GAME_HOUR } from './timeOfDay';
export const LIFESPAN: Record<string, { maxYears: number; startYears: number }> = {
  wolf: { maxYears: 13, startYears: 2 }, deer: { maxYears: 20, startYears: 2 }, bear: { maxYears: 30, startYears: 5 }, hare: { maxYears: 5, startYears: 1 },
};
export const WARN_FRACTION = .9; // pause screen warns from 90 % of the species' maximum
const REAL_SEC_PER_GAME_YEAR = 365.25 * 24 * REAL_SECONDS_PER_GAME_HOUR;
export const ageYears = (species: string, bornSec: number, worldSec: number) => (LIFESPAN[species]?.startYears ?? 1) + Math.max(0, worldSec - bornSec) / REAL_SEC_PER_GAME_YEAR;
/** Warning text when the animal is near its species' maximum lifespan, else ''. */
export function lifespanWarning(species: string, age: number, label = species) {
  const L = LIFESPAN[species]; if (!L || age < WARN_FRACTION * L.maxYears) return '';
  return `Your ${label} is ${age.toFixed(1)} years old, near the wild maximum of about ${L.maxYears} years for its species.`;
}
