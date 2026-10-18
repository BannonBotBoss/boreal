import test from 'node:test';
import assert from 'node:assert/strict';
import { createLocomotion, referenceLayout, GAIT_TABLE, type GaitId, type TerrainFn, type LegPose } from '../src/animals/locomotion';

const DT = 1 / 120, layout = referenceLayout();
const flat: TerrainFn = () => 0;
const hills: TerrainFn = (x, z) => .35 * Math.sin(x * .45) * Math.cos(z * .38) + .12 * Math.sin(x * 1.1 + z * .7);

/** Walk straight along −z (or a circle) and record every pose. */
function run(ground: TerrainFn, seconds: number, speedAt: (t: number) => number, gaitAt: (t: number) => GaitId | undefined = () => undefined, turn = 0) {
  let x = 0, z = 0, h = 0; const loco = createLocomotion(layout, ground, { x, z, heading: h }); const poses: LegPose[] = [];
  for (let t = 0; t < seconds; t += DT) {
    const v = speedAt(t); h += turn * DT; x += -Math.sin(h) * v * DT; z += -Math.cos(h) * v * DT;
    poses.push(loco.update({ x, z, heading: h, speed: v, gait: gaitAt(t) }, DT));
  }
  return poses;
}
/** Largest movement of any planted foot during one uninterrupted stance. */
function stanceSlip(poses: LegPose[]) {
  let worst = 0;
  for (let i = 0; i < 4; i++) { let anchor: { x: number; y: number; z: number } | undefined;
    for (const p of poses) { if (!p.contacts[i]) { anchor = undefined; continue; } const f = p.feet[i]; anchor ??= f;
      worst = Math.max(worst, Math.hypot(f.x - anchor.x, f.y - anchor.y, f.z - anchor.z)); } }
  return worst;
}

test('planted feet do not slip (< 1 mm) at a steady walk, trot and gallop, on flat ground and hills', () => {
  for (const ground of [flat, hills]) for (const v of [1, 2.6, 7]) assert.ok(stanceSlip(run(ground, 6, () => v)) < 1e-3, `v ${v}`);
});

test('planted feet do not slip through gait changes, speed changes, a stop and turning', () => {
  const gaits: GaitId[] = ['walk', 'trot', 'pace', 'canter', 'gallop', 'bound', 'pronk'];
  const poses = run(hills, 14, t => t < 12 ? 1 + 5 * Math.abs(Math.sin(t * .4)) : 0, t => t < 12 ? gaits[Math.floor(t / 1.7) % gaits.length] : undefined, .3);
  assert.ok(stanceSlip(poses) < 1e-3);
  assert.ok(poses[poses.length - 1].contacts.every(Boolean), 'all four feet down after stopping');
});

test('measured duty factor matches the gait table at a steady gait', () => {
  for (const id of ['walk', 'trot', 'pace'] as GaitId[]) {
    const poses = run(flat, 8, () => 1.5, () => id).slice(4 * 120);
    for (let i = 0; i < 4; i++) { const duty = poses.filter(p => p.contacts[i]).length / poses.length;
      assert.ok(Math.abs(duty - GAIT_TABLE[id].duty) < .03, `${id} leg ${i}: ${duty}`); }
  }
});

test('feet never go below the terrain and lift clear of it in swing', () => {
  const poses = run(hills, 8, () => 2.6), lift = GAIT_TABLE.trot.lift * layout.legs.hip;
  let peak = 0;
  for (const p of poses) p.feet.forEach((f, i) => { const g = hills(f.x, f.z); assert.ok(f.y >= g - 1e-6); if (!p.contacts[i]) peak = Math.max(peak, f.y - g); });
  assert.ok(peak > .5 * lift, `swing clearance ${peak}`);
});

test('body follows the slope: pitch sign matches the ground under front vs hind legs', () => {
  const ramp: TerrainFn = (_x, z) => -.3 * z; // rises toward −z (forward at heading 0)
  const p = run(ramp, 2, () => 1).pop()!;
  assert.ok(p.pitch > .2 && p.pitch < .4, `pitch ${p.pitch}`); assert.ok(Math.abs(p.roll) < 1e-9);
});

test('mid LOD gives the same contacts as near on flat ground and stays finite', () => {
  let x = 0, z = 0; const a = createLocomotion(layout, flat, { x, z, heading: 0 }), b = createLocomotion(layout, flat, { x, z, heading: 0 });
  let same = 0, n = 0;
  for (let t = 0; t < 4; t += DT) { z -= 2 * DT; const pa = a.update({ x, z, heading: 0, speed: 2 }, DT, 'near'), pb = b.update({ x, z, heading: 0, speed: 2 }, DT, 'mid');
    assert.ok([...pb.legs, ...pb.knees, pb.height].every(Number.isFinite)); if (t > 1) { n++; if (pa.contacts.join() === pb.contacts.join()) same++; } }
  assert.ok(same / n > .97);
});
