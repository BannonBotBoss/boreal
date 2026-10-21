/**
 * T-0009 run 2 (grok-gait, on dfcb848): per-body joint ranges as data (ik.ts JointLimits via BodyPlan.limits), the derived
 * body pitch through the bound (bounding.ts pitchCurve), and the reach budget (tools/bound-reach.ts).
 * - Dog/wolf unchanged: clampLimb with no limits is the old FLEX_LIMIT clamp, value for value.
 * - Leporid hind ankle 66.4-137.2° and foot-to-ground 17.2-123.3° in stance (Hall et al. 2022, PeerJ 10:e13611).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { clampLimb, FLEX_LIMIT, CANID_LIMITS, LEPORID_LIMITS, clampJoint, type LimbAngles } from '../src/animals/locomotion/ik';
import { createBounding, limbPoints, pitchCurve, boundPlan, selectRow, reachOf, runTilt, BOUND_PITCH, type BoundFrame } from '../src/animals/locomotion/bounding';
import { HOST_GAIT, planFor } from '../tools/bound-plans';
import { reachBudget } from '../tools/bound-reach';

const RAD = Math.PI / 180;
const oldClamp = (a: LimbAngles, front: boolean): LimbAngles => { const lim = front ? FLEX_LIMIT.front : FLEX_LIMIT.hind, c = (v: number, m: number) => Math.max(-m, Math.min(m, v));
  return { ...a, knee: c(a.knee, lim.knee), wrist: c(a.wrist, lim.wrist) }; };

test('joint ranges: the default (and CANID_LIMITS) clamp exactly as before, so dog and wolf bodies are unchanged', () => {
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let k = 0; k < 2000; k++) {
    const a: LimbAngles = { girdle: 0, leg: 0, knee: (rnd() - .5) * 8, wrist: (rnd() - .5) * 8, paw: 0, abduct: 0, joint: { z: 0, y: 0 } };
    for (const front of [true, false]) { const o = oldClamp(a, front);
      assert.deepEqual(clampLimb(a, front), o); assert.deepEqual(clampLimb(a, front, CANID_LIMITS), o); }
  }
});

test('leporid ranges are the paper\'s means and clamp the hind ankle into them (interior angle = 180° − |solve angle|)', () => {
  assert.deepEqual(LEPORID_LIMITS.hind.wrist, { min: 66.4, max: 137.2, flex: 1 });
  assert.deepEqual(LEPORID_LIMITS.hind.foot, { min: 17.2, max: 123.3 });
  for (let v = -3; v <= 3; v += .01) { const c = clampJoint(v, LEPORID_LIMITS.hind.wrist), interior = 180 - Math.abs(c) / RAD;
    assert.ok(c > 0 && interior >= 66.4 - 1e-9 && interior <= 137.2 + 1e-9, `${v} -> ${c}`); }
  assert.deepEqual(LEPORID_LIMITS.front, CANID_LIMITS.front); // no lagomorph fore goniometry: dog placeholder
});

function run(plan: string, v: number, seconds = 4, dt = 1 / 240) {
  const sk = planFor(plan), c = createBounding(sk, HOST_GAIT, () => 0, { x: 0, z: 0, heading: 0 }), out: { t: number; f: BoundFrame }[] = [];
  for (let t = 0; t < seconds; t += dt) out.push({ t, f: c.update(dt, Math.min(v, v * t / 1.5), 0, null, selectRow(v)) });
  return { sk, c, out };
}

test('host run: planted hind ankles and feet stay inside the leporid stance ranges (foot angle read from the drawn bones)', () => {
  for (const v of [3, 8.5]) { const { sk, out } = run('host', v); let n = 0;
    for (const { t, f } of out) { if (t < 2.5) continue;
      for (const i of [1, 3]) { if (!f.contact[i]) continue; n++;
        const P = limbPoints(sk, f, i), hock = P[3], toe = P[4], foot = Math.atan2(hock.y - toe.y, hock.z - toe.z) / RAD; // 0 flat (hock behind), 90 up
        const ankle = 180 - Math.abs(f.limbs[i].wrist) / RAD;
        assert.ok(ankle >= 66.4 - .01 && ankle <= 137.2 + .01, `${v}: ankle ${ankle}`);
        assert.ok(foot >= 17.2 - 3 && foot <= 123.3 + 3, `${v}: foot ${foot}`); // 3° = the foot scan step
      } }
    assert.ok(n > 100);
  }
});

test('derived pitch: periodic, nose lowest at mid fore stance and highest at mid hind stance, capped; feet stay planted', () => {
  for (const plan of ['host', 'canid-limits']) { const sk = planFor(plan), r = createBounding(sk, HOST_GAIT, () => 0, { x: 0, z: 0, heading: 0 }).reach;
    for (const v of [5, 8.5]) { const p = boundPlan(HOST_GAIT, v, r, selectRow(v)), c = pitchCurve(p, sk), n = c.length;
      const lo = c.indexOf(Math.min(...c)) / n, hi = c.indexOf(Math.max(...c)) / n, foreTd = (1 - p.offsets[0] + p.duties[0] / 2) % 1, hindTd = (1 - p.offsets[1] + p.duties[1] / 2) % 1;
      const near = (a: number, b: number) => Math.min(Math.abs(a - b), 1 - Math.abs(a - b)) < .12;
      assert.ok(Math.max(...c) - Math.min(...c) > .1 && Math.max(...c.map(Math.abs)) <= BOUND_PITCH.max + 1e-9, `${plan} ${v}`);
      assert.ok(near(lo, foreTd) && near(hi, hindTd), `${plan} ${v}: min at ${lo} (mid fore stance ${foreTd}), max at ${hi} (mid hind stance ${hindTd})`);
      const { out } = run(plan, v), steady = out.filter(o => o.t > 2.5);
      assert.equal(steady[steady.length - 1].f.leashes - steady[0].f.leashes, 0, `${plan} ${v} leashes`);
      assert.ok(Math.max(...steady.flatMap(o => o.f.slip)) < .01, `${plan} ${v} slip`);
    } }
});

test('reach budget: the re-sourced hind sweep at 8.5 m/s (.40 m) fits the dog ranges the game uses, not the leporid stance ranges', () => {
  const host = reachBudget('host'), game = reachBudget('canid-limits'), r = host.rows.find(x => x.speed === 8.5)!, g = game.rows.find(x => x.speed === 8.5)!;
  assert.ok(Math.abs(r.hindNeed - .40) < .005, `${r.hindNeed}`); // sweep .40 m = 1.2 x (hind leg + foot): grok run 4
  assert.ok(r.hindShort > 0 && host.hindCap < .35, JSON.stringify(r)); // leporid (slow-walk stance) ranges: reported in the grok-gait handoff
  assert.ok(g.hindShort < 0, JSON.stringify(g));
});
test('running posture (run 4): the neutral trunk pitch is near level (-12..0 deg, reference-matched), not the old -16.6 deg', () => {
  const sk = planFor('canid-limits'), r = reachOf(sk), p = runTilt(sk, r.rise, 1, 0).pitch * 180 / Math.PI;
  assert.ok(p > -12 && p <= 0, `neutral ${p}`);
  assert.ok(r.fore.chord > .2 && r.hind.chord > .5, JSON.stringify({ fore: r.fore.chord, hind: r.hind.chord }));
});
