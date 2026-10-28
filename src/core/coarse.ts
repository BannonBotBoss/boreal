/**
 * Coarse population step (roadmap step 14, T-0104). Issues #101, #107, #109.
 * #109 wins: the simulation changes with distance and with time. An animal transforms.
 * It does not pop out. #101's "always every individual" and #107's "always full detail" lose.
 *
 * Near and on the Immediate scale, the animal is an individual. Farther, or at a faster
 * scale, the same animal is a herd, a density, or a species range. The two shares always
 * sum to 1, so individuals plus the density are one population.
 *
 * Reuses the interest radii (`INTEREST`) and the one scale signal (`observation` /
 * `resolveObservation` / `OBSERVATION_SCALES`). No second list of scales. The headless
 * animals are the T-0040 / T-0036 sim (`createAnimal`, `removeAnimal`). The picture of a
 * density is the T-0070 disc (render/animalDensity.ts). On the ground that disc is not
 * drawn: a standing sprite reads as a dome. It is a faint ground stain only from high
 * above, looking down. The new piece is `coarseStep`.
 */
import { INTEREST } from './interest';
import { smoothstep } from '../proc/math';
import { K } from './constants';
import { WOLF_CEILING_PER_1000_KM2 } from './habitat';
import { createAnimal, removeAnimal, type SimAnimal, type SimWorld } from './sim';
import type { Observation, ObservationScale } from './worldClock';

/**
 * Winter white-tailed deer, Kenora District WMU 6, 1978 pellet-group survey: 1/km².
 * Ranta & Lankester 2017, Alces 53:159–179 (mixed-wood boreal of northwestern Ontario),
 * citing Ranta & Shaw 1982. WMU 6 is the northern unit of that district.
 */
export const DEER_PER_KM2 = 1;
/** Mainland midwinter wolf ceiling, already cited on the habitat cell. 40 / 1,000 km². */
export const wolfPerKm2 = () => WOLF_CEILING_PER_1000_KM2 / 1000;
export const perKm2 = (species: 'deer' | 'wolf') => species === 'deer' ? DEER_PER_KM2 : wolfPerKm2();

/**
 * Verhulst year⁻¹. [game calibration] The carrying density is the published figure.
 * This rate only sets how fast a folded count eases toward that density. It is not a measured rₘₐₓ.
 */
export const COARSE_R_PER_YEAR = 0.3;
/**
 * While the body is still drawn and the density share has left 0, the disc is at least this
 * strong so the replacement is on screen before the body is gone. [game calibration]
 */
export const INK_FLOOR = 0.65;

export type PictureKind = 'individual' | 'herd' | 'density' | 'range';

export interface Shares { body: number; density: number }

/** Ledger shares. They sum to 1. Distance uses the existing near and mid radii. Time uses the observation blend. */
export function animalShares(distanceM: number, obs: Observation): Shares {
  const spatial = distanceM <= INTEREST.near ? 1
    : distanceM >= INTEREST.mid ? 0
    : 1 - smoothstep(INTEREST.near, INTEREST.mid, distanceM);
  let temporal = 1;
  if (obs.lower !== 'immediate') temporal = 0;
  else if (obs.higher !== 'immediate') temporal = 1 - obs.blend;
  const body = spatial * temporal;
  return { body, density: 1 - body };
}

/** What the folded animal is drawn as. The names are the existing observation scales, not a second list. */
export function pictureKind(distanceM: number, obs: Observation): PictureKind {
  const { body } = animalShares(distanceM, obs);
  if (body >= 1 - 1e-9) return 'individual';
  const leavingTime = obs.lower === 'immediate' && obs.higher !== 'immediate';
  const scale: ObservationScale = leavingTime ? obs.higher : obs.scale;
  // Just past near, while the body is still the larger share, the mark is a herd.
  // Once the density share leads, and beyond the mid radius, it is the density field.
  const herdBand = obs.scale === 'immediate' && distanceM > INTEREST.near && distanceM <= INTEREST.mid && body >= 0.5;
  if (scale === 'behavioral' || herdBand) return 'herd';
  if (scale === 'evolutionary' || scale === 'geological' || scale === 'planetary') return 'range';
  return 'density';
}

