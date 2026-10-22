/**
 * T-0032 (claude): the trees the game draws around a centre, from its own placement code (shared by sightline.ts and pixels.ts).
 * Tree entities: core/world generateChunk + core/population applyPopulation in the chunks render/buildScene sync keeps
 * (INTEREST.mid square distance). Filler: render/flora/fartrees refill (tiles whose centre lies between inner = 55 x lod + 5 and
 * outer = max(inner, INTEREST.mid)), the same entity fields it builds. Staged terrain on, as in the app.
 */
import { CHUNK_SIZE, GENERATOR_VERSION, WORLD_SEED, generateChunk, heightAt, type Entity } from '../../../src/core/world';
import { applyPopulation } from '../../../src/core/population';
import { INTEREST, setInterestCentre, squareDistance } from '../../../src/core/interest';
import { FAR_TREES, farTreesInTile } from '../../../src/core/flora/stands';
import { standAt } from '../../../src/core/stand';
import { LEVEL } from '../../../src/core/tuning';
import { RENDER } from '../../../src/core/renderSettings';
import { STAGES, lakeAt } from '../../../src/core/stages/elevation';
import { riverAt } from '../../../src/core/stages/rivers';
import { hash, random } from '../../../src/proc/rng';

STAGES.on = true; // the app default (setting world.stagedTerrain.v2, core/renderSettings); the module default is off
/** The water sheet render/terrainCore draws: a lake cell or a river bed (inner bank), else the base water plane. */
export const dryAt = (x: number, z: number) => { if (lakeAt(STAGES.seed, x, z)) return false; const rv = riverAt(STAGES.seed, x, z); return !(rv && rv.d < rv.half + rv.bank) && heightAt(x, z) > LEVEL.waterSurface; };
export type Placed = { x: number; z: number; layer: 'entity' | 'filler'; e: Entity };

export function placed(ex: number, ez: number) {
  setInterestCentre(ex, ez);
  const trees: Placed[] = [], chunkSet = new Set<string>();
  const cx0 = Math.floor(ex / CHUNK_SIZE), cz0 = Math.floor(ez / CHUNK_SIZE), rad = Math.ceil(INTEREST.mid / CHUNK_SIZE);
  for (let a = cx0 - rad; a <= cx0 + rad; a++) for (let b = cz0 - rad; b <= cz0 + rad; b++) {
    if (squareDistance(a * CHUNK_SIZE, b * CHUNK_SIZE, CHUNK_SIZE) > INTEREST.mid && !(a === cx0 && b === cz0)) continue;
    chunkSet.add(`${a}:${b}`);
    for (const e of applyPopulation(generateChunk(a, b), a, b)) if (e.kind === 'spruce') trees.push({ x: e.x, z: e.z, layer: 'entity', e });
  }
  const inner = 55 * RENDER.lod.trees + 5, outer = Math.max(inner, Number(process.env.OUTER) || INTEREST.mid), T = FAR_TREES.tile, stands = new Map<string, number>();
  const stemsAt = (x: number, z: number) => { const cx = Math.floor(x / CHUNK_SIZE), cz = Math.floor(z / CHUNK_SIZE), k = `${cx},${cz}`; let s = stands.get(k); if (s === undefined) stands.set(k, s = RENDER.standMap ? standAt((cx + .5) * CHUNK_SIZE, (cz + .5) * CHUNK_SIZE).stems : 1500); return s; };
  const tileSet = new Set<string>(), r = Math.ceil(outer / T), ox = Math.floor(ex / T), oz = Math.floor(ez / T);
  for (let tz = oz - r; tz <= oz + r; tz++) for (let tx = ox - r; tx <= ox + r; tx++) {
    const d = Math.hypot((tx + .5) * T - ex, (tz + .5) * T - ez); if (d < inner || d > outer) continue;
    tileSet.add(`${tx},${tz}`); let i = 0;
    for (const p of farTreesInTile(tx, tz, RENDER.treeDensity, stemsAt, (x, z) => heightAt(x, z) < LEVEL.shore ? 0 : 1)) { // fartrees.ts dry()
      const rr = random(hash(`fartree-v2:${WORLD_SEED}:${Math.floor(p.r * 0xffffffff)}`));
      const e: Entity = { key: `fartree:${tx}:${tz}:${i++}`, kind: 'spruce', seed: Math.floor(rr() * 0xffffffff), generatorVersion: GENERATOR_VERSION, x: p.x, z: p.z, rotation: rr() * Math.PI * 2, scale: .75 + rr() * .65 };
      trees.push({ x: p.x, z: p.z, layer: 'filler', e });
    }
  }
  const drawn = (x: number, z: number) => chunkSet.has(`${Math.floor(x / CHUNK_SIZE)}:${Math.floor(z / CHUNK_SIZE)}`) || tileSet.has(`${Math.floor(x / T)},${Math.floor(z / T)}`);
  return { trees, drawn, chunks: chunkSet.size, tiles: tileSet.size, inner, outer };
}
