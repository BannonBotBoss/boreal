import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ringOffset, cueBeacons, beaconBearing, haloFade, easeSpeed, HALO, type Beacon } from '../src/core/senseBeacons';
import { SENSES, type ScentHit, type SoundCue } from '../src/core/senses';
const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-9, `${a} vs ${b}`);
test('halo: bearing maps onto the ring (ahead -Z, right +X, behind +Z, left -X)', () => {
  const o = { x: 0, z: 0 };
  ringOffset(0, 1, o); near(o.x, 0); near(o.z, -1);
  ringOffset(Math.PI / 2, 1, o); near(o.x, 1); near(o.z, 0);
  ringOffset(Math.PI, 2, o); near(o.x, 0); near(o.z, 2);
  ringOffset(-Math.PI / 2, 1, o); near(o.x, -1); near(o.z, 0);
});
test('halo: ring-local point, turned by the wolf heading, points back at the source in the world', () => {
  const head = { x: 3, z: -2 }, src = { x: 10, z: 5 }, o = { x: 0, z: 0 };
  for (const h of [0, .7, -2.1, Math.PI]) {
    ringOffset(beaconBearing({ kind: 'sound', id: 'x', strength: 1, fresh: 0, ...src }, head, h), 1, o);
    const wx = o.x * Math.cos(h) + o.z * Math.sin(h), wz = -o.x * Math.sin(h) + o.z * Math.cos(h); // THREE rotation.y = h
    const d = Math.hypot(src.x - head.x, src.z - head.z); near(wx, (src.x - head.x) / d); near(wz, (src.z - head.z) / d);
  }
});
test('halo: cues become beacons (sound fades with age, out-of-range dropped, scent level kept, capped, buffer reused)', () => {
  const sounds: SoundCue[] = [{ id: 'hare-hop', x: 5, z: 0, level: 1, age: 0 }, { id: 'owl', x: 0, z: 5, level: .8, age: SENSES.cueLife / 2 }, { id: 'far', x: 99, z: 0, level: 1, age: 0 }];
  const scents = [{ key: 'deer:1', kind: 'deer', x: -4, z: 0, potency: 1, level: .7, bearing: 0, distance: 4 }] as ScentHit[];
  const out: Beacon[] = [];
  assert.equal(cueBeacons(sounds, scents, { x: 0, z: 0 }, out), 3);
  assert.deepEqual(out.slice(0, 3).map(b => [b.kind, b.id]), [['sound', 'hare-hop'], ['sound', 'owl'], ['scent', 'deer:1']]);
  near(out[0].strength, 1); near(out[0].fresh, 1); near(out[1].strength, .4); near(out[1].fresh, 0); near(out[2].strength, .7);
  const first = out[0]; cueBeacons(sounds, [], { x: 0, z: 0 }, out); assert.equal(out[0], first);
  const many = Array.from({ length: 20 }, (_, i) => ({ id: `s${i}`, x: 1, z: i, level: 1, age: 0 }));
  assert.equal(cueBeacons(many, scents, { x: 0, z: 0 }, out), HALO.maxBeacons);
});
test('halo: fades with ground speed (full standing/stealth, partial at walk, gone at run) and eases smoothly', () => {
  near(haloFade(0), 1); near(haloFade(.8), 1); // standing, stealth (core/wolfModes modeSpeed)
  const walk = haloFade(2); assert.ok(walk > .5 && walk < .85, `walk ${walk}`);
  near(haloFade(6), 0); near(haloFade(10), 0); // run, sprint
  for (let v = 0; v < 8; v += .1) assert.ok(haloFade(v + .1) <= haloFade(v) + 1e-12); // monotonic
  let v = 0; const seen: number[] = []; for (let i = 0; i < 60; i++) { v = easeSpeed(v, 6 / 60, 1 / 60); seen.push(v); } // start running at 6 m/s
  assert.ok(seen[5] < 2 && seen[59] > 5, `${seen[5]} ${seen[59]}`); assert.ok(seen.every((x, i) => i === 0 || x >= seen[i - 1]));
  assert.equal(easeSpeed(1, 50, 1 / 60), 1); assert.equal(easeSpeed(1, .1, 0), 1); // teleport / no time: hold
});
