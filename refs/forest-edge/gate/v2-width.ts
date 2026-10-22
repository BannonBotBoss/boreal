// T-0032 (grok continuing claude): silhouette width of the trees as drawn with ?trees=v2, measured the way claude's depth.ts
// measures the default trees (triangle cross-sections, 2.25-8 m above the base, mean width). v2 draws black spruce only, and in
// the filler ring as the variant's crown geometry (render/trees/game: lods.crown, placeTree(..., far=true), scale e.scale,
// e.scale x (.9..1.1)); other species keep the default geometry. Variant per tree = game.ts placeTree rule.
// Usage: npx tsx refs/forest-edge/gate/v2-width.ts
import * as THREE from 'three';
// node has no canvas: the needle atlas (texture only, no geometry) gets a no-op 2D context; geometry is unaffected
const ctx: any = new Proxy({}, { get: (_t, k) => k === 'getImageData' || k === 'createImageData' ? (_x: number, _y: number, w = 512, h = 512) => ({ data: new Uint8ClampedArray(Math.max(1, w * h * 4)), width: w, height: h }) : k === 'canvas' ? {} : () => ({ addColorStop() {} }), set: () => true });
(globalThis as any).document = { createElement: () => ({ width: 0, height: 0, getContext: () => ctx }) };
import { treeGeometry, treeSpecies, ageClass } from '../../../src/render/trees';
const { buildConifer } = await import('../../../src/render/trees/conifer');
import { random } from '../../../src/proc/rng';
import { placed } from '../sightline/placed';
const CLASS_AGE = [25, 70, 130, 220], VARIANTS = 4; // render/trees/game.ts
const TOP = Number(process.env.TOP ?? 8);
function radius(geo: THREE.BufferGeometry, y: number, sx: number, sy: number) { const pos = geo.getAttribute('position'), idx = geo.index, n = idx ? idx.count : pos.count;
  const P = (k: number) => { const i = idx ? idx.getX(k) : k; return [pos.getX(i) * sx, pos.getY(i) * sy, pos.getZ(i) * sx]; }; let r = 0;
  for (let k = 0; k + 2 < n; k += 3) { const tri = [P(k), P(k + 1), P(k + 2)];
    for (const [a, c] of [[tri[0], tri[1]], [tri[1], tri[2]], [tri[2], tri[0]]]) { if ((a[1] - y) * (c[1] - y) > 0 || a[1] === c[1]) continue; const f = (y - a[1]) / (c[1] - a[1]); r = Math.max(r, Math.hypot(a[0] + (c[0] - a[0]) * f, a[2] + (c[2] - a[2]) * f)); } }
  return r; }
const crowns = new Map<number, THREE.BufferGeometry>();
const crown = (vk: number) => { let g = crowns.get(vk); if (!g) { const cls = Math.floor(vk / VARIANTS), v = vk % VARIANTS; g = buildConifer('black-spruce', 101 + v * 17 + cls * 1000, CLASS_AGE[cls]).crown; crowns.set(vk, g); } return g; };
const { trees } = placed(30, 0);
const wDef: number[] = [], wV2: number[] = []; let spruce = 0, n = 0;
for (const t of trees) { if (t.layer !== 'filler') continue; n++;
  const g = treeGeometry(t.e, 2), m = g.children[0] as THREE.Mesh; if (!m) continue;
  const bs = treeSpecies(t.e.seed, t.e.x, t.e.z) === 'black-spruce'; if (bs) spruce++;
  const vk = Math.max(0, Math.min(3, ageClass(t.e.x, t.e.z))) * VARIANTS + ((t.e.seed >>> 5) % VARIANTS), sy = t.e.scale * (.9 + random(t.e.seed)() * .2);
  for (let y = 2.25; y < TOP; y += .5) { const d = 2 * radius(m.geometry, y, g.scale.x, g.scale.y); wDef.push(d); wV2.push(bs ? 2 * radius(crown(vk), y, t.e.scale, sy) : d); } }
const mean = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;
console.log(JSON.stringify({ fillerTrees: n, blackSpruceShare: +(spruce / n).toFixed(3), wDefault: +mean(wDef).toFixed(3), wV2: +mean(wV2).toFixed(3), variants: crowns.size }));