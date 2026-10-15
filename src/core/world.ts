import { hash, random } from './random';
import { ANIMAL_DEFAULT_ENERGY } from './animalBehavior';
import { surfaceDetail } from './surface';
import type { Kind } from './catalog';
import { LEVEL } from './tuning';
import { f, choose, scope } from '../proc/trace';
export const GENERATOR_VERSION = 1;
export const WORLD_SEED = 1400;
export const CHUNK_SIZE = 40;
export interface Entity {
  key: string; kind: Kind; seed: number; generatorVersion: number;
  x: number; z: number; rotation: number; scale: number;
  energy?: number; rollX?: number; rollZ?: number;
}
export function riverCenter(z: number) { return 45 + Math.sin(z / 44) * 17; }
const T = 'terrain';
/** One stacked terrain layer: traced contribution = (overridable) amplitude x shape. */
const layer = (name: string, shape: number, amp: number) => f(T, name, shape * f(T, `amp.${name}`, amp));
export function heightAt(x: number, z: number) {
  const distance = Math.abs(x - riverCenter(z));
  const land = f(T, 'base', 1.8) + layer('ridgesX', Math.sin(x * .043), 1.4) + layer('ridgesZ', Math.cos(z * .038), 1.3)
    + layer('ripples', Math.sin(x * .13 + z * .09), .28);
  return land - layer('riverCarve', Math.exp(-(distance * distance) / 110), 5.8) + f(T, 'depressions', surfaceDetail(x, z));
}
/** Terrain band from the tuning thresholds (colour, water); thresholds are traced so the inspector can what-if them. */
export function terrainBand(y: number) {
  return y < f('biome', 'level.waterSurface', LEVEL.waterSurface) ? 'water' : y < f('biome', 'level.shore', LEVEL.shore) ? 'shore'
    : y > f('biome', 'level.upland', LEVEL.upland) ? 'upland' : 'forest';
}
export const chunkSeed = (cx: number, cz: number, worldSeed = WORLD_SEED) =>
  f('chunk', 'chunkSeed', hash(`${GENERATOR_VERSION}:${f('chunk', 'worldSeed', worldSeed)}:${cx}:${cz}`));
/** Candidate roll -> kind (cumulative weights; one data table). */
export const KIND_TABLE = [['spruce', .60], ['rock', .80], ['log', .91], ['plant', .97], ['deer', .995], ['person', 1]] as const;
export function generateChunk(cx: number, cz: number, worldSeed = WORLD_SEED): Entity[] {
  const rng = random(chunkSeed(cx, cz, worldSeed));
  const result: Entity[] = [];
  for (let i = 0; i < 35; i++) {
    scope(`${cx}:${cz}:${i}`);
    const x = f('draw', 'x', (cx + rng()) * CHUNK_SIZE), z = f('draw', 'z', (cz + rng()) * CHUNK_SIZE);
    const roll = rng(), seed = f('draw', 'seed', Math.floor(rng() * 0xffffffff)), rotation = f('draw', 'rotation', rng() * Math.PI * 2);
    const scale = f('draw', 'scale', .75 + rng() * .65);
    if (heightAt(x, z) < LEVEL.shore || Math.hypot(x, z) < 13) continue;
    const kind: Kind = choose('draw', 'kind', roll, KIND_TABLE);
    result.push({ key: `${cx}:${cz}:${i}`, kind, seed, generatorVersion: GENERATOR_VERSION, x, z, rotation, scale });
  }
  // Independent detail stream preserves existing trees and encounter identities.
  const stones = random(hash(`stones-v1:${worldSeed}:${cx}:${cz}`));
  for (let i = 0; i < 120; i++) {
    scope(`stones:${cx}:${cz}:${i}`);
    const x = f('draw', 'x', (cx + stones()) * CHUNK_SIZE), z = f('draw', 'z', (cz + stones()) * CHUNK_SIZE);
    const seed = f('draw', 'seed', Math.floor(stones() * 0xffffffff)), rotation = f('draw', 'rotation', stones() * Math.PI * 2);
    if (heightAt(x, z) > LEVEL.shore) result.push({ key: `stones:${cx}:${cz}:${i}`, kind: 'rock', seed,
      generatorVersion: GENERATOR_VERSION, x, z, rotation, scale: 1 });
  }
  const forage = random(hash(`forage-v1:${worldSeed}:${cx}:${cz}`));
  for (let i=0;i<22;i++) {
    scope(`forage:${cx}:${cz}:${i}`);
    const x=f('draw','x',(cx+forage())*CHUNK_SIZE),z=f('draw','z',(cz+forage())*CHUNK_SIZE),seed=f('draw','seed',Math.floor(forage()*0xffffffff));
    if(heightAt(x,z)>LEVEL.shore) result.push({key:`forage:${cx}:${cz}:${i}`,kind:'forage',x,z,seed,generatorVersion:1,rotation:f('draw','rotation',forage()*Math.PI*2),scale:f('draw','scale',.65+forage()*.35)});
  }
  scope('');
  for (const entity of result) if (entity.kind === 'deer') entity.energy = ANIMAL_DEFAULT_ENERGY;
  return result;
}

