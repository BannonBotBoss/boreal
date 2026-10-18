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
      assert.ok(Math.abs(r - PLANET.radius) < 2, 'water vertices sit on the sea surface'); } }
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
    const s0 = p.sampleSurface(p.home), cam = p.home.map(v => v * (R + Math.max(s0.h, s0.water) + alt)) as [number, number, number];
    const off = renderOffset(t.centre, cam); let worst = 0, naive = 0;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const d = faceDir(q.face, -1 + 2 * (q.i * seg + i) / den, -1 + 2 * (q.j * seg + j) / den, cd), s = p.sampleSurface(d), r = R + Math.max(s.h, s.water);
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
