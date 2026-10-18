import test from 'node:test';
import assert from 'node:assert/strict';
import { createLocomotion, referenceLayout, type GaitId, type LegPose, type Touchdown } from '../src/animals/locomotion';

const DT = 1 / 120, layout = referenceLayout(), flat = () => 0;
const SPEED: Record<GaitId, number> = { walk: 1, trot: 2.6, pace: 2.2, canter: 4.5, gallop: 7, bound: 6, pronk: 3.5 };

function run(gait: GaitId | undefined, speed: number, seconds: number, pounceAt = -1) {
  let z = 0; const loco = createLocomotion(layout, flat, { x: 0, z: 0, heading: 0 }), poses: LegPose[] = [], heard: Touchdown[] = [];
  loco.onTouchdown(t => heard.push(t));
  for (let k = 0, t = 0; t < seconds; k++, t += DT) {
    z -= speed * DT;
    poses.push(loco.update({ x: 0, z, heading: 0, speed, gait, intent: k === Math.round(pounceAt / DT) ? { kind: 'pounce' } : undefined }, DT));
  }
  return { poses, heard };
}

test('touchdowns fire exactly once per stance, for every leg, in each gait; the subscribe API sees the same events', () => {
  for (const gait of Object.keys(SPEED) as GaitId[]) {
    const { poses, heard } = run(gait, SPEED[gait], 6);
    assert.equal(heard.length, poses.reduce((n, p) => n + p.touchdowns.length, 0), `${gait}: listener vs pose list`);
    for (let i = 0; i < 4; i++) {
      let stances = 0, events = 0, wraps = 0;
      for (let k = 1; k < poses.length; k++) {
        const p = poses[k], q = poses[k - 1], ev = p.touchdowns.filter(t => t.leg === i);
        assert.ok(ev.length <= 1, `${gait} leg ${i}: two touchdowns in one frame`);
        if (p.contacts[i] && !q.contacts[i]) { stances++; assert.equal(ev.length, 1, `${gait} leg ${i}: stance without a touchdown`); }
        else assert.equal(ev.length, 0, `${gait} leg ${i}: touchdown without a new stance`);
        events += ev.length; if (p.phases[i] < q.phases[i] - .5) wraps++;
        for (const t of ev) { assert.equal(t.gait, gait); assert.ok(t.strength > 0 && t.strength <= 1); assert.deepEqual(t.worldPos, p.feet[i]); }
      }
      assert.equal(events, stances);
      assert.ok(Math.abs(stances - wraps) <= 1, `${gait} leg ${i}: ${stances} stances in ${wraps} cycles`);
      assert.ok(stances >= 3, `${gait} leg ${i}: only ${stances} stances`);
    }
  }
});

test('a pounce landing gives one landing touchdown per paw at strength 1', () => {
  const { poses } = run(undefined, 1, 4, 1);
  const land = poses.flatMap(p => p.touchdowns).filter(t => t.landing);
  assert.deepEqual(land.map(t => t.leg).sort(), [0, 1, 2, 3]);
  assert.ok(land.every(t => t.strength === 1));
});

test('standing still gives no touchdowns', () => {
  assert.equal(run(undefined, 0, 3).poses.reduce((n, p) => n + p.touchdowns.length, 0), 0);
});
