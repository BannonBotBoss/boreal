import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CLOUD_OPEN, cloudClear } from '../src/world/globe/transition';
import { LANDING_VIEW, landSpawn, viewBlocked } from '../src/world/globe/handoff';
import { solidsAround, treesAround } from '../src/core/ground';
import { isDry } from '../src/core/stages/surfaceAt';
import { STAGES } from '../src/core/stages/elevation';

// T-0041 (1): the cloud deck fades out over log altitude; no per-frame jump on the fastest recorded descent.
test('descent polish: cloud cover fades smoothly over log altitude (no switch between 600 and 200 km)', () => {
  assert.equal(cloudClear(14e6), 0); assert.equal(cloudClear(CLOUD_OPEN.top), 0); assert.equal(cloudClear(CLOUD_OPEN.bottom), 1);
  // fastest descent rate through 600-200 km in the recorded descent (refs/T-0034/descent-frames.json): ln-altitude per second
  const f = JSON.parse(readFileSync('refs/T-0034/descent-frames.json', 'utf8')) as { t: number; alt: number }[];
  let rate = 0; for (let i = 1; i < f.length; i++) { const a = f[i - 1], b = f[i];
    if (a.alt <= 7e5 && b.alt >= 1.5e5 && b.alt < a.alt) rate = Math.max(rate, Math.log(a.alt / b.alt) / (b.t - a.t)); }
  assert.ok(rate > .5, `a descent through 600-200 km is in the recording (rate ${rate})`);
  for (const [fps, lim] of [[60, .02], [30, .04]]) { const step = rate / fps; // ln altitude per rendered frame
    let max = 0; for (let a = 6e5; a > 2e5; a *= Math.exp(-step)) max = Math.max(max, Math.abs(cloudClear(a * Math.exp(-step)) - cloudClear(a)));
    assert.ok(max <= lim, `cover change per ${fps} fps frame ${max.toFixed(4)} <= ${lim}`); }
  let prev = 0; for (let a = CLOUD_OPEN.top; a > CLOUD_OPEN.bottom; a *= .99) { const c = cloudClear(a); assert.ok(c >= prev, `monotone at ${a}`); prev = c; }
  // the shader fades the cover (alpha) and the shadows; it no longer raises the coverage threshold (the T-0034 switch)
  const src = readFileSync('src/world/globe/atmosphere.ts', 'utf8');
  assert.ok(!src.includes('mix(uCloudEdge.x, 1.1, uCloudClear)'), 'no threshold switch');
  assert.ok(src.includes('a * 0.9 * (1.0 - uCloudClear)'), 'cover alpha fades');
  assert.ok(src.includes('* (1.0 - uCloudClear) * cloudDensity('), 'shadows fade with it');
});

// T-0041 (2): the landing spot keeps the wolf in clear view of the follow camera (no tree, boulder or log between them).
test('descent polish: seeded landings leave no tree, boulder or log between the landing camera and the wolf', () => {
  STAGES.on = true;
  let rawBlocked = 0, rawSolid = 0, n = 0;
  for (let i = 0; i < 200; i++) {
    const at = { x: Math.round(600 * Math.cos(i * 2.39996)) + (i % 7) * 13, z: 1992 + Math.round(600 * Math.sin(i * 2.39996)) - (i % 5) * 11 };
    const yaw = (i * 1.7) % (2 * Math.PI);
    const raw = landSpawn(at, true), s = landSpawn(at, true, yaw); n++;
    if (viewBlocked(raw.x, raw.z, yaw, treesAround(raw.x, raw.z))) rawBlocked++;
    else if (viewBlocked(raw.x, raw.z, yaw, [], solidsAround(raw.x, raw.z))) rawSolid++;
    assert.ok(!viewBlocked(s.x, s.z, yaw, treesAround(s.x, s.z), solidsAround(s.x, s.z)), `landing ${i} (${s.x}, ${s.z}) yaw ${yaw.toFixed(2)} is clear`);
    assert.ok(isDry(s.x, s.z, STAGES.seed), `landing ${i} stays on dry land`);
    assert.ok(Math.hypot(s.x - raw.x, s.z - raw.z) <= LANDING_VIEW.maxShift + .1, `landing ${i} moves at most ${LANDING_VIEW.maxShift} m`);
  }
  console.log(`raw landing spots with a tree in the camera's view: ${rawBlocked}/${n}; with only a rock or log: ${rawSolid}/${n}`);
  assert.ok(rawSolid >= 3, `rocks/logs alone block some raw spots (${rawSolid}/${n})`);
  assert.ok(rawBlocked >= 2, `the check has something to catch (${rawBlocked}/${n} raw spots blocked)`);
});

test('descent polish: viewBlocked sees a trunk on the camera-wolf line and ignores one beside it or behind the wolf', () => {
  const back = LANDING_VIEW.back; // yaw 0: camera at +z behind the wolf at the origin
  assert.equal(viewBlocked(0, 0, 0, [{ x: 0, z: back / 2, r: 1.6 }]), true);
  assert.equal(viewBlocked(0, 0, 0, [{ x: 4, z: back / 2, r: 1.6 }]), false);
  assert.equal(viewBlocked(0, 0, 0, [{ x: 0, z: -4, r: 1.6 }]), false);
  assert.equal(viewBlocked(0, 0, 0, []), false);
});

test('descent polish: viewBlocked counts boulders and logs that reach the line, not pebbles, low or side ones', () => {
  const back = LANDING_VIEW.back, disc = (x: number, z: number, d: number) => ({ x, z, r: d / 2, top: .7 * d, hx: 0, hz: 0 });
  assert.equal(viewBlocked(0, 0, 0, [], [disc(0, back / 2, 1.65)]), true, 'erratic boulder mid-line');
  assert.equal(viewBlocked(0, 0, 0, [], [disc(0, .4, .95)]), true, 'small boulder right in front of the wolf');
  assert.equal(viewBlocked(0, 0, 0, [], [disc(0, 1.5, .95)]), false, 'small boulder further back: the line passes over it');
  assert.equal(viewBlocked(0, 0, 0, [], [disc(0, back / 2, .29)]), false, 'cobble under the line');
  assert.equal(viewBlocked(0, 0, 0, [], [disc(2.5, back / 2, 1.65)]), false, 'boulder beside the line');
  assert.equal(viewBlocked(0, 0, 0, [], [disc(0, -3, 3.6)]), false, 'outcrop behind the wolf');
  const log = (x: number, z: number, rot: number, s = 1) => ({ x, z, r: .43 * s, top: .85 * s, hx: Math.cos(rot) * 2.2 * s, hz: -Math.sin(rot) * 2.2 * s });
  assert.equal(viewBlocked(0, 0, 0, [], [log(1.5, .6, 0)]), true, 'log across the line just behind the wolf (its end reaches the line)');
  assert.equal(viewBlocked(0, 0, 0, [], [log(0, back * .8, 0, .75)]), false, 'small log across the line near the camera: under the line');
  assert.equal(viewBlocked(0, 0, 0, [], [log(1.6, 1.5, Math.PI / 2)]), false, 'log parallel to the line, beside it');
  // real placements: rocks and logs come from the same chunks the scene draws
  const s = solidsAround(600, -2066); assert.ok(s.length > 20 && s.some(e => e.hx !== 0 || e.hz !== 0) && s.some(e => e.hx === 0 && e.top > .6), `rocks and logs near home (${s.length})`);
});
