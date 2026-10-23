import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MathUtils } from 'three';
import { GLOBE_COAST, coastLambda } from '../src/world/globe/transition';

// T-0043: the release coast is three's frame-rate-independent MathUtils.damp (https://threejs.org/docs/#api/en/math/MathUtils.damp)
// configured by GLOBE_COAST; these tests run that exact call the way globeView does (speed damped to 0, distance by the trapezoid).
function coast(fps: number) {
  const dt = 1 / fps; let v = 1, t = 0, d = 0; const at: Record<number, number> = {};
  while (t < GLOBE_COAST.sec - 1e-9) { const v0 = v; v = MathUtils.damp(v, 0, coastLambda, dt); d += (v0 + v) / 2 * dt; t += dt;
    for (const s of [1, 2, 3]) if (Math.abs(t - s) < dt / 2) at[s] = v; }
  return { d, t, at };
}

test('globe coast: 3 s, 2 % of the release speed at 3 s', () => {
  assert.equal(GLOBE_COAST.sec, 3); assert.equal(GLOBE_COAST.rest, .02);
  assert.ok(Math.abs(coastLambda - Math.log(50) / 3) < 1e-12);
  const r = coast(60);
  assert.ok(Math.abs(r.at[3] - .02) < 1e-6, `speed at 3 s ${r.at[3]}`);
  assert.ok(r.at[1] > .25 && r.at[2] > .07, `still visibly rolling at 1 s (${r.at[1]}) and 2 s (${r.at[2]})`);
});

test('globe coast: same speed at 1, 2, 3 s and same distance at 60, 144 and 240 fps', () => {
  const [a, ...rest] = [60, 144, 240].map(coast);
  for (const b of rest) {
    for (const s of [1, 2, 3]) assert.ok(Math.abs(a.at[s] - b.at[s]) < 1e-9, `speed at ${s} s: ${a.at[s]} vs ${b.at[s]}`);
    assert.ok(Math.abs(a.d - b.d) / a.d < 1e-3, `distance ${a.d} vs ${b.d}`);
  }
  const exact = (1 - GLOBE_COAST.rest) / coastLambda; // continuous: integral of e^(-lambda t) to 3 s
  assert.ok(Math.abs(a.d - exact) / exact < 2e-3, `distance ${a.d} vs ${exact}`);
});

test('globe coast: drag-rate tracking forgets a hold (no coast after holding still before letting go)', () => {
  const dt = 1 / 60; let v = 0;
  for (let i = 0; i < 30; i++) v = MathUtils.damp(v, 1, 1 / GLOBE_COAST.track, dt);
  assert.ok(v > .99, `tracks the drag within 0.5 s (${v})`);
  for (let i = 0; i < 30; i++) v = MathUtils.damp(v, 0, 1 / GLOBE_COAST.track, dt);
  assert.ok(v < 1e-3, `held still 0.5 s leaves ${v}`);
});

test('globe coast: globeView wiring (OrbitControls damping off, MathUtils.damp, every stop)', () => {
  const src = readFileSync('src/world/globe/globeView.ts', 'utf8');
  assert.match(src, /controls\.enableDamping = false/);
  assert.doesNotMatch(src, /dampingFactor/);
  assert.match(src, /MathUtils\.damp\([^\n]*1 \/ GLOBE_COAST\.track/, 'drag rate damp-smoothed');
  assert.match(src, /MathUtils\.damp\([^\n]*coastLambda/, 'coast via MathUtils.damp');
  assert.match(src, /getAzimuthalAngle\(\)[^\n]*getPolarAngle\(\)/, "OrbitControls' own angles");
  assert.match(src, /\/ rs/, 'per unit rotateSpeed');
  assert.match(src, /controls\.addEventListener\('start'[^\n]*stopCoast\(\)/, 'a new grab');
  assert.match(src, /controls\.addEventListener\('end'/, 'release starts the coast');
  assert.match(src, /'pointerdown'[^\n]*stopCoast\(\)/, 'any click on the globe');
  assert.match(src, /'H'\) \{ flyHome = 1; stopCoast\(\)/, 'H (fly home)');
  assert.match(src, /if \(ext \|\| leaving\) stopCoast\(\)/, 'in-page descent flies the camera / auto handoff');
  assert.match(src, /leaving = true; stopCoast\(\)/, 'standalone auto handoff');
  assert.match(src, /attachInput\(on: boolean\)[^\n]*stopCoast\(\)/, 'detached input');
  assert.match(src, /get coasting\(\)/, 'dev getter');
  assert.match(src, /coastT >= GLOBE_COAST\.sec\) stopCoast\(\)/, 'the coast ends at 3 s');
});
