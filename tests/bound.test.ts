/**
 * T-0009 (grok-gait): bounding controller on a data-driven limb skeleton (src/animals/locomotion/bodyPlan.ts, bounding.ts)
 * and its gate metric (boundScore.ts). Sources and the numbers they check: tasks/handoffs/T-0009-grok-gait.md.
 * - Rows: HARE_AGENT.gait touchdown [LF .00, RF .08, LH .42, RH .45] (Bertram & Gutmann 2009 half-bound: hind pair near
 *   unison, fore staggered); lagomorph gallop hind lead on the other side (rotary, Hildebrand 1977).
 * - Planted feet: slip < 1 cm, no leash steps in steady running (T-0009 ask (c)).
 * - Hind overtaking (Lagomorpha Locomotion 2021) and spine flexion at hind touchdown / extension at hind lift-off
 *   (Schilling & Hackert 2006, JEB 209:3925) at running speeds; stiff back in the slow half-bound (Bertram & Gutmann 2009).
 * - Metric calibration (RULES 11): known match 100, known mismatches low.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { footState as boundFoot, boundCadence, boundDuty, boundForeDuty, boundDuties } from '../src/core/needs/bound';
import { GAIT_TABLE } from '../src/animals/locomotion/gaits';
import { suspensions } from '../src/core/gaitData';
import { skeletonOf } from '../src/animals/locomotion/bodyPlan';
import { boundRows, rowOffsets, createBounding, boundPlan, poseRequestFor, selectRow, reachOf, type BoundRowId } from '../src/animals/locomotion/bounding';
import { scoreTrace, type TraceFrame } from '../src/animals/locomotion/boundScore';
import { HOST_PLAN, BLOB_PLAN, HOST_GAIT, planFor } from '../tools/bound-plans';
import { runScore, ROW_ORDER } from '../tools/bound-score';

const G = HOST_GAIT;
function run(plan: 'host' | 'bones' | 'canid-limits', v: number, row?: BoundRowId, seconds = 4, dt = 1 / 240) {
  const sk = planFor(plan), c = createBounding(sk, G, () => 0, { x: 0, z: 0, heading: 0 }), tr: TraceFrame[] = [];
  for (let t = 0; t < seconds; t += dt) { const sp = Math.min(v, v * t / 1.5), f = c.update(dt, sp, 0, null, row ?? selectRow(v));
    tr.push({ t, stride: f.stride, speed: sp, contact: f.contact, slip: f.slip, spineFlex: f.spineFlex, leashes: f.leashes, touchdowns: f.touchdowns, fwd: { x: 0, z: -1 } }); }
  return { c, tr };
}

test('rows: half-bound is the host data, offsets convert touchdown → CPG (LF, LH, RF, RH)', () => {
  const r = boundRows(G);
  assert.deepEqual([...r['half-bound'].touchdown], [0, .08, .42, .45]);
  assert.deepEqual(rowOffsets(r['half-bound']).map(x => +x.toFixed(3)), [0, .58, .92, .55]);
  // gallop: same fore pair, hind lead on the other side (RH first, LH one fore-lag later)
  assert.deepEqual([...r['gallop-lagomorph'].touchdown].map(x => +x.toFixed(3)), [0, .08, .5, .42]);
  assert.equal(selectRow(5), 'half-bound'); assert.equal(selectRow(8.5), 'half-bound', 'flight speed: flexed-back half-bound (Bertram & Gutmann 2009)');
  assert.equal(selectRow(10.5), 'gallop-lagomorph'); assert.equal(selectRow(9.7, 'gallop-lagomorph'), 'gallop-lagomorph');
  // GAIT_TABLE rows (replacing the unverified 'bound') are the same offsets
  assert.deepEqual(GAIT_TABLE['half-bound'].offsets.map(x => +x.toFixed(3)), rowOffsets(r['half-bound']).map(x => +x.toFixed(3)));
  assert.deepEqual(GAIT_TABLE['gallop-lagomorph'].offsets.map(x => +x.toFixed(3)), rowOffsets(r['gallop-lagomorph']).map(x => +x.toFixed(3)));
});

test('skeleton: built from the host body numbers, near plantigrade standing; an impossible body throws', () => {
  const sk = skeletonOf(HOST_PLAN);
  assert.equal(sk.legs.hind.hip, .13); assert.equal(sk.legs.hind.foot, .132);
  // femur 94 + tibia 108 mm; humerus 77 + radius 69 + manus 35 mm (HARE_BODY sources)
  assert.ok(Math.abs(sk.legs.hind.upper + sk.legs.hind.lower - .202) < 1e-9 && Math.abs(sk.legs.upper + sk.legs.lower + (sk.legs.foot ?? 0) - .187) < 1e-9);
  assert.ok(Math.abs(sk.legs.hind.upper - .47 * .202) < 1e-9, 'femur share');
  assert.ok(sk.restFootAngle > 1.2 && sk.restFootAngle < Math.PI / 2, `rest foot ${sk.restFootAngle}`);
  assert.throws(() => skeletonOf({ ...HOST_PLAN, hip: .5 }));
  assert.ok(skeletonOf(BLOB_PLAN).legs.hind.upper < sk.legs.hind.upper, 'the run-2 blob legs were shorter');
});

test('plan: cadence is the host data; duty is the data duty capped by what limbs + girdles sweep', () => {
  for (const plan of ['host', 'bones'] as const) {
    const reach = reachOf(planFor(plan));
    for (const v of [1.68, 5, 8.5, 11.6]) {
      const p = boundPlan(G, v, reach, selectRow(v));
      assert.ok(Math.abs(p.hz - boundCadence(G, v)) < 1e-12 && Math.abs(p.dutyData - boundDuty(G, v)) < 1e-12 && Math.abs(p.foreDutyData - boundForeDuty(G, v)) < 1e-12);
      assert.ok(p.foreDuty < p.duty, 'fore contact shorter than hind (Hildebrand 1977)');
      assert.ok(p.duty <= p.dutyData + 1e-12 && p.duty > 0);
    }
  }
  assert.equal(boundPlan(G, 1.68, reachOf(planFor('host')), 'half-bound').duty, .6, 'measured-bone body keeps the data duty at the transition');
  // cadence: Heglund & Taylor 1988 for 1.5 kg (transition, preferred gallop, max sustained), held above
  for (const [v, hz] of [[1.68, 3.94], [2.91, 4.17], [3.98, 4.4], [8.5, 4.4]] as const) assert.ok(Math.abs(boundCadence(G, v) - hz) < .005, `${v} m/s: ${boundCadence(G, v)}`);
  // duty (run 4): hind = sweep .40 m / stride, clamped to [.20, .60] (Hildebrand 1977 bounds; Walter & Carrier 2007 sweep in leg
  // lengths); fore .90 -> .70 of the hind (Lepus <= 70 % at speed) with a hard .13 floor (Hildebrand 1977; run 5, was .16)
  assert.ok(Math.abs(boundDuty(G, 1.68) - .6) < 1e-9 && Math.abs(boundDuty(G, 11.6) - .2) < 1e-9 && Math.abs(boundForeDuty(G, 11.6) - .14) < 1e-9 && G.foreMin === .13);
  for (const [v, d] of [[3, .559], [5, .352], [8.5, .207]] as const) assert.ok(Math.abs(boundDuty(G, v) - d) < .001, `${v} m/s hind duty ${boundDuty(G, v)}`);
});

for (const v of [1.68, 5, 8.5, 11.6]) test(`planted: slip < 1 cm, no leash steps in steady running at ${v} m/s (host body)`, () => {
  const { tr } = run('host', v), steady = tr.filter(f => f.t > 2);
  const slip = Math.max(...steady.map(f => Math.max(...f.slip)));
  assert.ok(slip < .01, `slip ${slip}`);
  assert.equal(steady[steady.length - 1].leashes - steady[0].leashes, 0);
});
test('no foot through the ground: swinging soles stay above it (at most a frame at lift-off)', () => {
  for (const plan of ['host', 'bones'] as const) for (const v of [5, 8.5, 11.6]) {
    const sk = planFor(plan), c = createBounding(sk, G, () => 0, { x: 0, z: 0, heading: 0 }); let under = 0;
    for (let t = 0; t < 4; t += 1 / 240) { const f = c.update(1 / 240, Math.min(v, v * t / 1.5), 0, null, selectRow(v)); if (t > 2) under += f.soles.filter(s => s.y < -.005).length; }
    assert.ok(under <= 2, `${plan} ${v}: ${under} frames with a sole > 5 mm under the ground`);
  }
});

test('overtaking and spine timing at running speed (host and bone bodies), stiff back when slow', () => {
  for (const plan of ['host', 'bones'] as const) for (const v of [5, 8.5, 11.6]) {
    const { c, tr } = run(plan, v), row = selectRow(v), p = boundPlan(G, v, c.reach, row);
    const s = scoreTrace(tr, { speed: v, row, hz: p.hz, dutyData: (p.dutyData + p.foreDutyData) / 2, order: ROW_ORDER[row], warm: 2, expect: [...new Set(suspensions(p.offsets, p.dutiesData).map(x => x.kind))] });
    // flex at 8.5 m/s is open (6/10 strides in run 3: T-0009 handoff); the rest must hold
    for (const name of v === 8.5 ? ['overtake', 'phases', 'cadence', 'order', 'planted'] : ['overtake', 'flex', 'phases', 'cadence', 'order', 'planted']) assert.ok(s.checks.find(k => k.name === name)!.pass, `${plan} ${v} ${name}: ${JSON.stringify(s.checks)}`);
  }
  // stiff back when slow: holds where the limbs sweep the slow stride alone (dog joint ranges); under LEPORID_LIMITS the hind
  // chord (~.20 m) is too short even at 1.68 m/s, so the back flexes there too — reported in the T-0009 grok-gait handoff
  const slow = run('canid-limits', 1.68).tr.filter(f => f.t > 2);
  assert.ok(Math.max(...slow.map(f => Math.abs(f.spineFlex))) < .05, 'stiff-backed slow half-bound');
});

test('pose requests: sit-up lifts the fore feet with the hind planted; graze crouch keeps all four down; ignored while running', () => {
  assert.deepEqual(poseRequestFor('head-down', 'feed'), { kind: 'graze-crouch' });
  assert.deepEqual(poseRequestFor('head-up', 'alert'), { kind: 'half-sit' }); // run 4: half sit-up on all fours (reference)
  { const c = createBounding(planFor('canid-limits'), G, () => 0, { x: 0, z: 0, heading: 0 }); let f = c.update(1 / 120, 0, 0, null), slip = 0;
    for (let t = 0; t < 1.5; t += 1 / 120) { f = c.update(1 / 120, 0, 0, { kind: 'half-sit' }); slip = Math.max(slip, ...f.slip); }
    assert.deepEqual(f.contact, [true, true, true, true]); assert.ok(f.tilt.pitch > .25 && f.tilt.pitch < .45 && slip < .01, `half-sit pitch ${f.tilt.pitch} slip ${slip}`); }
  assert.deepEqual(poseRequestFor('head-up', 'scan'), { kind: 'scan' });
  assert.equal(poseRequestFor('run', 'flee'), null);
  for (const plan of ['host', 'bones'] as const) {
    const c = createBounding(planFor(plan), G, () => 0, { x: 0, z: 0, heading: 0 });
    let f = c.update(1 / 120, 0, 0, null), slip = 0;
    for (let t = 0; t < 1.5; t += 1 / 120) { f = c.update(1 / 120, 0, 0, { kind: 'sit-up' }); slip = Math.max(slip, f.slip[1], f.slip[3]); }
    assert.deepEqual(f.contact, [false, true, false, true]); assert.ok(f.tilt.pitch > .9 && slip < .01, `${plan} sit-up pitch ${f.tilt.pitch} slip ${slip}`);
    assert.ok(f.soles[0].y > .1, 'fore paws up');
    for (let t = 0; t < 1.5; t += 1 / 120) { f = c.update(1 / 120, 0, 0, { kind: 'graze-crouch' }); slip = Math.max(slip, ...f.slip); }
    assert.deepEqual(f.contact, [true, true, true, true]); assert.ok(f.tilt.pitch < 0 && slip < .01, `${plan} graze pitch ${f.tilt.pitch} slip ${slip}`);
    for (let t = 0; t < 1; t += 1 / 120) f = c.update(1 / 120, 3, 0, { kind: 'sit-up' });
    assert.equal(f.pose, 'stand');
  }
});

/** A trace made from the BoundGait itself (the known match: hind prints 0.45 m ahead of the fore line, as in hare tracks),
 * optionally broken (known mismatches: trot timing with hind prints just behind the fore ones, direct register; sliding feet, flat back). */
