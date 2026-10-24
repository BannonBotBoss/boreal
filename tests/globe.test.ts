import { figureRadius } from '../src/world/globe/figure';
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
import { buildTile } from '../src/world/globe/tile';
import { node } from '../src/world/globe/cube';
import { finish } from '../src/core/interest';
test('globe tiles: deterministic, shared edges match in position AND normal (no cracks or lighting seams), aH < 0 only under water', () => {
  const p = createPlanet(1400, heightAt), seg = 16, n = seg + 1;
  const A = finish(buildTile(node(4, 6, 20, 30), p, seg)), B = finish(buildTile(node(4, 6, 21, 30), p, seg)), A2 = finish(buildTile(node(4, 6, 20, 30), p, seg));
  assert.deepEqual(A.position, A2.position); assert.deepEqual(A.normal, A2.normal);
  for (let j = 0; j < n; j++) { // A's right edge (i = seg) is B's left edge (i = 0)
    const a = j * n + seg, b = j * n;
    for (let k = 0; k < 3; k++) {
      assert.ok(Math.abs(A.position[a * 3 + k] + A.centre[k] - (B.position[b * 3 + k] + B.centre[k])) < .05, 'edge position');
      assert.ok(Math.abs(A.normal[a * 3 + k] - B.normal[b * 3 + k]) < 1e-4, `edge normal j=${j}`);
    }
  }
  let wet = 0;
  for (let f = 0; f < 6 && !wet; f++) { const sea = finish(buildTile(node(f, 2, 1, 1), p, seg));
    for (let v = 0; v < n * n; v++) if (sea.height[v] < 0) { wet++; const r = Math.hypot(sea.position[v * 3] + sea.centre[0], sea.position[v * 3 + 1] + sea.centre[1], sea.position[v * 3 + 2] + sea.centre[2]); const vx = sea.position[v * 3] + sea.centre[0], vy = sea.position[v * 3 + 1] + sea.centre[1], vz = sea.position[v * 3 + 2] + sea.centre[2]; if (p.sampleSurface([vx / r, vy / r, vz / r]).kind !== 'ocean') continue; // far-field lakes sit at their own level
      assert.ok(Math.abs(r - figureRadius([vx / r, vy / r, (sea.position[v * 3 + 2] + sea.centre[2]) / r])) < 2, 'water vertices sit on the sea surface (the hydrostatic figure)'); } }
  assert.ok(wet > 0, 'found ocean vertices');
});
test('globe tile cost: one 32-segment tile builds well under a frame budget on this machine', () => {
  const p = createPlanet(1400, heightAt); finish(buildTile(node(2, 4, 3, 3), p, 32));
  const t = finish(buildTile(node(2, 5, 7, 9), p, 32)); assert.ok(t.cpu < 200, `${t.cpu.toFixed(1)} ms`);
});
import { centre } from '../src/world/globe/cube';
test('globe tiles: exact dyadic lattice — a vertex a child shares with its parent is bit-identical', () => {
  const p = createPlanet(7, heightAt), R = p.radius, near = (q: QNode) => { const c = centre(q, R); return -(c[0] * p.home[0] + c[1] * p.home[1] + c[2] * p.home[2]); };
  let q = roots().sort((x, y) => near(x) - near(y))[0];
  while (q.level < 11) q = children(q).sort((x, y) => near(x) - near(y))[0];
  const seg = 24, n = seg + 1, par = finish(buildTile(q, p, seg)), world = (t: { position: Float32Array; centre: number[] }, v: number) => [0, 1, 2].map(k => t.position[v * 3 + k] + t.centre[k]);
  let checked = 0;
  for (const k of children(q)) { // child vertex (2i', 2j') in parent grid ↔ even child vertices: compare the sampled heights (exact)
    const ch = finish(buildTile(k, p, seg)), oi = (k.i - q.i * 2) * seg / 2, oj = (k.j - q.j * 2) * seg / 2;
    for (let j = 0; j < n; j += 2) for (let i = 0; i < n; i += 2) {
      const pv = (oj + j / 2) * n + oi + i / 2, cv = j * n + i;
      assert.equal(ch.height[cv], par.height[pv]); assert.deepEqual(ch.color.slice(cv * 3, cv * 3 + 3), par.color.slice(pv * 3, pv * 3 + 3));
      const a = world(ch, cv), b = world(par, pv); assert.ok(Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) < 1, 'same point'); checked++;
    }
  }
  assert.equal(checked, 4 * 13 * 13);
});
import { surfaceDataAt } from '../src/world/globe/surfaceData';
import { STAGES } from '../src/core/stages/elevation';
import { SOIL_KINDS } from '../src/core/stages/soils';
test('globe surface data: soils/lakes from the staged lookups, placeholders flagged, layered terrain gives nulls', () => {
  const was = STAGES.on; STAGES.on = true;
  try {
    const kinds = new Set<string>(); let lakes = 0;
    for (let k = 0; k < 400; k++) { const s = surfaceDataAt((k % 20) * 190 - 1900, Math.floor(k / 20) * 190 - 1900); kinds.add(String(s.soil)); if (s.lake) { lakes++; assert.ok(s.lake.depth >= 0); } assert.ok(s.wetness! >= 0 && s.wetness! <= 1); }
    assert.ok([...kinds].every(k => (SOIL_KINDS as readonly string[]).includes(k)) && kinds.size >= 2, [...kinds].join());
    const s = surfaceDataAt(0, 0); assert.deepEqual(s.placeholder, { forest: true, tree: true, season: true, snow: true });
  } finally { STAGES.on = was; }
  const l = surfaceDataAt(0, 0, STAGES.seed, false); assert.equal(l.soil, null); assert.equal(l.lake, null); assert.equal(l.wetness, null);
});
import { renderOffset, gpuRelative } from '../src/world/globe/origin';
test('camera-relative rendering: vertex error under 1 mm at 300 m and at 2 m altitude, 6400 km from the origin', () => {
  const p = createPlanet(7, heightAt), R = p.radius, seg = 48;
  for (const [alt, level] of [[300, 17], [2, 19]] as const) {
    const near = (q: QNode) => { const c = centre(q, R); return -(c[0] * p.home[0] + c[1] * p.home[1] + c[2] * p.home[2]) / Math.hypot(...c); };
    let q = roots().sort((x, y) => near(x) - near(y))[0];
    while (q.level < level) q = children(q).sort((x, y) => near(x) - near(y))[0];
    const t = finish(buildTile(q, p, seg)), den = seg * 2 ** q.level, n = seg + 1, cd = faceDir(q.face, 0, 0);
    const s0 = p.sampleSurface(p.home), cam = p.home.map(v => v * (figureRadius(p.home) + Math.max(s0.h, s0.water) + alt)) as [number, number, number];
    const off = renderOffset(t.centre, cam); let worst = 0, naive = 0;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const d = faceDir(q.face, -1 + 2 * (q.i * seg + i) / den, -1 + 2 * (q.j * seg + j) / den, cd), s = p.sampleSurface(d), r = figureRadius(d) + Math.max(s.h, s.water);
      const ref = [d[0] * r - cam[0], d[1] * r - cam[1], d[2] * r - cam[2]], g = gpuRelative(off, t.position, (j * n + i) * 3);
      worst = Math.max(worst, Math.hypot(g[0] - ref[0], g[1] - ref[1], g[2] - ref[2]));
      naive = Math.max(naive, Math.hypot(...[0, 1, 2].map(k => Math.fround(Math.fround(d[k] * r) - Math.fround(cam[k])) - ref[k]) as [number, number, number]));
    }
    assert.ok(Math.hypot(...off) < 2000, `tile is near the camera (${Math.hypot(...off).toFixed(0)} m)`);
    assert.ok(worst < 1e-3, `alt ${alt} m: camera-relative vertex error ${(worst * 1000).toFixed(3)} mm`);
    assert.ok(naive > 1e-2, `alt ${alt} m: float32 world coordinates would be off by ${(naive * 1000).toFixed(0)} mm (the bug this prevents)`);
  }
});
import { createOriginBus } from '../src/world/globe/originBus';
test('origin bus: a shift is velocity-neutral for a Verlet body (pos and prev translated in one tick)', () => {
  const run = (shift: boolean) => {
    const bus = createOriginBus(2000), b = { pos: [0, 10, 0], prev: [-30, 10, -.5] }, vel: number[][] = [], abs: number[][] = [];
    if (shift) bus.onOriginShift(o => { for (let k = 0; k < 3; k++) { b.pos[k] -= o[k]; b.prev[k] -= o[k]; } });
    for (let step = 0; step < 300; step++) {
      for (let k = 0; k < 3; k++) { const v = b.pos[k] - b.prev[k]; b.prev[k] = b.pos[k]; b.pos[k] += v + (k === 1 ? -9.81 / 3600 : 0); }
      if (shift) { bus.request(b.pos as [number, number, number]); bus.flush(); }
      vel.push(b.pos.map((v, k) => v - b.prev[k])); abs.push(bus.toAbsolute(b.pos as [number, number, number]));
    }
    return { vel, abs, shifts: bus.shifts, local: Math.hypot(...b.pos) };
  };
  const a = run(false), s = run(true);
  assert.ok(s.shifts >= 3, `shifted ${s.shifts} times`); assert.ok(s.local < 2100 && a.local > 8000);
  for (let i = 0; i < a.vel.length; i++) for (let k = 0; k < 3; k++) {
    assert.ok(Math.abs(a.vel[i][k] - s.vel[i][k]) < 1e-9, `velocity jump at step ${i}`);
    assert.ok(Math.abs(a.abs[i][k] - s.abs[i][k]) < 1e-6, `absolute position drift at step ${i}`);
  }
  const bus = createOriginBus(); let calls = 0; const off = bus.onOriginShift(() => calls++);
  bus.request([5000, 0, 0]); bus.request([5001, 0, 0]); bus.flush(); bus.flush(); off(); bus.request([9000, 0, 0]); bus.flush();
  assert.equal(calls, 1, 'one shift per tick, unsubscribe works'); assert.deepEqual(bus.origin, [14001, 0, 0]);
});
import { gameUrl, handoffTarget, HANDOFF } from '../src/world/globe/handoff';
test('globe → game handoff: only below the handoff altitude, fully inside home, not while climbing; URL keeps game keys', () => {
  const inside = { home: 1, x: 120.04, z: -340 };
  assert.deepEqual(handoffTarget(inside, HANDOFF.alt - 1, false), { x: 120, z: -340 });
  assert.equal(handoffTarget(inside, HANDOFF.alt + 1, false), null);
  assert.equal(handoffTarget(inside, 500, true), null);
  assert.equal(handoffTarget({ home: .8, x: 0, z: 0 }, 500, false), null);
  assert.equal(handoffTarget({ home: 1, x: PLANET.home.halfSize - 10, z: 0 }, 500, false), null);
  assert.equal(gameUrl('?view=globe&stages=1&alt=900&seed=3', { x: 1, z: -2.5 }), '?stages=1&seed=3&at=1%2C-2.5');
  assert.equal(gameUrl('?view=globe', null), '?');
  // the game's ?at= parser (main.ts) splits on ',' after URL decoding
  assert.deepEqual(new URLSearchParams(gameUrl('?view=globe', { x: 1, z: -2.5 })).get('at')!.split(',').map(Number), [1, -2.5]);
});
import { globePlanet } from '../src/world/globe/home';
import { surfaceAt } from '../src/core/stages/surfaceAt';
test('globe home (staged): surfaceAt heights = the game heightAt, and the staged globe planet carries them exactly', () => {
  const was = STAGES.on; STAGES.on = true;
  try {
    const p = globePlanet(STAGES.seed, true, STAGES.seed); let worst = 0, lakes = 0;
    for (let k = 0; k < 600; k++) {
      const x = (k * 37.3) % 4800 - 2400, z = (k * 91.9) % 4800 - 2400, s = surfaceAt(x, z, STAGES.seed);
      assert.equal(s.height, heightAt(x, z));
      const g = p.sampleSurface(p.fromLocal(x, z)); worst = Math.max(worst, Math.abs(g.h - (PLANET.home.elevation + s.height)));
      if (g.kind === 'lake') { lakes++; assert.ok(s.lake || s.river, 'globe water only where the game has water'); }
    }
    assert.ok(worst < 0.05, `planet vs game height ${worst} m (gnomonic round trip)`); assert.ok(lakes > 0, 'lakes reach the globe');
  } finally { STAGES.on = was; }
});
test('globe far field: land outside the playable region keeps Kenora-scale relief (no flat band at the horizon)', () => {
  const p = createPlanet(1400, heightAt); let spread = 0, n = 0;
  for (let k = 0; k < 120 && n < 12; k++) { // patches 50-500 km from home along the east axis
    const x0 = 50e3 + k * 11e3, hs: number[] = [];
    for (let i = 0; i < 25; i++) { const s = p.sampleSurface(p.fromLocal(x0 + (i % 5) * 700, (Math.floor(i / 5)) * 700)); const top = Math.max(s.h, s.water); if (top > 20) hs.push(top); } // the visible surface (lakes included)
    if (hs.length === 25) { spread += Math.max(...hs) - Math.min(...hs); n++; }
  }
  assert.ok(n >= 3 && spread / n > 25, `mean local relief over 2.8 km patches ${n ? (spread / n).toFixed(1) : '-'} m`);
});

