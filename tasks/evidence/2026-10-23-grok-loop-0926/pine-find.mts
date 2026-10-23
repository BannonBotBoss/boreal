// Which trees near jack pine 3:4:10 are actually placed, and how wide the wood is.
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { STAGES } from '../../../src/core/stages/elevation.ts';
import { generateChunk, CHUNK_SIZE } from '../../../src/core/world.ts';
import { applyPopulation, treeMult } from '../../../src/core/population.ts';
import { standAt } from '../../../src/core/stand.ts';
import { hash } from '../../../src/proc/rng.ts';
import { treeDims, treeSpecies } from '../../../src/render/trees.ts';

STAGES.on = true;
const dir = dirname(fileURLToPath(import.meta.url));
const cx = 3, cz = 4;
const raw = generateChunk(cx, cz);
const placed = applyPopulation(raw, cx, cz);
const centre = ((cx + 0.5) * CHUNK_SIZE);
const st = standAt(centre, (cz + 0.5) * CHUNK_SIZE);
const target = raw.find(e => e.key === '3:4:10');
const kept = placed.find(e => e.key === '3:4:10');

function describe(e: { key: string; seed: number; x: number; z: number; scale: number; kind: string }) {
  if (e.kind !== 'spruce') return { key: e.key, kind: e.kind, x: e.x, z: e.z };
  const d = treeDims(e.seed, e.x, e.z);
  const radius = (d.trunkRadius ?? 0) * e.scale;
  const sp = treeSpecies(e.seed, e.x, e.z);
  return {
    key: e.key, kind: e.kind, species: typeof sp === 'string' ? sp : (sp as { id: string }).id, x: +e.x.toFixed(3), z: +e.z.toFixed(3),
    scale: +e.scale.toFixed(3), trunkRadius: d.trunkRadius, baseRadius: +radius.toFixed(3),
    height: d.height ?? d.trunkHeight, kept: placed.some(p => p.key === e.key),
    keepRoll: +(hash(`keep:${e.key}`) / 4294967296).toFixed(3),
  };
}

const trees = raw.filter(e => e.kind === 'spruce').map(describe);
const near = placed.filter(e => e.kind === 'spruce' && Math.hypot(e.x - 141.9, e.z - 196.983) < 12).map(describe);
const out = {
  chunk: CHUNK_SIZE,
  stemsHa: st?.stems,
  treeMult: treeMult(st?.stems),
  target: target ? describe(target) : null,
  targetKept: !!kept,
  placedSpruce: placed.filter(e => e.kind === 'spruce').length,
  rawSpruce: trees.length,
  near,
};
writeFileSync(join(dir, 'pine-find.json'), JSON.stringify(out, null, 2));
console.log(JSON.stringify({ target: out.target, kept: out.targetKept, mult: out.treeMult, stems: out.stemsHa, near: out.near }, null, 2));