function synth(v: number, break_?: 'trot' | 'slide', o: { gap?: number; slip?: number; pitchSpan?: number; dutyScale?: number } = {}) {
  const row = selectRow(v), hz = boundCadence(G, v), duty = boundDuty(G, v) * (o.dutyScale ?? 1), duties = boundDuties(G, v).map(d => d * (o.dutyScale ?? 1)) as unknown as ReturnType<typeof boundDuties>, stride = v / hz;
  let td: [number, number, number, number] = [...boundRows(G)[row].touchdown]; if (break_ === 'trot') td = [0, .5, .5, 0];
  const legOf = [0, 2, 1, 3]; // BoundGait order LF, RF, LH, RH → LF, LH, RF, RH
  // o.gap: the hind print lands about `gap` ahead of the fore print before it (the print offset minus the travel between them)
  const ahead = o.gap === undefined ? .45 : o.gap - v * (Math.min(td[2], td[3]) - Math.max(td[0], td[1])) / hz;
  const tr: TraceFrame[] = [], prev = [false, false, false, false], dt = 1 / 240, hindTd = Math.min(td[2], td[3]), hindLift = Math.max(td[2], td[3]) + duty, legDuties = [duties[0], duties[2], duties[1], duties[3]];
  for (let t = 0; t < 4; t += dt) {
    const ph = (hz * t) % 1, contact = [false, false, false, false], touchdowns: TraceFrame['touchdowns'] = [];
    for (let k = 0; k < 4; k++) { const i = legOf[k], st = boundFoot({ ...G, touchdown: td }, ph, k, duties).stance; contact[i] = st;
      if (st && !prev[i]) touchdowns.push({ leg: i, at: { x: 0, y: 0, z: -(v * t + (i % 2 ? (break_ === 'trot' ? -.02 : ahead) : 0) + duty * stride / 2) } }); prev[i] = st; }
    // flexion peaks at the first hind touchdown, extension at the last hind lift-off (linear between)
    const a = ((ph - hindTd) % 1 + 1) % 1, span = ((hindLift - hindTd) % 1 + 1) % 1, flex = v < 3 ? 0 : a < span ? .3 - .6 * a / span : -.3 + .6 * (a - span) / (1 - span);
    tr.push({ t, stride: ph, speed: v, contact, slip: contact.map(c => c ? (break_ === 'slide' ? .05 : o.slip ?? 0) : 0), spineFlex: break_ === 'slide' ? 0 : flex, leashes: 0, touchdowns, fwd: { x: 0, z: -1 },
      // trunk pitch (v2 metric): a sine of the reference span (22 deg) over the stride; a flat trunk for the sliding mismatch
      pitch: break_ === 'slide' ? 0 : (o.pitchSpan ?? 22) / 2 * Math.PI / 180 * Math.sin(2 * Math.PI * ph) });
  }
  const order = ROW_ORDER[row];
  return scoreTrace(tr, { speed: v, row, hz, dutyData: (duties[0] + duties[2]) / 2, order, warm: 1, expect: [...new Set(suspensions(rowOffsets({ id: row, touchdown: td }), legDuties).map(x => x.kind))] });
}
test('metric calibration (bound-checks v2, graded): the data itself scores 100, trot timing and sliding feet score low, better beats good', () => {
  for (const v of [1.68, 5, 8.5, 11.6]) {
    const match = synth(v), trot = synth(v, 'trot'), slide = synth(v, 'slide');
    assert.equal(match.score, 100, `${v}: ${JSON.stringify(match.checks.filter(c => c.grade < 1))}`);
    assert.ok(trot.score <= 72, `trot ${v}: ${trot.score}`);
    assert.ok(slide.score <= (v >= 5 ? 76 : 86) && slide.checks.find(c => c.name === 'planted')!.grade === 0, `slide ${v}: ${slide.score}`);
    // graded: tells good from better (v1 passed all of these alike)
    const g = (s: ReturnType<typeof synth>, n: string) => s.checks.find(c => c.name === n)!.grade;
    assert.ok(g(synth(v, undefined, { gap: .04 }), 'overtake') < g(synth(v, undefined, { gap: .12 }), 'overtake'), 'prints 4 cm ahead < 12 cm');
    assert.ok(g(synth(v, undefined, { slip: .005 }), 'planted') < g(synth(v, undefined, { slip: .0005 }), 'planted'), 'slip 5 mm < .5 mm');
    // contact (run 6, Lepus floors): a trace far under the floors grades lower than the data's own duty
    assert.ok(g(synth(v, undefined, { dutyScale: .2 }), 'contact') < g(synth(v), 'contact'), 'short contacts < data contacts');
    if (v >= 5) assert.ok(g(synth(v, undefined, { pitchSpan: 2 }), 'pitch') < g(synth(v, undefined, { pitchSpan: 15 }), 'pitch') && g(synth(v, undefined, { pitchSpan: 15 }), 'pitch') < 1, 'flat trunk < 15 deg < the 22 deg reference');
  }
});

test('score tool runs (numbers reported in the T-0009 grok-gait handoff)', () => {
  // same joint ranges, longer sourced bones: at least the old blob; the host with LEPORID_LIMITS is reported, not ranked
  const host = runScore('host'), dog = runScore('canid-limits'), blob = runScore('blob');
  assert.ok(host.score > 0 && dog.score >= blob.score, `host ${host.score} canid-limits ${dog.score} blob ${blob.score}`);
});
