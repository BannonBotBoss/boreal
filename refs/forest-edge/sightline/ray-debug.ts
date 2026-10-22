// T-0032 debug (claude): trees near one pixel ray of the lake view (closest approach, ray height there, silhouette radius).
import * as THREE from 'three';
import { heightAt } from '../../../src/core/world';
import { treeGeometry, treeSpecies } from '../../../src/render/trees';
import { placed } from './placed';
const [px, py] = process.argv.slice(2, 4).map(Number);
const { trees } = placed(30, 0);
const cam = new THREE.PerspectiveCamera(48, 1280 / 720, .1, 2000); cam.position.set(33, Math.max(heightAt(30, 0), -.2) + 1.6, 0);
const p = 10 * Math.PI / 180, yaw = 1.571; cam.lookAt(cam.position.x - Math.sin(yaw) * Math.cos(p), cam.position.y - Math.sin(p), cam.position.z - Math.cos(yaw) * Math.cos(p)); cam.updateMatrixWorld(true);
const dir = new THREE.Vector3(px / 1280 * 2 - 1, -(py / 720 * 2 - 1), .5).unproject(cam).sub(cam.position).normalize(), o = cam.position;
console.log('dir', dir.toArray().map(v => +v.toFixed(3)));
for (let t = 40; t <= 140; t += 10) console.log('t', t, 'x,z', +(o.x + dir.x * t).toFixed(1), +(o.z + dir.z * t).toFixed(1), 'rayY', +(o.y + dir.y * t).toFixed(1), 'ground', +heightAt(o.x + dir.x * t, o.z + dir.z * t).toFixed(1));
const near = trees.map(tr => { const hx = tr.x - o.x, hz = tr.z - o.z, hl = Math.hypot(dir.x, dir.z), t0 = (hx * dir.x + hz * dir.z) / hl / hl, perp = Math.abs(hx * dir.z - hz * dir.x) / hl; return { tr, t0, perp }; })
  .filter(a => a.t0 > 0 && a.perp < 6).sort((a, b) => a.t0 - b.t0);
for (const { tr, t0, perp } of near) {
  const g = treeGeometry(tr.e, tr.layer === 'filler' ? 2 : 1); const m = g.children[0] as THREE.Mesh; m.geometry.computeBoundingBox();
  const y0 = heightAt(tr.x, tr.z), yr = o.y + dir.y * t0;
  console.log(tr.layer, treeSpecies(tr.e.seed, tr.x, tr.z), 't0', t0.toFixed(1), 'perp', perp.toFixed(2), 'base', y0.toFixed(1), 'rayY-base', (yr - y0).toFixed(1), 'top', (m.geometry.boundingBox!.max.y * g.scale.y).toFixed(1), 'halfwidth', ((m.geometry.boundingBox!.max.x - m.geometry.boundingBox!.min.x) / 2 * g.scale.x).toFixed(1));
}
// silhouette radius at the ray height for the three closest-perp trees (same binning as pixels.ts)
for (const { tr, t0, perp } of near.filter(a => a.perp < 1).slice(0, 4)) {
  const g = treeGeometry(tr.e, tr.layer === 'filler' ? 2 : 1), m = g.children[0] as THREE.Mesh, pos = m.geometry.getAttribute('position'), r: number[] = [];
  for (let i = 0; i < pos.count; i++) { const b = Math.max(0, Math.floor(pos.getY(i) / .25)), d = Math.hypot(pos.getX(i), pos.getZ(i)); r[b] = Math.max(r[b] ?? 0, d); }
  const yl = (o.y + dir.y * t0 - heightAt(tr.x, tr.z)) / g.scale.y, b = Math.floor(yl / .25);
  console.log(treeSpecies(tr.e.seed, tr.x, tr.z), 'perp', perp.toFixed(2), 'yl', yl.toFixed(2), 'bin', b, 'r(bin)*sx', ((r[b] ?? -1) * g.scale.x).toFixed(2), 'bins', r.length, 'count', pos.count, 'itemSize', pos.itemSize, 'normalized', pos.normalized, 'r[0..40 step 4]', r.filter((_, i) => i % 4 === 0).slice(0, 12).map(v => (v ?? 0).toFixed(1)).join(' '));
}
