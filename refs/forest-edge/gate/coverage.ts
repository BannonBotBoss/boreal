// T-0032 (grok continuing claude): MEASURED blocking width of the trees the filler ring actually draws, for the sight-depth
// rule (Poisson gaps: P(clear over L) = exp(-lambda w L), w = the mean width a tree blocks on a level line, Nilson 1971).
// claude's depth.ts / grok's v2-width.ts used the envelope (2 x max radius at a height), which overstates a tree with gaps.
// Here each drawn geometry is rasterised orthographically (2 cm cells) from 8 azimuths and the covered cells per row are
// counted (union of all its triangles), 2.25-8 m above the base: w = covered width per row, mean over rows, azimuths, trees.
// Drawn geometry per filler tree (render/flora/fartrees.ts:62-66): default = treeGeometry(e, 2) (opaque MeshStandard, no
// alpha); ?trees=v2 and black spruce = the variant's far crown lods.crown (render/trees/game.ts placeTree far=true ->
// materialise adds the crown only; crownMaterial has no map/alphaTest: opaque), scale e.scale, e.scale x (.9..1.1).
// Needle cards (alphaTest .4) are only in the near/mid LOD of entity trees within 55 x lod + 5 m, never in the ring.
// Usage: npx tsx refs/forest-edge/gate/coverage.ts [x z]
import * as THREE from 'three';
const ctx: any = new Proxy({}, { get: (_t, k) => k === 'getImageData' || k === 'createImageData' ? (_x: number, _y: number, w = 512, h = 512) => ({ data: new Uint8ClampedArray(Math.max(1, w * h * 4)), width: w, height: h }) : k === 'canvas' ? {} : () => ({ addColorStop() {} }), set: () => true });
(globalThis as any).document = { createElement: () => ({ width: 0, height: 0, getContext: () => ctx }) }; // needle atlas texture only
const { treeGeometry, treeSpecies, ageClass } = await import('../../../src/render/trees');
const { buildConifer } = await import('../../../src/render/trees/conifer');
const { random } = await import('../../../src/proc/rng');
const { placed } = await import('../sightline/placed');
const CLASS_AGE = [25, 70, 130, 220], VARIANTS = 4, CELL = .02, Y0 = 2.25, Y1 = 8, AZ = 8; // game.ts constants; band of depth.ts
const [cx, cz] = process.argv.length >= 4 ? process.argv.slice(2, 4).map(Number) : [30, 0];
function tris(geo: THREE.BufferGeometry, sx: number, sy: number) { const pos = geo.getAttribute('position'), idx = geo.index, n = idx ? idx.count : pos.count, o: number[][] = [];
  for (let k = 0; k + 2 < n; k += 3) { const t: number[] = []; for (let j = 0; j < 3; j++) { const i = idx ? idx.getX(k + j) : k + j; t.push(pos.getX(i) * sx, pos.getY(i) * sy, pos.getZ(i) * sx); } o.push(t); } return o; }
function width(T: number[][]) { // mean covered width (m) per row in [Y0, Y1), mean over AZ azimuths
  const rows = Math.round((Y1 - Y0) / CELL), U = 600, half = U / 2; let sum = 0;
  for (let a = 0; a < AZ; a++) { const c = Math.cos(a * Math.PI / AZ), s = Math.sin(a * Math.PI / AZ), grid = new Uint8Array(rows * U);
    for (const t of T) { const P = [0, 1, 2].map(j => [t[j * 3] * c + t[j * 3 + 2] * s, t[j * 3 + 1]]);
      const ymin = Math.min(P[0][1], P[1][1], P[2][1]), ymax = Math.max(P[0][1], P[1][1], P[2][1]); if (ymax < Y0 || ymin >= Y1) continue;
      const r0 = Math.max(0, Math.floor((ymin - Y0) / CELL)), r1 = Math.min(rows - 1, Math.floor((ymax - Y0) / CELL));
      for (let r = r0; r <= r1; r++) { const y = Y0 + (r + .5) * CELL; let lo = Infinity, hi = -Infinity;
        for (let e = 0; e < 3; e++) { const A = P[e], B = P[(e + 1) % 3]; if ((A[1] - y) * (B[1] - y) > 0 || A[1] === B[1]) continue; const u = A[0] + (B[0] - A[0]) * (y - A[1]) / (B[1] - A[1]); lo = Math.min(lo, u); hi = Math.max(hi, u); }
        if (lo > hi) continue; const i0 = Math.max(0, Math.round(lo / CELL) + half), i1 = Math.min(U - 1, Math.round(hi / CELL) + half); for (let i = i0; i <= i1; i++) grid[r * U + i] = 1; } }
    let cov = 0; for (let i = 0; i < grid.length; i++) cov += grid[i]; sum += cov * CELL / rows; }
  return sum / AZ; }
const crowns = new Map<number, THREE.BufferGeometry>();
const crown = (vk: number) => { let g = crowns.get(vk); if (!g) { const cls = Math.floor(vk / VARIANTS), v = vk % VARIANTS; g = buildConifer('black-spruce', 101 + v * 17 + cls * 1000, CLASS_AGE[cls]).crown; crowns.set(vk, g); } return g; };
const { trees } = placed(cx, cz); const wd: number[] = [], wv: number[] = [], wbsD: number[] = [], wbsV: number[] = []; let n = 0;
const cache = new Map<string, number>();
for (const t of trees) { if (t.layer !== 'filler') continue; const g = treeGeometry(t.e, 2), m = g.children[0] as THREE.Mesh; if (!m) continue; n++;
  const kd = m.geometry.uuid + ':' + g.scale.x.toFixed(2) + ':' + g.scale.y.toFixed(2); let d = cache.get(kd); if (d === undefined) cache.set(kd, d = width(tris(m.geometry, g.scale.x, g.scale.y)));
  const bs = treeSpecies(t.e.seed, t.e.x, t.e.z) === 'black-spruce'; let v = d;
  if (bs) { const vk = Math.max(0, Math.min(3, ageClass(t.e.x, t.e.z))) * VARIANTS + ((t.e.seed >>> 5) % VARIANTS), sy = t.e.scale * (.9 + random(t.e.seed)() * .2);
    const kv = vk + ':' + t.e.scale.toFixed(2) + ':' + sy.toFixed(2); v = cache.get(kv) ?? (cache.set(kv, width(tris(crown(vk), t.e.scale, sy))), cache.get(kv)!); wbsD.push(d); wbsV.push(v); }
  wd.push(d); wv.push(v); }
const mean = (a: number[]) => +(a.reduce((s, x) => s + x, 0) / Math.max(1, a.length)).toFixed(3);
console.log(JSON.stringify({ centre: [cx, cz], fillerTrees: n, blackSpruce: wbsV.length, wDefaultAll: mean(wd), wV2All: mean(wv), wBlackSpruceDefault: mean(wbsD), wBlackSpruceV2: mean(wbsV) }));