import { stitchIndex } from '../src/world/globe/tile';
test('globe stitching: flags 0 is buildTile\'s own triangulation; flagged edges never use an odd edge vertex (no T-junctions)', () => {
  const p = createPlanet(1400, heightAt), seg = 16, n = seg + 1, t = finish(buildTile(node(4, 6, 20, 30), p, seg));
  assert.deepEqual(Array.from(stitchIndex(seg, 0).array), Array.from(t.index));
  for (const flags of [1, 2, 4, 8, 5, 15]) {
    const ix = stitchIndex(seg, flags).array; let live = 0;
    const odd = (v: number) => { if (v >= n * n) { const e = Math.floor((v - n * n) / n), k = (v - n * n) % n; return !!(flags & (1 << e)) && (k & 1) === 1; }
      const i = v % n, j = Math.floor(v / n); return ((j === 0 && flags & 1) || (j === n - 1 && flags & 2)) && (i & 1) === 1 || ((i === 0 && flags & 4) || (i === n - 1 && flags & 8)) && (j & 1) === 1; };
    for (let k = 0; k < ix.length; k += 3) { const a = ix[k], b = ix[k + 1], c = ix[k + 2]; if (a === b || b === c || a === c) continue; live++; assert.ok(!odd(a) && !odd(b) && !odd(c), `flags ${flags}: tri uses a collapsed vertex`); }
    assert.ok(live > seg * seg * 2 - 8 * seg, `flags ${flags}: grid still covered (${live} live tris)`);
  }
});

