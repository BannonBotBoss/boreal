import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { INERTIA, coastSpeed, createCoast } from '../src/world/globe/inertia';

/** drag at `rate` rad/s for 0.5 s, let go, then run frames at `fps` until the coast ends; returns distance and stop time */
function run(fps: number, rate = 1) {
  const c = createCoast(), dt = 1 / fps;
  for (let i = 0; i < fps / 2; i++) c.track(rate * dt, -rate * dt / 2, dt);
  c.release(); let d = 0, time = 0, atOne = 0;
  for (let i = 0; i < fps * 5; i++) { const s = c.step(dt); if (!s) break; d += s[0]; time += dt; if (Math.abs(time - 1) < dt / 2) atOne = s[0] / dt; }
  return { d, time, atOne };
}

test('globe inertia: the coast lasts 3 s and comes to rest smoothly', () => {
  assert.equal(INERTIA.sec, 3);
  assert.equal(coastSpeed(0), 1); assert.equal(coastSpeed(3), 0); assert.equal(coastSpeed(4), 0);
  assert.ok(coastSpeed(1) > .4 && coastSpeed(2) > .1, 'still visibly rolling at 1 s and 2 s');
  assert.ok(coastSpeed(2.9) < .002, 'near rest just before 3 s');
});

test('globe inertia: same distance and same stop time at 60, 144 and 240 fps', () => {
  const r = [60, 144, 240].map(f => run(f));
  for (const x of r) {
    assert.ok(Math.abs(x.d - 1) < .01, `distance ${x.d} = release rate x 1 s (sec/3)`);
    assert.ok(Math.abs(x.time - 3) < 1 / 50, `stops at ${x.time} s`);
    assert.ok(Math.abs(x.atOne - 4 / 9) < .02, `speed at 1 s ${x.atOne}`);
  }
});

test('globe inertia: a new drag or click stops the coast at once; holding still before letting go leaves no coast', () => {
  const c = createCoast(), dt = 1 / 60;
  for (let i = 0; i < 30; i++) c.track(.02, 0, dt);
  c.release(); assert.ok(c.step(dt)); assert.ok(c.active);
  c.stop(); assert.equal(c.step(dt), null); assert.equal(c.active, false);
  for (let i = 0; i < 30; i++) c.track(.02, 0, dt);
  for (let i = 0; i < 30; i++) c.track(0, 0, dt); // held still for 0.5 s
  c.release(); const s = c.step(dt); assert.ok(!s || Math.abs(s[0]) < 1e-5);
});

test('globe inertia: globeView feeds the coast from OrbitControls and stops it on input, descent and detach', () => {
  const src = readFileSync('src/world/globe/globeView.ts', 'utf8');
  assert.match(src, /controls\.enableDamping = false/);
  assert.match(src, /addEventListener\('start'[^\n]*coast\.stop\(\)/);
  assert.match(src, /addEventListener\('end'[^\n]*coast\.release\(\)/);
  assert.match(src, /if \(ext\)[^\n]*coast\.stop\(\)/); // the in-page descent (band) flies the camera: no coast
  assert.match(src, /attachInput\(on: boolean\)[^\n]*coast\.stop\(\)/);
});
