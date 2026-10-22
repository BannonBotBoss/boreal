// T-0032 debug (claude): sizes of the probe's tree silhouettes (height, widest radius, crown base) per layer.
import * as THREE from 'three';
import { treeGeometry, treeSpecies } from '../../../src/render/trees';
import { placed } from './placed';
const { trees } = placed(30, 0);
const rows: Record<string, number[][]> = {};
for (const t of trees) {
  const g = treeGeometry(t.e, t.layer === 'filler' ? 2 : 1), m = g.children[0] as THREE.Mesh; if (!m) continue;
  m.geometry.computeBoundingBox(); const b = m.geometry.boundingBox!;
  const k = `${t.layer}:${treeSpecies(t.e.seed, t.e.x, t.e.z)}`;
  (rows[k] ??= []).push([b.max.y * g.scale.y, Math.max(b.max.x - b.min.x, b.max.z - b.min.z) * g.scale.x, b.min.y]);
}
const q = (a: number[], f: number) => +[...a].sort((x, y) => x - y)[Math.floor(a.length * f)].toFixed(1);
for (const [k, v] of Object.entries(rows)) console.log(k, v.length, 'height q10/50/90', q(v.map(r => r[0]), .1), q(v.map(r => r[0]), .5), q(v.map(r => r[0]), .9), 'width q50', q(v.map(r => r[1]), .5), 'minY', q(v.map(r => r[2]), .5));
