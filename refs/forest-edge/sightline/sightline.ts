/**
 * T-0032 objective 1 (claude): where do trunk-height sight lines across the lake view's far shore end?
 * Uses the game's own placement (core/world generateChunk + core/population applyPopulation for tree entities, the chunk
 * interest rule of render/buildScene sync, core/flora/stands farTreesInTile for the look-only ring of render/flora/fartrees).
 * Rays: from the eye at ?at=30,0,1.571 (forward = (-sin yaw, -cos yaw)), a fan of azimuths; where a ray first reaches dry
 * land after water (the far shore), a horizontal line at shore ground + h runs on until it hits terrain, a tree, or the end
 * of the drawn world (no chunk, no filler tile -> sky). A tree blocks when the line passes within r of its stem.
 * r = 0.15 m: bare trunk (lower stem without live branches); r = 1.2 m: a crown that reaches down to that height.
 * Usage: npx tsx refs/forest-edge/sightline/sightline.ts [x z yaw]
 */
import { CHUNK_SIZE, generateChunk, heightAt } from '../../../src/core/world';
import { applyPopulation } from '../../../src/core/population';
import { INTEREST, setInterestCentre, squareDistance } from '../../../src/core/interest';
import { FAR_TREES, farTreesInTile } from '../../../src/core/flora/stands';
import { standAt } from '../../../src/core/stand';
import { LEVEL } from '../../../src/core/tuning';
import { RENDER } from '../../../src/core/renderSettings';
import { STAGES, lakeAt } from '../../../src/core/stages/elevation';
import { riverAt } from '../../../src/core/stages/rivers';

const [ex, ez, yaw] = process.argv.length >= 5 ? process.argv.slice(2, 5).map(Number) : [30, 0, 1.571];
STAGES.on = true; // the app default (setting world.stagedTerrain.v2, core/renderSettings); the module default is off
setInterestCentre(ex, ez);
// the water sheet render/terrainCore draws: a lake cell or a river bed (inner bank), else the base water plane
const dryAt = (x: number, z: number) => { if (lakeAt(STAGES.seed, x, z)) return false; const rv = riverAt(STAGES.seed, x, z); return !(rv && rv.d < rv.half + rv.bank) && heightAt(x, z) > LEVEL.waterSurface; };
type Tree = { x: number; z: number; layer: 'entity' | 'filler' };
const trees: Tree[] = [];
// Chunks the game instantiates around the centre (render/buildScene sync, ground level).
const cx0 = Math.floor(ex / CHUNK_SIZE), cz0 = Math.floor(ez / CHUNK_SIZE), rad = Math.ceil(INTEREST.mid / CHUNK_SIZE);
const chunkSet = new Set<string>();
for (let a = cx0 - rad; a <= cx0 + rad; a++) for (let b = cz0 - rad; b <= cz0 + rad; b++) {
  if (squareDistance(a * CHUNK_SIZE, b * CHUNK_SIZE, CHUNK_SIZE) > INTEREST.mid && !(a === cx0 && b === cz0)) continue;
  chunkSet.add(`${a}:${b}`);
  for (const e of applyPopulation(generateChunk(a, b), a, b)) if (e.kind === 'spruce') trees.push({ x: e.x, z: e.z, layer: 'entity' });
}
// Look-only filler ring (render/flora/fartrees): tiles whose centre lies between inner and outer.
const inner = 55 * RENDER.lod.trees + 5, outer = Math.max(inner, INTEREST.mid), T = FAR_TREES.tile;
const stands = new Map<string, number>();
const stemsAt = (x: number, z: number) => { const cx = Math.floor(x / CHUNK_SIZE), cz = Math.floor(z / CHUNK_SIZE), k = `${cx},${cz}`; let s = stands.get(k); if (s === undefined) stands.set(k, s = RENDER.standMap ? standAt((cx + .5) * CHUNK_SIZE, (cz + .5) * CHUNK_SIZE).stems : 1500); return s; };
const tileSet = new Set<string>();
const r = Math.ceil(outer / T), ox = Math.floor(ex / T), oz = Math.floor(ez / T);
for (let tz = oz - r; tz <= oz + r; tz++) for (let tx = ox - r; tx <= ox + r; tx++) {
  const d = Math.hypot((tx + .5) * T - ex, (tz + .5) * T - ez); if (d < inner || d > outer) continue;
  tileSet.add(`${tx},${tz}`);
  for (const p of farTreesInTile(tx, tz, RENDER.treeDensity, stemsAt, (x, z) => heightAt(x, z) < LEVEL.shore ? 0 : 1)) trees.push({ x: p.x, z: p.z, layer: 'filler' }); // fartrees.ts dry()
}
const drawn = (x: number, z: number) => chunkSet.has(`${Math.floor(x / CHUNK_SIZE)}:${Math.floor(z / CHUNK_SIZE)}`) || tileSet.has(`${Math.floor(x / T)},${Math.floor(z / T)}`);