export interface Mark extends Shares {
  kind: PictureKind;
  /** Disc strength actually painted. At least INK_FLOOR while the body is still up and the density has started. */
  ink: number;
  /** Density is painted before the body is allowed to disappear. */
  order: ('density' | 'body')[];
}

export function markFor(distanceM: number, obs: Observation): Mark {
  const shares = animalShares(distanceM, obs);
  const fading = shares.body > 0 && shares.density > 0;
  const ink = fading ? Math.max(shares.density, INK_FLOOR) : shares.density;
  const order: ('density' | 'body')[] = [];
  if (ink > 0) order.push('density');
  if (shares.body > 0) order.push('body');
  return { ...shares, kind: pictureKind(distanceM, obs), ink, order };
}

export interface Account { individuals: number; density: number; population: number }

/** Fractional ledger. Individuals plus density equal the animals that were passed in. */
export function accountShares(distancesM: readonly number[], obs: Observation): Account {
  let individuals = 0, density = 0;
  for (const d of distancesM) {
    const s = animalShares(d, obs);
    individuals += s.body;
    density += s.density;
  }
  return { individuals, density, population: individuals + density };
}

/**
 * Verhulst 1838 closed form on one square kilometre. N(t) = K N0 / (N0 + (K − N0) e^{−rt}).
 * A zero count stays zero: the field does not invent animals. A non-positive dt holds.
 * K is the published density for that species, per km².
 */
export function coarseStep(count: number, dtSec: number, species: 'deer' | 'wolf'): number {
  if (!(count > 0)) return 0;
  if (!(dtSec > 0)) return count;
  const carry = perKm2(species);
  if (!(carry > 0)) return count;
  const years = dtSec / K.julian_year_s;
  const e = Math.exp(-COARSE_R_PER_YEAR * years);
  const n = (carry * count) / (count + (carry - count) * e);
  return Number.isFinite(n) ? Math.max(0, n) : carry;
}

export interface FieldCell {
  species: string;
  count: number;
  x: number;
  z: number;
  water: number;
  energy: number;
  rest: number;
}

/**
 * Animals whose density share is already 1 leave the individual tick and become a field count.
 * Needs are the mean of the animals that folded, so a later promote does not mint a blank body.
 * The controlled animal (the player) stays an individual. Partly faded animals stay individuals:
 * the drawing shows both, the ledger still counts them once via `accountShares`.
 */
export function demoteFar(world: SimWorld, centre: { x: number; z: number }, obs: Observation): { individuals: number; field: FieldCell[] } {
  const buckets = new Map<string, FieldCell>();
  let individuals = 0;
  for (const a of [...world.animals]) {
    if (!a.alive) continue;
    if (a.controlled) { individuals++; continue; }
    const share = animalShares(Math.hypot(a.x - centre.x, a.z - centre.z), obs);
    if (share.density < 1) { individuals++; continue; }
    const key = `${a.species}:${Math.floor(a.x / 1000)}:${Math.floor(a.z / 1000)}`;
    const b = buckets.get(key) ?? { species: a.species, count: 0, x: a.x, z: a.z, water: 0, energy: 0, rest: 0 };
    const n = b.count;
    b.water = (b.water * n + a.needs.water) / (n + 1);
    b.energy = (b.energy * n + a.energy) / (n + 1);
    b.rest = (b.rest * n + a.needs.rest) / (n + 1);
    b.count = n + 1;
    buckets.set(key, b);
    removeAnimal(world, a);
  }
  const field = [...buckets.values()];
  return { individuals, field };
}

/** Whole animals come back from the field through the headless sim. The fraction stays in the field. */
export function promoteField(world: SimWorld, cell: FieldCell): { bodies: number; remainder: number } {
  const bodies = Math.floor(cell.count + 1e-9);
  const remainder = cell.count - bodies;
  for (let i = 0; i < bodies; i++) {
    const a: SimAnimal = createAnimal(world, cell.species, { x: cell.x + i * 2, z: cell.z });
    a.energy = cell.energy;
    a.needs = { water: cell.water, rest: cell.rest };
  }
  return { bodies, remainder };
}
