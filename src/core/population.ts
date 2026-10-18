/**
 * Placement-layer population control (Grok Bot): thins or adds trees and deer AFTER generateChunk, so the generator
 * and animal code are untouched. Seeded per entity key / chunk, so the same settings always give the same world.
 */
import { hash, random } from '../proc/rng';
import { CHUNK_SIZE, GENERATOR_VERSION, WORLD_SEED, heightAt, type Entity } from './world';
import { ANIMAL_DEFAULT_ENERGY } from './animalBehavior';
import { LEVEL } from './tuning';
import { RENDER } from './renderSettings';
import type { Kind } from './catalog';
import { standAt } from './stand';

/** Share of the 35 generator candidates per chunk that become each kind (world.ts roll thresholds). */
const SHARE: Partial<Record<Kind, number>> = { spruce: .6, deer: .005, log: .11, plant: .06 };
/** Tree ENTITY density at a stand: 35 candidates x .6 spruce share x clamp(stems / stemRef, min, max) x the governor tree
 *  factor. stemRef 3000 keeps entity counts (gameplay, collision, chunk build cost) near their old values after core/stand
 *  moved to measured densities (mature 1300-2150/ha); render/flora/fartrees draws the rest look-only. ONE source: core/flora/stands imports it. */
export const ENTITY_TREES = { candidates: 35, share: SHARE.spruce!, stemRef: 3000, min: .45, max: 2.2 };
export const treeMult = (stems: number | undefined, density = RENDER.treeDensity) =>
  density * (stems === undefined ? 1 : Math.min(ENTITY_TREES.max, Math.max(ENTITY_TREES.min, stems / ENTITY_TREES.stemRef)));
const keep = (e: Entity, mult: number) => mult >= 1 || hash(`keep:${e.key}`) / 4294967296 < mult;

export function applyPopulation(entities: Entity[], cx: number, cz: number, worldSeed = WORLD_SEED): Entity[] {
  // Stand structure (core/stand) at the chunk centre: stems/ha scale tree entities (treeMult),
  // coarse woody debris → logs, understory cover → small plants. Clamped to keep chunk build cost bounded.
  const st = RENDER.standMap ? standAt((cx + .5) * CHUNK_SIZE, (cz + .5) * CHUNK_SIZE) : undefined, clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
  const mult: Partial<Record<Kind, number>> = { spruce: treeMult(st?.stems), deer: RENDER.deer.on ? RENDER.deer.count : 0,
    ...(st ? { log: clamp(st.cwd / 3, .3, 2.5), plant: clamp((st.cover.shrubs + st.cover.bunchberry + st.cover.seedlings) / .3, .3, 2) } : {}) };
  const out = entities.filter(e => keep(e, mult[e.kind] ?? 1));
  for (const kind of ['spruce', 'deer', 'log', 'plant'] as Kind[]) {
    const extra = (mult[kind] ?? 1) - 1; if (extra <= 0) continue;
    const rng = random(hash(`extra-${kind}-v1:${worldSeed}:${cx}:${cz}`)), tries = Math.round(35 * SHARE[kind]! * extra) + (rng() < (35 * SHARE[kind]! * extra) % 1 ? 1 : 0);
    for (let i = 0; i < tries; i++) {
      const x = (cx + rng()) * CHUNK_SIZE, z = (cz + rng()) * CHUNK_SIZE, seed = Math.floor(rng() * 0xffffffff), rotation = rng() * Math.PI * 2, scale = .75 + rng() * .65;
      if (heightAt(x, z) < LEVEL.shore || Math.hypot(x, z) < 13) continue;
      out.push({ key: `extra-${kind}:${cx}:${cz}:${i}`, kind, seed, generatorVersion: GENERATOR_VERSION, x, z, rotation, scale, ...(kind === 'deer' ? { energy: ANIMAL_DEFAULT_ENERGY } : {}) });
    }
  }
  return out;
}