import { fromLatLon } from '../src/world/globe/planet';
test('globe far-field lakes: Shield-like water share on boreal land, none near home (only the game\'s lakes there)', () => {
  const p = createPlanet(1400, () => 50), R = p.radius; let land = 0, lake = 0;
  for (let k = 0; k < 40000 && land < 3000; k++) { const lat = (44 + 18 * ((k * 0.618034) % 1)) * Math.PI / 180, lon = (k * 2.399963) % (2 * Math.PI) - Math.PI;
    const s = p.sampleSurface(fromLatLon(lat, lon)); if (s.kind === 'ocean' || s.level > 1400 || s.h > 1400) continue; land++; if (s.kind === 'lake') lake++; }
  const share = lake / land; assert.ok(land > 500 && share > .1 && share < .32, `lake share ${(share * 100).toFixed(1)} % of ${land}`);
  for (let k = 0; k < 400; k++) { const r = PLANET.home.halfSize * 1.4 * Math.sqrt(k / 400), a = k * 2.399963, d = p.fromLocal(r * Math.cos(a), r * Math.sin(a));
    assert.notEqual(p.sampleSurface(d).kind, 'lake', 'no far-field lake near home (the local sampler here is dry)'); }
  void R;
});

import { faceNeighbour } from '../src/world/globe/cube';
test('cube faces: every edge has one neighbour edge, symmetric, and the shared lattice points coincide (cross-face stitching)', () => {
  const ab = (e: number, t: number): [number, number] => e === 0 ? [t, -1] : e === 1 ? [t, 1] : e === 2 ? [-1, t] : [1, t];
  for (let f = 0; f < FACES.length; f++) for (let e = 0; e < 4; e++) {
    const nb = faceNeighbour(f, e), back = faceNeighbour(nb.face, nb.edge);
    assert.deepEqual([back.face, back.edge, back.flip], [f, e, nb.flip], `face ${f} edge ${e}`);
    for (let k = 0; k <= 16; k++) { const t = -1 + k / 8, p = faceDir(f, ...ab(e, t)), q = faceDir(nb.face, ...ab(nb.edge, nb.flip ? -t : t));
      assert.ok(Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]) < 1e-12, 'shared edge point'); }
  }
});
import { globeLod, worldTier } from '../src/world/globe/lod';
import { GOVERNOR } from '../src/core/quality';
test('globe LOD follows the governor\'s HELD world tier (681c7dd): a fresh step does not change tile rows', () => {
  const was = { auto: GOVERNOR.auto, tier: GOVERNOR.tier, worldTier: GOVERNOR.worldTier };
  try {
    Object.assign(GOVERNOR, { auto: true, tier: 3, worldTier: 0 });
    assert.equal(worldTier(), 0); assert.equal(globeLod().segments, GLOBE_LOD[0].segments, 'rows wait for the tier to hold');
    Object.assign(GOVERNOR, { worldTier: 3 }); assert.equal(globeLod().segments, GLOBE_LOD[3].segments, 'then follow');
    Object.assign(GOVERNOR, { auto: false, tier: 4, worldTier: 0 }); assert.equal(globeLod().segments, GLOBE_LOD[4].segments, 'manual tier: immediate');
  } finally { Object.assign(GOVERNOR, was); }
});

