// T-0032 objective 2 (claude): inputs of the sight-depth rule. Mean silhouette width w of the drawn trees in the trunk zone
// (2 m to TOP above the base, TOP default 8; triangle cross-sections as in pixels.ts) and the drawn density (entities + filler) of the ring.
import * as THREE from 'three';
import { treeGeometry } from '../../../src/render/trees';
import { placed } from './placed';
const { trees, inner, outer } = placed(30, 0);
const widths: number[] = [];
for (const t of trees) {
  const g = treeGeometry(t.e, t.layer === 'filler' ? 2 : 1), m = g.children[0] as THREE.Mesh; if (!m) continue;
  const pos = m.geometry.getAttribute('position'), idx = m.geometry.index, n = idx ? idx.count : pos.count;
  const P = (k: number) => { const i = idx ? idx.getX(k) : k; return [pos.getX(i), pos.getY(i) * g.scale.y, pos.getZ(i)]; };
  for (let y = 2.25; y < Number(process.env.TOP ?? 8); y += .5) { // radius at this height above the base (m)
    let r = 0;
    for (let k = 0; k + 2 < n; k += 3) { const tri = [P(k), P(k + 1), P(k + 2)];
      for (const [a, c] of [[tri[0], tri[1]], [tri[1], tri[2]], [tri[2], tri[0]]]) { if ((a[1] - y) * (c[1] - y) > 0 || a[1] === c[1]) continue; const f = (y - a[1]) / (c[1] - a[1]); r = Math.max(r, Math.hypot(a[0] + (c[0] - a[0]) * f, a[2] + (c[2] - a[2]) * f) * g.scale.x); } }
    widths.push(2 * r);
  }
}
const w = widths.reduce((s, v) => s + v, 0) / widths.length, ring = Math.PI * (outer * outer - inner * inner), filler = trees.filter(t => t.layer === 'filler').length;
const lam = filler / ring; // drawn filler trees per m² in the ring (entities are thinned in the ring: chunks there are mid LOD)
console.log(JSON.stringify({ w: +w.toFixed(2), fillerPerHa: +(lam * 1e4).toFixed(0), depthM_eps01: +(Math.log(100) / (lam * w)).toFixed(1), depthM_eps001: +(Math.log(1000) / (lam * w)).toFixed(1) }));
// drawn density on dry land only (the ring around the lake view is partly water): ring area sampled on a 2 m grid with the
// filler's own land test (fartrees.ts dry), entity trees counted in the same annulus; stand stems and the code's nominal rates
{
  const { heightAt } = await import('../../../src/core/world'); const { LEVEL } = await import('../../../src/core/tuning');
  const { standAt } = await import('../../../src/core/stand'); const { fillPerHa, drawnTreesPerHa } = await import('../../../src/core/flora/stands');
  let land = 0; for (let x = 30 - outer; x <= 30 + outer; x += 2) for (let z = -outer; z <= outer; z += 2) { const d = Math.hypot(x - 30, z); if (d >= inner && d <= outer && heightAt(x, z) >= LEVEL.shore) land += 4; }
  const inRing = (t: { x: number; z: number }) => { const d = Math.hypot(t.x - 30, t.z); return d >= inner && d <= outer; };
  const fl = trees.filter(t => t.layer === 'filler' && inRing(t)).length, en = trees.filter(t => t.layer === 'entity' && inRing(t)).length, lamLand = (fl + en) / land;
  const stems = standAt(-50, 0).stems;
  console.log(JSON.stringify({ landHa: +(land / 1e4).toFixed(2), fillerLandPerHa: +(fl / land * 1e4).toFixed(0), entityLandPerHa: +(en / land * 1e4).toFixed(0),
    standStemsFarShore: Math.round(stems), nominalFill: Math.round(fillPerHa(stems)), nominalEntity: Math.round(drawnTreesPerHa(stems)),
    depthM_eps002: +(Math.log(500) / (lamLand * w)).toFixed(1), depthM_eps01: +(Math.log(100) / (lamLand * w)).toFixed(1) }));
}
