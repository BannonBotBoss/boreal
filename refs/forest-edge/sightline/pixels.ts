/**
 * T-0032 objective 1, probe v2 (claude): what does each pixel of the far-shore trunk-zone box see?
 * Camera = render/math positionCamera for ?at=x,z,yaw (3 m behind, wolf cameraHeight 1.6 m, DEFAULT_PITCH 10 deg down, fov 48,
 * 1280x720). Trees = the game's placement (sightline.ts: tree entities in the chunks buildScene keeps + the fartrees filler
 * ring), each drawn as the silhouette of its own treeGeometry: per 0.25 m height bin, the largest horizontal vertex radius
 * (scaled like the group). The envelope fills the gaps between foliage blobs, so the sky share here is a LOWER bound.
 * Exit reasons per pixel ray: ground, entity/filler stem (below the lowest foliage) or crown, or sky with where it left:
 * 'end' = left the drawn world (no chunk, no filler tile) below the canopy top of the stand, 'above' = higher than every tree.
 * Usage: npx tsx refs/forest-edge/sightline/pixels.ts [x z yaw] [box x0,y0,x1,y1]
 */
import * as THREE from 'three';
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { heightAt } from '../../../src/core/world';
import { treeGeometry } from '../../../src/render/trees';
import { placed } from './placed';

const args = process.argv.slice(2);
const [ex, ez, yaw] = args.length >= 3 ? args.slice(0, 3).map(Number) : [30, 0, 1.571];
const [bx0, by0, bx1, by1] = (args[3] ?? '300,150,900,230').split(',').map(Number);
const { trees, drawn } = placed(ex, ez);

// camera (render/math positionCamera, render/playables wolf cameraHeight 1.6, RIDER_DISTANCE 3 / RIDER_HEIGHT 1.6)
const alt = 1.6, back = alt * 3 / 1.6, cam = new THREE.PerspectiveCamera(48, 1280 / 720, .1, 2000);
cam.position.set(ex + Math.sin(yaw) * back, Math.max(heightAt(ex, ez), -.2) + alt, ez + Math.cos(yaw) * back);
const p = 10 * Math.PI / 180;
cam.lookAt(cam.position.x - Math.sin(yaw) * Math.cos(p), cam.position.y - Math.sin(p), cam.position.z - Math.cos(yaw) * Math.cos(p));
cam.updateMatrixWorld(true);

// silhouette profile per geometry: radius per 0.25 m bin (local units), the lowest foliage bin (first bin wider than the trunk)
const BIN = .25, profiles = new Map<THREE.BufferGeometry, { r: number[]; top: number; crownBase: number }>();
const profile = (g: THREE.BufferGeometry) => {
  let pr = profiles.get(g); if (pr) return pr;
  // cross-sections of the triangles at each bin centre (low-poly cones have vertices only at the base and the apex: binning
  // the vertices alone left the bins between them empty, i.e. see-through)
  const pos = g.getAttribute('position'), idx = g.index, r: number[] = [], n = idx ? idx.count : pos.count;
  const P = (k: number) => { const i = idx ? idx.getX(k) : k; return [pos.getX(i), pos.getY(i), pos.getZ(i)]; };
  for (let k = 0; k + 2 < n; k += 3) {
    const tri = [P(k), P(k + 1), P(k + 2)], lo = Math.min(...tri.map(v => v[1])), hi = Math.max(...tri.map(v => v[1]));
    for (const v of tri) { const b = Math.max(0, Math.floor(v[1] / BIN)); r[b] = Math.max(r[b] ?? 0, Math.hypot(v[0], v[2])); }
    for (let b = Math.max(0, Math.ceil(lo / BIN - .5)); (b + .5) * BIN <= hi; b++) {
      const y = (b + .5) * BIN;
      for (const [a, c] of [[tri[0], tri[1]], [tri[1], tri[2]], [tri[2], tri[0]]]) {
        if ((a[1] - y) * (c[1] - y) > 0 || a[1] === c[1]) continue;
        const f = (y - a[1]) / (c[1] - a[1]); r[b] = Math.max(r[b] ?? 0, Math.hypot(a[0] + (c[0] - a[0]) * f, a[2] + (c[2] - a[2]) * f));
      }
    }
  }
  for (let b = 0; b < r.length; b++) r[b] ??= 0;
  const trunk = Math.min(...r.slice(0, 4).filter(v => v > 0)), cb = r.findIndex(v => v > trunk * 2.5);
  profiles.set(g, pr = { r, top: r.length * BIN, crownBase: Math.max(0, cb) * BIN }); return pr;
};
type Drawn = { x: number; z: number; y0: number; sx: number; sy: number; pr: ReturnType<typeof profile>; layer: string };
const shapes: Drawn[] = trees.map(t => {
  const grp = treeGeometry(t.e, t.layer === 'filler' ? 2 : 1), m = grp.children[0] as THREE.Mesh | undefined;
  return m ? { x: t.x, z: t.z, y0: heightAt(t.x, t.z), sx: grp.scale.x, sy: grp.scale.y, pr: profile(m.geometry), layer: t.layer } : undefined;
}).filter((d): d is Drawn => !!d);
const canopyTop = Math.max(...shapes.map(s => s.pr.top * s.sy));