test('globe tiles: lake water (above sea level) gets the lake colour flag, sea water does not', () => {
  const p = createPlanet(1400, () => 50); let lakeV = 0, seaV = 0;
  for (const r of roots()) for (const k of children(r)) for (const n of children(k)) {
    if (lakeV > 40 && seaV > 40) break;
    const g = buildTile(n, p, 16); let x = g.next(); while (!x.done) x = g.next(); const t = x.value;
    for (let v = 0; v < 17 * 17; v++) { if (t.height[v] > -20) continue;
      const X = t.position[v * 3] + t.centre[0], Y = t.position[v * 3 + 1] + t.centre[1], Z = t.position[v * 3 + 2] + t.centre[2], l = Math.hypot(X, Y, Z);
      const s = p.sampleSurface([X / l, Y / l, Z / l]);
      if (s.kind === 'lake') { lakeV++; assert.equal(t.lake[v], 255, 'lake vertex'); } else if (s.kind === 'ocean') { seaV++; assert.equal(t.lake[v], 0, 'sea vertex'); } }
  }
  assert.ok(lakeV > 0 && seaV > 0, `lake ${lakeV} sea ${seaV}`);
});

import { across } from '../src/world/globe/cube';
test('cube nodes: the node across each edge shares that whole edge, also across cube-face edges and at face corners (stitching)', () => {
  const corners = (f: number, l: number, i: number, j: number) => { const s = 2 / (1 << l), a = -1 + i * s, b = -1 + j * s; return [[a, b], [a + s, b], [a, b + s], [a + s, b + s]].map(([x, y]) => faceDir(f, x, y)); };
  const ends = [[0, 1], [2, 3], [0, 2], [1, 3]]; // corner indices of edges south, north, west, east
  const near = (p: number[], q: number[]) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]) < 1e-12;
  let crossings = 0;
  for (const l of [1, 3]) for (let f = 0; f < 6; f++) for (let i = 0; i < 1 << l; i++) for (let j = 0; j < 1 << l; j++) for (let e = 0; e < 4; e++) {
    const n = node(f, l, i, j), a = across(n, e), mine = corners(f, l, i, j), theirs = corners(a.face, l, a.i, a.j);
    if (a.face !== f) crossings++;
    assert.ok(!(a.face === f && a.i === i && a.j === j), 'a different node');
    for (const c of ends[e]) assert.ok(theirs.some(t => near(t, mine[c])), `edge ${e} of ${n.key} shared by ${a.face}/${l}/${a.i}/${a.j}`);
  }
  assert.equal(crossings, 6 * 4 * 2 + 6 * 4 * 8, 'every face-edge node crosses');
});

import { wantsSplit } from '../src/world/globe/cube';
import { balancedTree } from '../src/world/globe/lod';
test('globe LOD: the selected tiles are 2:1 balanced - no tile has a neighbour 2+ levels apart, also across cube faces (stitching handles one)', () => {
  const R = 6371000, d = (x: number, y: number, z: number, alt: number) => { const l = Math.hypot(x, y, z); return [x / l * (R + alt), y / l * (R + alt), z / l * (R + alt)] as [number, number, number]; };
  const cams = [d(.27, .76, .59, 14e6), d(.27, .76, .59, 9e5), d(.4, .3, .87, 4e4), d(.27, .76, .59, 300), d(-1, 1, -1, 2.5e5), d(-1, 1, -1, 300), d(1, 1e-3, 1, 50)];
  for (const row of GLOBE_LOD) for (const cam of cams) {
    const o = { radius: R, minLevel: row.minLevel, maxLevel: row.maxLevel, split: row.split }, leaves = [...balancedTree(roots(), n => wantsSplit(n, cam, o)).leaves.values()], at = new Set(leaves.map(n => n.key));
    assert.ok(leaves.length >= selectLeaves(cam, o).length, 'balancing only adds tiles');
    for (const n of leaves) for (let e = 0; e < 4; e++) { const a = across(n, e);
      for (let l = n.level; l >= 0; l--) if (at.has(`${a.face}/${l}/${a.i >> (n.level - l)}/${a.j >> (n.level - l)}`)) { assert.ok(n.level - l <= 1, `${row.name}: ${n.key} edge ${e} is ${n.level - l} levels finer than its neighbour`); break; } }
  }
});

