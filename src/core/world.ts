import { hash, random } from './random';
import { ANIMAL_DEFAULT_ENERGY } from './animalBehavior';
import { surfaceDetail } from './surface';
import type { Kind } from './catalog';
export const GENERATOR_VERSION = 1;
export const WORLD_SEED = 1400;
export const CHUNK_SIZE = 40;
export interface Entity {
  key: string; kind: Kind; seed: number; generatorVersion: number;
  x: number; z: number; rotation: number; scale: number;
  energy?: number; rollX?: number; rollZ?: number;
}
export function riverCenter(z: number) { return 45 + Math.sin(z / 44) * 17; }
export function heightAt(x: number, z: number) {
  const distance = Math.abs(x - riverCenter(z));
  const land = 1.8 + Math.sin(x * .043) * 1.4 + Math.cos(z * .038) * 1.3
    + Math.sin(x * .13 + z * .09) * .28;
  return land - 5.8 * Math.exp(-(distance * distance) / 110) + surfaceDetail(x, z);
}
export function generateChunk(cx: number, cz: number, worldSeed = WORLD_SEED): Entity[] {
  const rng = random(hash(`${GENERATOR_VERSION}:${worldSeed}:${cx}:${cz}`));
  const result: Entity[] = [];
  for (let i = 0; i < 35; i++) {
    const x = (cx + rng()) * CHUNK_SIZE, z = (cz + rng()) * CHUNK_SIZE;
    const roll = rng(), seed = Math.floor(rng() * 0xffffffff), rotation = rng() * Math.PI * 2;
    const scale = .75 + rng() * .65;
    if (heightAt(x, z) < .5 || Math.hypot(x, z) < 13) continue;
    const kind: Kind = roll < .60 ? 'spruce' : roll < .80 ? 'rock' : roll < .91 ? 'log' : roll < .97 ? 'plant' : roll < .995 ? 'deer' : 'person';
    result.push({ key: `${cx}:${cz}:${i}`, kind, seed, generatorVersion: GENERATOR_VERSION, x, z, rotation, scale });
  }
  // Independent detail stream preserves existing trees and encounter identities.
  const stones = random(hash(`stones-v1:${worldSeed}:${cx}:${cz}`));
  for (let i = 0; i < 120; i++) {
    const x = (cx + stones()) * CHUNK_SIZE, z = (cz + stones()) * CHUNK_SIZE;
    const seed = Math.floor(stones() * 0xffffffff), rotation = stones() * Math.PI * 2;
    if (heightAt(x, z) > .5) result.push({ key: `stones:${cx}:${cz}:${i}`, kind: 'rock', seed,
      generatorVersion: GENERATOR_VERSION, x, z, rotation, scale: 1 });
  }
  const forage = random(hash(`forage-v1:${worldSeed}:${cx}:${cz}`));
  for (let i=0;i<22;i++) {
    const x=(cx+forage())*CHUNK_SIZE,z=(cz+forage())*CHUNK_SIZE,seed=Math.floor(forage()*0xffffffff);
    if(heightAt(x,z)>.5) result.push({key:`forage:${cx}:${cz}:${i}`,kind:'forage',x,z,seed,generatorVersion:1,rotation:forage()*Math.PI*2,scale:.65+forage()*.35});
  }
  for (const entity of result) if (entity.kind === 'deer') entity.energy = ANIMAL_DEFAULT_ENERGY;
  return result;
}

