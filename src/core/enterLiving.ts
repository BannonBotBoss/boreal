/**
 * Step into an animal the store already recorded (T-0107, roadmap step 17).
 * Issues #102 and #103: the creature already exists. You do not mint a blank life.
 *
 * The motor stays `Playable` (`src/render/playables.ts`). This module only
 * chooses which stored animal, and it does not build a rig. Age is the years
 * already on the store row (`LIFESPAN`). Place is that row's x, z. The past
 * is the founder flag or the parent id (`recordedPast`).
 *
 * Step 22 (memories) is not on main. The mark list is the slot it will fill.
 * Entry only reads it. A second entry of the same id returns the same list.
 */
import type { MemoryMark } from './perceptionBuffer';
import { LIFESPAN } from './lifespan';
import { readStoredPack, type StoredRecord } from './storedAnimal';
import { LIVING_PACK } from './livingPack';

/** Game calibration: the rider camera pulls back by this many rider-heights
 *  so the whole animal and the ground it stands on are in frame before entry.
 *  Not a species size. The camera function is still `positionCamera`. */
export const WITNESS_ALTITUDE_SCALE = 2;

const EMPTY: readonly MemoryMark[] = [];
let roster: readonly StoredRecord[] | null = null;

export interface LivingChoice {
  animal: StoredRecord;
  /** The same array the book holds. Entry does not copy or clear it. */
  memories: readonly MemoryMark[];
  playableId: 'wolf' | 'deer' | 'hare';
}

/** The animals the store wrote. One parse of the committed bytes. Not a second authority. */
export function livingRoster(): readonly StoredRecord[] {
  roster ??= readStoredPack(LIVING_PACK);
  return roster;
}

/** True when the years sit inside the species' published lifespan, and are not zero. */
export function ageInsideLifespan(species: string, years: number) {
  const life = LIFESPAN[species];
  return !!life && years > 0 && years <= life.maxYears;
}

/**
 * Enter one animal that is already in `animals`.
 * The territory holder is the one whose territory id is its own handle.
 * Pass `handle` to enter that id again. The memory book is not written.
 */
export function enterLiving(
  animals: readonly StoredRecord[],
  species: string,
  memories: ReadonlyMap<string, readonly MemoryMark[]>,
  handle?: string,
): LivingChoice {
  const animal = handle
    ? animals.find(a => a.handle === handle)
    : animals.find(a => a.species === species && a.territory === a.handle)
      ?? animals.find(a => a.species === species);
  if (!animal) throw new Error(handle ? `no stored animal ${handle}` : `no living ${species}`);
  if (animal.species !== 'wolf' && animal.species !== 'deer' && animal.species !== 'hare') {
    throw new Error(`${animal.species} is not a playable life`);
  }
  if (!ageInsideLifespan(animal.species, animal.ageYears)) {
    throw new Error(`${animal.species} age ${animal.ageYears} is outside its published lifespan`);
  }
  return { animal, memories: memories.get(animal.handle) ?? EMPTY, playableId: animal.species };
}
