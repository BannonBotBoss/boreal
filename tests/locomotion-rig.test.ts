import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createPlayerWolf as original } from '../src/render/playerWolf';
import { createPlayerWolf as forked } from '../src/animals/locomotion/fork/playerRig';
import { createLocomotion, SPRINGS, type TerrainFn } from '../src/animals/locomotion';

const hills: TerrainFn = (x, z) => .35 * Math.sin(x * .45) * Math.cos(z * .38) + .12 * Math.sin(x * 1.1 + z * .7);
const boneWorlds = (root: THREE.Object3D) => { root.updateMatrixWorld(true); const out: number[] = [];
  root.traverse(o => { if ((o as THREE.Bone).isBone) out.push(...o.matrixWorld.elements); }); return out; };

test('fork without legPose poses every bone exactly like the original rig (hook 2 is a no-op when absent)', () => {
  const a = original(1400), b = forked(1400);
  for (const r of [a.root, b.root]) { r.position.set(3, .4, -2); r.rotation.y = .7; }
  for (const [motion, speed, mode] of [['idle', 0, 'walk'], ['walk', 1.2, 'walk'], ['run', 7, 'sprint'], ['walk', .5, 'stealth']] as const) for (let k = 0; k < 6; k++) {
    for (const w of [a, b]) { w.brain.motion = motion; w.brain.gaitSpeed = speed; w.brain.phase = k / 6; w.animate(1 + k * .1, motion !== 'idle', undefined, 0, mode); }
    const wa = boneWorlds(a.root), wb = boneWorlds(b.root);
    assert.equal(wa.length, wb.length);
    assert.ok(wa.every((v, i) => Math.abs(v - wb[i]) < 1e-12), `${motion} ${k}`);
  }
});

test('real rig: paws land exactly on the locomotion feet (x2 scale, root-parented legs, tilt) on hills', () => {
  const w = forked(1400), saved = SPRINGS.joint; SPRINGS.joint = 0; // springs off: compare the solved pose itself
  try {
    const layout = { legs: w.loco.legs, hips: w.loco.chains.map(c => c.hipXZ) };
    let x = 0, z = 0, h = .4; const loco = createLocomotion(layout, hills, { x, z, heading: h });
    const p = new THREE.Vector3(); let worstPlanted = 0, exact = 0, total = 0, planted = 0;
    for (let t = 0; t < 4; t += 1 / 120) {
      const v = t < 2 ? 1.2 : 3; h += .2 / 120; x -= Math.sin(h) * v / 120; z -= Math.cos(h) * v / 120;
      const pose = loco.update({ x, z, heading: h, speed: v }, 1 / 120);
      w.root.position.set(x, hills(x, z), z); w.root.rotation.y = h; // as buildScene does: root at the ground under the body
      w.animate(t, true, undefined, 0, 'walk', undefined, pose); w.root.updateMatrixWorld(true);
      w.loco.chains.forEach((c, i) => { c.paw.getWorldPosition(p); const d = p.distanceTo(new THREE.Vector3(pose.feet[i].x, pose.feet[i].y, pose.feet[i].z));
        total++; if (d < 1e-6) exact++; if (pose.contacts[i]) { worstPlanted = Math.max(worstPlanted, d); planted++; } });
    }
    assert.ok(planted > 500);
    assert.ok(worstPlanted < 1e-6, `planted paw off its marker by ${worstPlanted} m`);
    // swing paws are exact whenever the target is within reach (a leashed foot starts its step from out of reach)
    assert.ok(exact / total > .97, `paws on target in ${(100 * exact / total).toFixed(1)} % of leg-frames`);
  } finally { SPRINGS.joint = saved; }
});
