/**
 * The ground under the animals stays until the mesh that replaces it is in the scene.
 *
 * Explore, and a biome change from the map, used to drop every chunk in the same
 * frame the rebuild was queued. The new chunk takes about two seconds. Mama, the
 * pups and the grass were left with nothing under them until it arrived.
 *
 * `keep` — the chunk on screen is still the ground.
 * `swap` — the replacement is in the scene, so the old root can go.
 * `drop` — the chunk is out of range. Nothing is drawn there.
 */
export function chunkAction(stillNeeded: boolean, currentMatches: boolean, replacementReady: boolean): 'keep' | 'swap' | 'drop' {
  if (!stillNeeded) return 'drop';
  if (currentMatches && !replacementReady) return 'keep';
  if (!replacementReady) return 'keep';
  return 'swap';
}
