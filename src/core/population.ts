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

/** Share of the 35 generator candidates per chunk that become each kind (world.ts roll thresholds). */
const SHARE: Partial<Record<Kind, number>> = { spruce: .6, deer: .005 };
const keep = (e: Entity, mult: number) => mult >= 1 || hash(`keep:${e.key}`) / 4294967296 < mult;

export function applyPopulation(entities: Entity[], cx: number, cz: number, worldSeed = WORLD_SEED): Entity[] {
  const mult: Partial<Record<Kind, number>> = { spruce: RENDER.treeDensity, deer: RENDER.deer.on ? RENDER.deer.count : 0 };
  const out = entities.filter(e => keep(e, mult[e.kind] ?? 1));
  for (const kind of ['spruce', 'deer'] as Kind[]) {
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
