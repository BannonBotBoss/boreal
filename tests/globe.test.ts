import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPlanet, fibonacci, PLANET } from '../src/world/globe/planet';
import { FACES, bounds, children, cubeToSphere, faceDir, roots, selectLeaves, type QNode } from '../src/world/globe/cube';
import { GLOBE_LOD } from '../src/world/globe/lod';
import { LADDER } from '../src/core/quality';
import { heightAt } from '../src/core/world';

test('globe: same seed → same surface at every direction; different seed differs', () => {
  const a = createPlanet(1400), b = createPlanet(1400), c = createPlanet(77);
  let diff = 0;
  for (let k = 0; k < 400; k++) { const d = fibonacci(k, 400), ha = a.sampleSurface(d).h; assert.equal(ha, b.sampleSurface(d).h); if (Math.abs(ha - c.sampleSurface(d).h) > 1) diff++; }
  assert.ok(diff > 300, `seeds differ at ${diff}/400`);
});
test('globe: land share matches Earth hypsometry within 4 points; heights bounded', () => {
  const p = createPlanet(1400), N = 4000; let land = 0, lo = Infinity, hi = -Infinity;
  for (let k = 0; k < N; k++) { const s = p.sampleSurface(fibonacci(k, N)); if (s.h >= 0) land++; lo = Math.min(lo, s.h); hi = Math.max(hi, s.h); }
  assert.ok(Math.abs(land / N - PLANET.landShare) < .04, `land ${(land / N).toFixed(3)}`);
  assert.ok(hi < PLANET.maxLand * 1.6 && lo > -PLANET.maxDepth * 1.6, `range ${lo.toFixed(0)}..${hi.toFixed(0)}`);
});
test('globe: the home region IS the game terrain (heightAt through the gnomonic projection)', () => {
  const p = createPlanet(1400, heightAt);
  for (const [x, z] of [[0, 0], [37.5, -12], [-250, 410], [1200, 900], [-2000, -1500]]) {
    const s = p.sampleSurface(p.fromLocal(x, z));
    assert.ok(Math.abs(s.x - x) < 1e-3 && Math.abs(s.z - z) < 1e-3, `round trip ${s.x},${s.z}`);
    assert.equal(s.home, 1);
    assert.ok(Math.abs(s.h - (PLANET.home.elevation + heightAt(x, z))) < 1e-6, `height at ${x},${z}`);
  }
  const out = p.sampleSurface(p.fromLocal(PLANET.home.halfSize + 10, 0)); assert.equal(out.home, 0); // outside: planet relief only
  assert.ok(out.h > 0, 'home lift keeps the region edge on land');
});
test('cube-sphere: unit length, faces meet exactly on shared edges, children tile their parent', () => {
  for (let k = 0; k < 200; k++) { const [x, y, z] = fibonacci(k, 200), m = Math.max(Math.abs(x), Math.abs(y), Math.abs(z)), d = cubeToSphere(x / m, y / m, z / m); assert.ok(Math.abs(Math.hypot(...d) - 1) < 1e-12); }
  // the +X face edge b = 1 and the +Y face edge a = 1 are the same cube edge (1, 1, -t): same directions
  for (let t = -1; t <= 1; t += .25) {
    const a = faceDir(0, t, 1), b = faceDir(2, 1, t); // +X: (1, 1, -t); +Y: (1, 1, -t)
    assert.ok(Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) < 1e-12, `edge point t=${t}`); }
  const p: QNode = roots()[3], pb = bounds(p), kids = children(p).map(bounds);
  assert.equal(kids.reduce((s, k) => s + k.s * k.s, 0), pb.s * pb.s);
});
test('quadtree LOD: leaves cover the sphere once, refine near the camera, depth grows smoothly with zoom', () => {
  const R = PLANET.radius, o = { radius: R, maxLevel: 19, split: 2.4 }, area = (l: QNode[]) => l.reduce((s, q) => s + 4 / 4 ** q.level, 0);
  let prevDeep = -1;
  for (const alt of [R * 2, R / 4, 3e5, 3e4, 3e3, 300]) {
    const d = faceDir(4, .1, .2), cam: [number, number, number] = [d[0] * (R + alt), d[1] * (R + alt), d[2] * (R + alt)], leaves = selectLeaves(cam, o);
    assert.ok(Math.abs(area(leaves) - 24) < 1e-9, 'six faces of area 4, each covered once');
    const deep = Math.max(...leaves.map(q => q.level)); assert.ok(deep >= prevDeep, `deeper as we descend (${deep} at ${alt} m)`); prevDeep = deep;
    assert.ok(leaves.length < 1500, `${leaves.length} leaves at ${alt} m`);
  }
  assert.ok(prevDeep >= 14, `ground level reaches L${prevDeep}`);
});
test('globe LOD table: one row per ladder tier, non-increasing down the ladder', () => {
  assert.equal(GLOBE_LOD.length, LADDER.length);
  GLOBE_LOD.forEach((r, i) => { assert.equal(r.name, LADDER[i].name); if (i) for (const k of ['segments', 'split', 'maxLevel', 'cache'] as const) assert.ok(r[k] <= GLOBE_LOD[i - 1][k], `${k} at ${r.name}`); });
});