const fx = -Math.sin(yaw), fz = -Math.cos(yaw), step = .25, out: Record<string, Record<string, number>> = {};
const rays: { az: number; sx: number; sz: number; sy: number }[] = [];
for (let deg = -40; deg <= 40; deg += 1) { // a 16:9 view at the game's vertical FOV spans about +-40 deg
  const a = deg * Math.PI / 180, dx = fx * Math.cos(a) - fz * Math.sin(a), dz = fx * Math.sin(a) + fz * Math.cos(a);
  let wet = false;
  for (let s = 0; s < 120; s += step) {
    const x = ex + dx * s, z = ez + dz * s;
    if (!dryAt(x, z)) wet = true; else if (wet) { rays.push({ az: deg, sx: x, sz: z, sy: heightAt(x, z) }); break; }
  }
}
for (const h of [.5, 1, 2, 3]) for (const rr of [.15, 1.2]) {
  const tally: Record<string, number> = { sky: 0, ground: 0, entity: 0, filler: 0 }; let run = 0;
  for (const ray of rays) {
    const a = ray.az * Math.PI / 180, dx = fx * Math.cos(a) - fz * Math.sin(a), dz = fx * Math.sin(a) + fz * Math.cos(a), y = ray.sy + h;
    // nearest tree whose stem lies within rr of the line, ahead of the shore point
    let tHit = Infinity, layer = '';
    for (const t of trees) { const px = t.x - ray.sx, pz = t.z - ray.sz, along = px * dx + pz * dz; if (along <= 0) continue; const perp = Math.abs(px * dz - pz * dx); if (perp < rr && along < tHit) { tHit = along; layer = t.layer; } }
    let end = 'sky', s = 0;
    for (; s < 600; s += step) {
      const x = ray.sx + dx * s, z = ray.sz + dz * s;
      if (s >= tHit) { end = layer; break; }
      if (heightAt(x, z) > y) { end = 'ground'; break; }
      if (!drawn(x, z)) { end = 'sky'; break; }
    }
    tally[end]++; run += s;
  }
  out[`h${h}_r${rr}`] = Object.fromEntries([...Object.entries(tally).map(([k, v]) => [k, +(v / rays.length).toFixed(3)]), ['meanRunM', +(run / rays.length).toFixed(1)]]);
}
console.log(JSON.stringify({ eye: [ex, ez, yaw], rays: rays.length, inner, outer, chunks: chunkSet.size, fillerTiles: tileSet.size,
  entityTrees: trees.filter(t => t.layer === 'entity').length, fillerTrees: trees.filter(t => t.layer === 'filler').length,
  shoreDistM: rays.length ? +(rays.reduce((s, r) => s + Math.hypot(r.sx - ex, r.sz - ez), 0) / rays.length).toFixed(1) : null, result: out }, null, 1));
