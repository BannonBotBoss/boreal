/**
 * Run-gallop retune (Grok Bot): the default game wolf's run key gallop against canid data.
 * - Heglund & Taylor 1988, JEB 138:301, Table 4: 25 kg dog gallop f = 2.27 + 0.050 v Hz (4.17-8.25 m/s), x(40/25)^-0.156
 *   (Table 3 gallop mass exponent) for a 40 kg wolf; "stride frequency within a gallop increased very little with
 *   increasing speed, typically about 10 % for a doubling of speed".
 * - Biancardi & Minetti 2012, JEB 215:4144: maximum hip-to-toe excursion in fast gallops 65.7 +- 7.7 deg (transverse),
 *   91.1 +- 29.7 deg (rotary).
 * - Seyfarth, Geyer & Herr 2003, JEB 206:2547: swing-leg retraction (the paw moves back before touchdown).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { WOLF_LEGS, footTarget, gaitFor, quadrupedPose } from '../src/core/animalBehavior';
import { cadence, suspensions } from '../src/core/gaitData';
import { playerSpeed } from '../src/core/playerTuning';

const RUN = playerSpeed('run'), SPRINT = playerSpeed('sprint'), dog40 = (v: number) => (2.27 + .05 * v) * (40 / 25) ** -.156;

test('run key: cadence on the 40 kg dog gallop line (+-5 %), stride over 2.4 m', () => {
  const g = gaitFor('run', RUN, WOLF_LEGS, 'gallop')!, hz = RUN / g.cycle;
  assert.equal(g.name, 'gallop');
  assert.ok(Math.abs(hz - dog40(RUN)) <= .05 * dog40(RUN), `${hz.toFixed(2)} Hz vs ${dog40(RUN).toFixed(2)}`);
  assert.ok(hz < 2.5 && g.cycle > 2.4, `${hz.toFixed(2)} Hz, ${g.cycle.toFixed(2)} m`);
});
test('gallop: speed comes from stride, not quicker legs (frequency rises < 15 % from run to sprint, stride > 1.5x)', () => {
  const a = gaitFor('run', RUN, WOLF_LEGS, 'gallop')!, b = gaitFor('run', SPRINT, WOLF_LEGS, 'gallop')!;
  assert.ok(cadence(SPRINT, WOLF_LEGS.hip) / cadence(RUN, WOLF_LEGS.hip) < 1.15);
  assert.ok(b.cycle / a.cycle > 1.5, `${a.cycle.toFixed(2)} -> ${b.cycle.toFixed(2)} m`);
});
test('gallop: the legs swing through the measured hip-to-toe excursion (58-100 deg), not a small patter', () => {
  for (const v of [RUN, 8, SPRINT]) {
    for (const leg of [0, 1, 2, 3]) {
      let lo = Infinity, hi = -Infinity;
      for (let k = 0; k < 200; k++) { const p = quadrupedPose('run', k / 200, 0, WOLF_LEGS, v, 'gallop'), f = p.feet[leg], j = p.joints[leg];
        const a = Math.atan2(-(f.z - j.z), j.y - f.y) * 180 / Math.PI; lo = Math.min(lo, a); hi = Math.max(hi, a); }
      assert.ok(hi - lo > 58 && hi - lo < 100, `${v} m/s leg ${leg}: ${(hi - lo).toFixed(0)} deg`);
    }
  }
});
test('gallop swing follows through: the paw keeps moving back just after liftoff and retracts just before touchdown', () => {
  const g = gaitFor('run', RUN, WOLF_LEGS, 'gallop')!, leg = 1, d = 1e-3;
  const z = (p: number) => footTarget(g, 'run', p - g.offsets[leg], leg).z;
  const lift = g.duty, td = 1;
  assert.ok(z(lift + d) > z(lift), 'still moving back after liftoff');
  assert.ok(z(td - d) > z(td - 2 * d), 'moving back (retracting) into touchdown');
  assert.ok(Math.abs(z(lift + 1e-9) - z(lift - 1e-9)) < 1e-6 && Math.abs(z(td - 1e-9) - z(1e-9)) < 1e-6, 'continuous at both ends');
});
test('walk and trot swings are unchanged (no follow-through)', () => {
  for (const v of [1.2, 2, 3]) { const g = gaitFor(v < 1.5 ? 'walk' : 'run', v, WOLF_LEGS)!; assert.ok(g.name !== 'gallop'); assert.equal(g.follow ?? 0, 0); }
});
test('gallop: the default wolf body rises then falls through each gathered flight (ballistic, no early dip)', () => {
  for (const v of [RUN, 8, SPRINT]) {
    const g = gaitFor('run', v, WOLF_LEGS, 'gallop')!, w = suspensions(g.offsets, g.duty).find(x => x.kind === 'gathered')!;
    const h = Array.from({ length: 17 }, (_, k) => quadrupedPose('run', (w.from + (w.to - w.from) * k / 16) % 1, 0, WOLF_LEGS, v, 'gallop').bob);
    const top = Math.max(...h), at = h.indexOf(top);
    assert.ok(top > h[0] + .003 && at > 2 && at < 15, `${v} m/s: ${h.map(x => (1000 * x).toFixed(1)).join(' ')}`);
  }
});