const mapArg = args.find(a => a.startsWith('map='))?.slice(4), G = mapArg ? 2 : 4, cls: string[] = [];
const tally: Record<string, number> = {}, dist: Record<string, number[]> = {}, step = .25, dir = new THREE.Vector3();
let n = 0;
for (let py = by0; py < by1; py += G) for (let px = bx0; px < bx1; px += G) {
  dir.set(px / 1280 * 2 - 1, -(py / 720 * 2 - 1), .5).unproject(cam).sub(cam.position).normalize();
  const o = cam.position;
  // nearest tree hit: sample along the ray near each tree's closest approach
  let tHit = Infinity, what = '';
  for (const s of shapes) {
    const R = Math.max(...s.pr.r) * s.sx, hx = s.x - o.x, hz = s.z - o.z, hl = Math.hypot(dir.x, dir.z);
    const t0 = (hx * dir.x + hz * dir.z) / (hl * hl); if (t0 <= 0) continue;
    const perp = Math.abs(hx * dir.z - hz * dir.x) / hl; if (perp > R) continue;
    const half = Math.sqrt(R * R - perp * perp) / hl;
    for (let t = Math.max(0, t0 - half); t <= t0 + half && t < tHit; t += .05) {
      const x = o.x + dir.x * t, z = o.z + dir.z * t, yl = (o.y + dir.y * t - s.y0) / s.sy, b = Math.floor(yl / BIN);
      if (b < 0 || b >= s.pr.r.length) continue;
      if (Math.hypot(x - s.x, z - s.z) < s.pr.r[b] * s.sx) { tHit = t; what = `${s.layer}-${yl < s.pr.crownBase ? 'stem' : 'crown'}`; break; }
    }
  }
  let end = 'sky-above', t = 0;
  for (; t < 1500; t += step) {
    const x = o.x + dir.x * t, z = o.z + dir.z * t, y = o.y + dir.y * t;
    if (t >= tHit) { end = what; break; }
    if (y < heightAt(x, z)) { end = 'ground'; break; }
    if (!drawn(x, z)) { end = y - heightAt(x, z) < canopyTop ? 'sky-end' : 'sky-above'; break; }
  }
  cls.push(end); tally[end] = (tally[end] ?? 0) + 1; (dist[end] ??= []).push(t); n++;
}
if (mapArg) writePng(mapArg, (bx1 - bx0) / G, (by1 - by0) / G, cls.map(c => classRgb(c) ?? [255, 0, 255]));
const med = (a: number[]) => { const s = [...a].sort((x, y) => x - y); return +s[Math.floor(s.length / 2)].toFixed(1); };
console.log(JSON.stringify({ eye: [ex, ez, yaw], camera: cam.position.toArray().map(v => +v.toFixed(2)), box: [bx0, by0, bx1, by1], rays: n,
  trees: shapes.length, profiles: profiles.size, canopyTopM: +canopyTop.toFixed(1),
  share: Object.fromEntries(Object.entries(tally).sort().map(([k, v]) => [k, +(v / n).toFixed(3)])),
  medianDistM: Object.fromEntries(Object.entries(dist).sort().map(([k, v]) => [k, med(v)])) }, null, 1));

/** class colours of the map: ground brown, stems grey, crowns green (filler darker), sky-end red, sky-above blue */
function classRgb(c: string): number[] | undefined { return ({ ground: [120, 90, 60], 'entity-stem': [170, 170, 170], 'filler-stem': [110, 110, 110], 'entity-crown': [60, 200, 60], 'filler-crown': [20, 110, 40], 'sky-end': [230, 40, 40], 'sky-above': [80, 140, 255] } as Record<string, number[]>)[c]; }
function writePng(path: string, w: number, h: number, px: number[][]) {
  const crcT = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (b: Buffer) => { let c = ~0; for (const v of b) c = crcT[(c ^ v) & 255] ^ (c >>> 8); return (~c) >>> 0; };
  const chunk = (t: string, d: Buffer) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]), c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const raw = Buffer.alloc((w * 3 + 1) * h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) raw.set(px[y * w + x], y * (w * 3 + 1) + 1 + x * 3);
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr.set([8, 2, 0, 0, 0], 8);
  writeFileSync(path, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
}