import { createAtmosphere } from '../src/world/globe/atmosphere';
import { GLSL_NOISE } from '../src/proc/glsl';
test('globe clouds: cloud noise uses the integer lattice hash (vnoiseU), not the fract(sin) hash that left dotted seams on lattice planes', () => {
  const frag = (createAtmosphere(6371000).dome.material as unknown as { fragmentShader: string }).fragmentShader;
  const slice = frag.slice(frag.indexOf('float cloudSlice3'), frag.indexOf('float cloudDensity'));
  assert.ok(slice.includes('vnoiseU(') && !/\bvnoise\(|hash2s\(/.test(slice), 'cloud slices must sample vnoiseU');
  assert.ok(/float hash2u\(vec2 c, float s\) \{ uvec2 q = uvec2\(ivec2\(c\)\)/.test(GLSL_NOISE) && !/sin\(/.test(GLSL_NOISE.slice(GLSL_NOISE.indexOf('float hash2u'), GLSL_NOISE.indexOf('float fbm'))), 'hash2u: integer ops only');
});

import * as THREE_E from 'three';
import { globeMaterial } from '../src/world/globe/tile';
test('globe material: varyings used by the atmosphere and log depth are centroid-sampled (MSAA skirt slivers at tile borders shaded outside their triangle gave black samples)', () => {
  const m = globeMaterial(); createAtmosphere(6371000).patch(m);
  const sh = { uniforms: {}, vertexShader: THREE_E.ShaderLib.standard.vertexShader, fragmentShader: THREE_E.ShaderLib.standard.fragmentShader } as unknown as THREE_E.WebGLProgramParametersWithUniforms;
  m.onBeforeCompile(sh, undefined as unknown as THREE_E.WebGLRenderer);
  for (const src of [sh.vertexShader, sh.fragmentShader]) {
    assert.ok(src.includes('centroid varying vec3 vViewPosition;') && !src.split('centroid varying vec3 vViewPosition;').join('').includes('varying vec3 vViewPosition;'), 'vViewPosition centroid');
    assert.ok(src.includes('centroid varying float vFragDepth;') && !src.includes('#include <logdepthbuf_pars'), 'log depth varyings centroid');
  }
  assert.ok(sh.fragmentShader.includes('uniform float logDepthBufFC;'));
});

import { globeUrl, GLOBE_ENTRY_ALT } from '../src/world/globe/handoff';
test('game <-> globe round trip URLs: game keys survive, spot and heading go up (globeUrl) and come back (gameUrl at=x,z,yaw)', () => {
  const up = new URLSearchParams(globeUrl('?nomenu&hour=9&at=1,2', 12.34, -56.78, 1.23456));
  assert.equal(up.get('view'), 'globe'); assert.equal(up.get('at'), '12.3,-56.8,1.235'); assert.equal(Number(up.get('alt')), GLOBE_ENTRY_ALT);
  assert.ok(up.has('nomenu') && up.get('hour') === '9' && GLOBE_ENTRY_ALT > HANDOFF.alt);
  const down = new URLSearchParams(gameUrl(`?${up}&look=30&pitch=40`, { x: 12.3, z: -56.8, yaw: 1.235 }));
  assert.equal(down.get('at'), '12.3,-56.8,1.235'); assert.ok(down.has('nomenu') && down.get('hour') === '9');
  for (const k of ['view', 'alt', 'look', 'pitch']) assert.ok(!down.has(k), k);
  assert.equal(new URLSearchParams(gameUrl('?view=globe', { x: 1, z: 2 })).get('at'), '1,2'); // no heading known: x, z only
});

import { CLOUDS, ATMOS_STEPS } from '../src/world/globe/atmosphere';
test('globe clouds: edge contrast and detail follow the governor tier (uniforms only, no recompile); finer tiers never softer', () => {
  const rows = ATMOS_STEPS.length;
  for (const t of [CLOUDS.octaves, CLOUDS.edgeHalf, CLOUDS.edgeCentre]) assert.equal(t.length, rows);
  for (let i = 1; i < rows; i++) { assert.ok(CLOUDS.octaves[i] <= CLOUDS.octaves[i - 1]); assert.ok(CLOUDS.edgeHalf[i] >= CLOUDS.edgeHalf[i - 1]); }
  const atm = createAtmosphere(6371000, 0), u = atm.uniforms;
  const frag = (atm.dome.material as unknown as { fragmentShader: string }).fragmentShader;
  assert.equal(u.uCloudOct.value, CLOUDS.octaves[0]); assert.equal(u.uCloudEdge.value.x, CLOUDS.edgeCentre[0]); assert.equal(u.uCloudEdge.value.y, CLOUDS.edgeHalf[0]);
  atm.setTier(2); assert.equal(u.uCloudOct.value, CLOUDS.octaves[2]); assert.equal(u.uCloudEdge.value.y, CLOUDS.edgeHalf[2]);
  assert.equal((atm.dome.material as unknown as { fragmentShader: string }).fragmentShader, frag, 'tier change: same shader');
  assert.ok(frag.includes('smoothstep(c - hw, c + hw') && frag.includes(`a *= ${CLOUDS.persistence.toFixed(3)}`) && frag.includes('octD'), 'threshold + distance octave fade in the shader');
});

import { landSpawn } from '../src/world/globe/handoff';
import { surfaceAt as surfaceAtH } from '../src/core/stages/surfaceAt';
test('globe -> game: the arrival spot moves out of a lake to the nearest dry land (dryStart), dry spots stay', () => {
  let wet: { x: number; z: number } | null = null;
  for (let x = -2000; x <= 2000 && !wet; x += 40) for (let z = -2000; z <= 2000 && !wet; z += 40) if (surfaceAtH(x, z).lake) wet = { x, z };
  assert.ok(wet, 'a lake near home');
  const s = landSpawn(wet!, true), p = surfaceAtH(s.x, s.z);
  assert.ok(!p.lake && !p.river && Math.hypot(s.x - wet!.x, s.z - wet!.z) <= 900, `landed at ${s.x},${s.z}`);
  assert.deepEqual(landSpawn(s, true), s); assert.deepEqual(landSpawn(wet!, false), wet);
});

import { globeOwnership } from '../src/world/globe/globeView';
import { LOG_DEPTH, LOG_DEPTH_PREFIX, logDepthFC, setLogDepthFar, withLogDepth } from '../src/world/globe/logDepth';
import { createFarLayer } from '../src/world/globe/farLayer';
import { readFileSync as readSrcS1 } from 'node:fs';
test('globe ownership is explicit: standalone owns page + renderer; shared borrows the renderer (no resize, dispose, context loss, clock, governor, auto handoff)', () => {
  assert.deepEqual(globeOwnership({ shared: false }), { disposeRenderer: true, resize: true, pageDom: true, loadClock: true, governor: true, autoHandoff: true, inputAtStart: true });
  assert.deepEqual(globeOwnership({ shared: true }), { disposeRenderer: false, resize: false, pageDom: false, loadClock: false, governor: false, autoHandoff: false, inputAtStart: false });
  assert.equal(globeOwnership({ shared: true, ownsRenderer: true }).disposeRenderer, true); assert.equal(globeOwnership({ shared: false, ownsRenderer: false }).disposeRenderer, false);
  const src = readSrcS1(new URL('../src/world/globe/globeView.ts', import.meta.url), 'utf8');
  for (const call of ['renderer.dispose()', 'renderer.forceContextLoss()', 'renderer.setSize(', 'renderer.setPixelRatio(']) for (const line of src.split('\n').filter(l => l.includes(call)))
    assert.ok(/own\.(disposeRenderer|resize)/.test(line) && !line.includes('function startGlobe'), `guarded: ${line.trim().slice(0, 80)}`);
  assert.ok(!/logarithmicDepthBuffer:\s*true/.test(src), 'no renderer-wide log depth flag');
  assert.ok(!/(^|[^.\w])addEventListener\(/m.test(src.replace(/t\.addEventListener/g, '')), 'every listener goes through listen() so dispose() removes it');
});
test('globe log depth is per material: three chunks switched on by the material, constant from our own uniform (2 / log2(far + 1))', () => {
  assert.ok(Math.abs(logDepthFC(1e6) - 2 / (Math.log(1e6 + 1) / Math.LN2)) < 1e-15);
  setLogDepthFar(12345); assert.equal(LOG_DEPTH.uniform.value, logDepthFC(12345));
  const sh = { vertexShader: 'void main(){}', fragmentShader: 'void main(){}', uniforms: {} as Record<string, unknown> }; withLogDepth(sh); withLogDepth(sh);
  assert.ok(sh.vertexShader.startsWith(LOG_DEPTH_PREFIX) && sh.vertexShader.split('#define logDepthBufFC').length === 2, 'once');
  assert.ok(LOG_DEPTH_PREFIX.includes('#ifndef USE_LOGARITHMIC_DEPTH_BUFFER') && sh.uniforms.uGlobeLogDepthFC === LOG_DEPTH.uniform);
  const m = globeMaterial(); createAtmosphere(6371000).patch(m);
  const s2 = { uniforms: {}, vertexShader: THREE_E.ShaderLib.standard.vertexShader, fragmentShader: THREE_E.ShaderLib.standard.fragmentShader } as unknown as THREE_E.WebGLProgramParametersWithUniforms;
  m.onBeforeCompile(s2, undefined as unknown as THREE_E.WebGLRenderer);
  assert.ok(s2.vertexShader.startsWith(LOG_DEPTH_PREFIX) && s2.fragmentShader.startsWith(LOG_DEPTH_PREFIX) && s2.uniforms.uGlobeLogDepthFC === LOG_DEPTH.uniform, 'tiles');
  const dome = createAtmosphere(6371000).dome.material as THREE_E.ShaderMaterial;
  assert.ok(dome.vertexShader.startsWith(LOG_DEPTH_PREFIX) && dome.fragmentShader.startsWith(LOG_DEPTH_PREFIX) && dome.uniforms.uGlobeLogDepthFC === LOG_DEPTH.uniform, 'sky shell');
});
test('far layer: linear half-float MSAA target that follows the drawing buffer (scaled), byte count for the budget', () => {
  const d = createFarLayer(); d.resize(2400, 1350); assert.deepEqual([d.target.width, d.target.height, d.target.samples, d.bytes()], [1200, 675, 2, 1200 * 675 * 36]); d.dispose(); // + the resolved depth texture (4 B/px)
  const f = createFarLayer({ scale: .5, samples: 4 }); f.resize(2400, 1350);
  assert.deepEqual([f.target.width, f.target.height, f.target.samples], [1200, 675, 4]);
  assert.equal(f.texture.colorSpace, THREE_E.LinearSRGBColorSpace); assert.equal(f.target.texture.type, THREE_E.HalfFloatType);
  assert.equal(f.bytes(), 1200 * 675 * (8 + 4 + 4 * 12)); f.dispose();
});

import { TRANSITION, createGovernorHold, gameBasis, gameToPlanet, globeCameraFrom, inputOwner, nextMode, patchFade, planetToGame, simRuns, transitionPath } from '../src/world/globe/transition';
test('transition: game <-> planet frame round trip with one constant datum; globe surface = game height + datum in the home region', () => {
  const p = globePlanet(1400, true, 1400);
  for (const [x, y, z] of [[0, 0, 0], [72, -1.6, 186], [-3000, 12.5, 4200]]) {
    const v = gameToPlanet(p, x, y, z), g = planetToGame(p, v);
    assert.ok(Math.abs(g.x - x) < 1e-6 && Math.abs(g.y - y) < 1e-6 && Math.abs(g.z - z) < 1e-6, `${x},${z}`);
  }
  for (const [x, z] of [[132, 186], [-500, 300], [900, -1200]]) {
    const s = p.sampleSurface(p.fromLocal(x, z)), gh = surfaceAt(x, z, 1400).height;
    assert.ok(s.home >= 1 && Math.abs(s.h - (gh + TRANSITION.datum)) < 1e-6, `datum at ${x},${z}: ${s.h} vs ${gh}`);
  }
});
test('transition: game basis is orthonormal, up = local vertical, game -z = north; globe camera = game camera mapped', () => {
  const p = globePlanet(1400, true, 1400), m = gameBasis(p, 500, -800), up = new THREE_E.Vector3(0, 1, 0).applyMatrix4(m), N = new THREE_E.Vector3(...p.north);
  assert.ok(up.distanceTo(new THREE_E.Vector3(...p.fromLocal(500, -800))) < 1e-9 && Math.abs(m.determinant() - 1) < 1e-9);
  const fwd = new THREE_E.Vector3(0, 0, -1).applyMatrix4(m); assert.ok(fwd.dot(N) > .9999 && Math.abs(fwd.dot(up)) < 1e-9, 'game -z is north');
  const cam = new THREE_E.PerspectiveCamera(); cam.position.set(72, 300, 186); cam.rotation.set(-.3, .8, 0, 'YXZ'); cam.updateMatrixWorld();
  const out = globeCameraFrom(p, cam, { position: new THREE_E.Vector3(), quaternion: new THREE_E.Quaternion() });
  const g = planetToGame(p, [out.position.x, out.position.y, out.position.z]); assert.ok(Math.abs(g.y - 300) < 1e-6);
  const dGame = new THREE_E.Vector3(0, 0, -1).applyQuaternion(cam.quaternion), dPlanet = new THREE_E.Vector3(0, 0, -1).applyQuaternion(out.quaternion);
  assert.ok(dPlanet.distanceTo(dGame.applyMatrix4(gameBasis(p, 72, 186))) < 1e-9, 'view direction maps through the basis');
});
test('transition: flag + fallback, fade gated on chunks, mode machine, input scope, governor hold', () => {
  assert.equal(transitionPath(''), 'inpage'); assert.equal(transitionPath('?transition=reload'), 'reload'); assert.equal(transitionPath('', {}, 'reload'), 'reload'); assert.equal(transitionPath('', { deviceMemory: 4 }), 'reload'); assert.equal(transitionPath('', { probeCap: 3 }), 'reload'); assert.equal(transitionPath('?transition=inpage'), 'inpage');
  assert.equal(transitionPath('?transition=reload', {}, 'inpage'), 'reload'); assert.equal(transitionPath('?transition=inpage', { deviceMemory: 4 }), 'reload'); assert.equal(transitionPath('?transition=inpage', { probeCap: 3 }), 'reload');
  assert.equal(patchFade(100, false), 0); assert.equal(patchFade(2500, true), 0); assert.equal(patchFade(TRANSITION.fadeFull, true), 1); assert.ok(patchFade(1300, true) > 0 && patchFade(1300, true) < 1);
  const base = { height: 1500, overHome: true, descending: true, chunksReady: false };
  assert.equal(nextMode({ ...base, mode: 'globe' }), 'band'); assert.equal(nextMode({ ...base, mode: 'globe', overHome: false }), 'globe');
  assert.equal(nextMode({ ...base, mode: 'band', height: 40 }), 'band', 'no handover before the chunks are ready'); assert.equal(nextMode({ ...base, mode: 'band', height: 40, chunksReady: true }), 'game');
  assert.equal(nextMode({ ...base, mode: 'band', descending: false, height: 2100 }), 'globe'); assert.equal(nextMode({ ...base, mode: 'game', ascend: true }), 'band'); assert.equal(nextMode({ ...base, mode: 'game' }), 'game');
  assert.deepEqual([inputOwner('game', false), inputOwner('globe', false), inputOwner('band', true), inputOwner('band', false)], ['game', 'globe', 'globe', 'none']);
  assert.ok(simRuns('game') && !simRuns('band') && !simRuns('globe'));
  const g = { auto: true, worldTier: -1, tier: 2, cool: 0, cooldownMs: 10000 }; let resets = 0; const h = createGovernorHold(g, () => { resets++; });
  h.hold(); h.hold(); assert.deepEqual([g.auto, g.worldTier, h.held], [false, 2, true]);
  h.release(); h.release(); assert.deepEqual([g.auto, g.cool, resets, h.held], [true, 10000, 1, false]);
});
test('patch fade (render/fade): uniform only, cache key unchanged, default-key materials skipped, unset uniforms = no fade', async () => {
  const THREE = await import('three'), { PATCH_FADE, setPatchFade, addPatchFade, fadeOptIn } = await import('../src/render/fade');
  const m = new THREE.MeshStandardMaterial(); m.customProgramCacheKey = () => 'boreal-test'; let theirs = 0; m.onBeforeCompile = () => { theirs++; };
  const keyBefore = m.customProgramCacheKey(); fadeOptIn(m); fadeOptIn(m);
  assert.equal(m.customProgramCacheKey(), keyBefore, 'same program cache key');
  const sh = { uniforms: {} as Record<string, { value: unknown }>, vertexShader: THREE.ShaderLib.standard.vertexShader, fragmentShader: THREE.ShaderLib.standard.fragmentShader, defines: {} };
  m.onBeforeCompile(sh as never, {} as never);
  assert.equal(theirs, 1, 'the material\'s own hook still runs (once)'); assert.equal(m.userData.patchFade, true);
  assert.ok(sh.vertexShader.includes('vPatchXZ = (modelMatrix * pw).xz') && sh.vertexShader.includes('batchingMatrix * pw'), 'world xz incl. batching');
  assert.ok(sh.fragmentShader.includes('uniform float uPatchCut') && sh.fragmentShader.includes('discard'), 'dither in the fragment');
  const defs = (s: string) => s.split('#define').length; assert.equal(defs(sh.fragmentShader), defs(THREE.ShaderLib.standard.fragmentShader), 'no define (frag)');
  assert.equal(defs(sh.vertexShader), defs(THREE.ShaderLib.standard.vertexShader), 'no define (vert)'); assert.deepEqual(sh.defines, {}, 'no material defines');
  assert.equal(sh.uniforms.uPatchCut, PATCH_FADE.uPatchCut, 'shared uniform objects');
  addPatchFade(sh); assert.equal(sh.fragmentShader.split('uniform float uPatchCut').length, 2, 'idempotent');
  const plain = new THREE.MeshStandardMaterial(), hook = plain.onBeforeCompile, key = plain.customProgramCacheKey(); fadeOptIn(plain);
  assert.equal(plain.onBeforeCompile, hook); assert.equal(plain.customProgramCacheKey(), key, 'default-key material untouched');
  assert.equal(PATCH_FADE.uPatchCut.value, 0, 'default: patch fully drawn');
  setPatchFade(.25, { x: 3, z: 4, r: 180 }); assert.ok(Math.abs(PATCH_FADE.uPatchCut.value - .75) < 1e-9); assert.deepEqual(PATCH_FADE.uPatchDisc.value.toArray(), [3, 4, 180]);
  setPatchFade(1); assert.equal(PATCH_FADE.uPatchCut.value, 0); assert.equal(PATCH_FADE.uPatchDisc.value.z, 0, 'no disc = no fade at all');
});
test('in-page band pose: the band start reproduces the globe camera (game <-> planet frame round trip)', async () => {
  const THREE = await import('three'), { gameToPlanet, planetToGame, gameBasis, globeCameraFrom } = await import('../src/world/globe/transition');
  const p = createPlanet(1400, heightAt), gq = new THREE.Quaternion().setFromEuler(new THREE.Euler(.3, 1.1, -.2));
  const v = gameToPlanet(p, 120, 1900, -340), g = planetToGame(p, v);
  const q = new THREE.Quaternion().setFromRotationMatrix(gameBasis(p, g.x, g.z)).invert().multiply(gq); // inpage.ts descend()
  const out = globeCameraFrom(p, { position: new THREE.Vector3(g.x, g.y, g.z), quaternion: q }, { position: new THREE.Vector3(), quaternion: new THREE.Quaternion() });
  assert.ok(out.position.distanceTo(new THREE.Vector3(...v)) < 1e-3, 'position'); assert.ok(out.quaternion.angleTo(gq) < 1e-6, 'orientation');
});

test('patch fade: world props (default-key materials) opt in through render/batch with one stable extra program key', async () => {
  const THREE = await import('three'), { fadeOptIn, PATCH_FADE } = await import('../src/render/fade');
  const plain = new THREE.MeshStandardMaterial(), key = plain.customProgramCacheKey(), hook = plain.onBeforeCompile;
  fadeOptIn(plain, true); fadeOptIn(plain, true);
  assert.notEqual(plain.onBeforeCompile, hook);
  assert.notEqual(plain.customProgramCacheKey(), key, 'never shares a program with an unwired twin (which would compile without the fade)');
  assert.equal(plain.customProgramCacheKey(), key + '|patchFade');
  const twin = new THREE.MeshStandardMaterial({ color: 0x334455 }); fadeOptIn(twin, true);
  assert.equal(twin.customProgramCacheKey(), plain.customProgramCacheKey(), 'constant key: one extra program, not one per material');
  const shader = { uniforms: {} as Record<string, unknown>, vertexShader: '#include <project_vertex>', fragmentShader: '#include <dithering_fragment>' };
  plain.onBeforeCompile(shader as never, undefined as never);
  assert.equal(shader.uniforms.uPatchCut, PATCH_FADE.uPatchCut); assert.ok(shader.fragmentShader.includes('uPatchCut'));
  assert.equal(plain.userData.patchFade, true);
  // a CSM-style chain on top (render/photoreal) leaves the key alone (as for trees; CSM varies the program by its defines)
  const k0 = twin.customProgramCacheKey(), prev = twin.onBeforeCompile; twin.onBeforeCompile = function (s, r) { prev.call(this, s, r); };
  assert.equal(twin.customProgramCacheKey(), k0);
});