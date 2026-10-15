import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { quadrupedPose, limbOf, bendsForward } from '../src/core/animalBehavior';
import { buildBody } from '../src/core/body';
import { BEAR_BONE_COUNT, BEAR_LEGS, BEAR_SKULL, BEAR_TUBE, bearCoat, bearTubes } from '../src/core/bearBody';

const body = buildBody(bearTubes(bearCoat('grizzly'))), n = body.position.length / 3;

test('bear skin is consistent: finite, fully weighted, within the skeleton, faces outward', () => {
  assert.ok(body.position.every(Number.isFinite) && body.skinIndex.every(i => i < BEAR_BONE_COUNT));
  for (let v = 0; v < n; v++) assert.ok(Math.abs(body.skinWeight.slice(v * 4, v * 4 + 4).reduce((a, b) => a + b, 0) - 1) < 1e-9);
  let volume = 0;
  for (let t = 0; t < body.index.length; t += 3) {
    const [A, B, C] = [0, 1, 2].map(k => body.position.slice(body.index[t + k] * 3, body.index[t + k] * 3 + 3));
    volume += (A[0] * (B[1] * C[2] - B[2] * C[1]) + A[1] * (B[2] * C[0] - B[0] * C[2]) + A[2] * (B[0] * C[1] - B[1] * C[0])) / 6;
  }
  assert.ok(volume > .3 && volume < 1.5, `volume ${volume} m³ (a 300 kg bear is about 0.3 m³ of flesh, plus fur volume in the skin)`);
});

test('bear IK at every speed: feet reach targets, stance feet planted, joints bend the right way, soles level', () => {
  for (const [motion, speed] of [['idle', 0], ['walk', .6], ['walk', 1.2], ['run', 3], ['run', 6]] as const) for (let k = 0; k < 40; k++) {
    const phase = k / 40, pose = quadrupedPose(motion, phase, 0, BEAR_LEGS, speed);
    pose.legs.forEach((_, i) => {
      const L = limbOf(BEAR_LEGS, i), J = pose.joints[i], A1 = pose.legs[i] + pose.girdles[i], A2 = A1 + pose.knees[i], A3 = A2 + pose.wrists[i];
      const heel = { z: J.z - Math.sin(A1) * L.upper - Math.sin(A2) * L.lower, y: J.y - Math.cos(A1) * L.upper - Math.cos(A2) * L.lower };
      const toe = { z: heel.z - Math.sin(A3) * (L.foot ?? 0), y: heel.y - Math.cos(A3) * (L.foot ?? 0) };
      const where = `${motion}@${speed} leg ${i} phase ${phase}`;
      assert.ok(Math.abs(toe.z - pose.feet[i].z) < 1e-6 && Math.abs(toe.y - pose.feet[i].y) < 1e-6, `${where} misses target`);
      assert.ok(heel.y > -1e-6, `${where}: heel below ground`);
      assert.ok(bendsForward(BEAR_LEGS, i) ? pose.knees[i] <= 1e-9 : pose.knees[i] >= -1e-9, `${where}: middle joint bends the wrong way`);
      assert.ok(Math.abs(A3 + pose.paws[i]) < 1e-9, `${where}: toes not level`);
    });
  }
});

test('plantigrade standing: the whole foot is down — heels within a few cm of the ground, rear heel nearly flat', () => {
  const p = quadrupedPose('idle', 0, 0, BEAR_LEGS, 0);
  p.legs.forEach((_, i) => {
    const L = limbOf(BEAR_LEGS, i), angle = p.legs[i] + p.girdles[i] + p.knees[i] + p.wrists[i], heel = (L.foot ?? 0) * Math.cos(angle);
    assert.ok(heel < (i % 2 ? .025 : .05), `leg ${i} heel ${heel.toFixed(3)} m above the ground`);
  });
});

test('grizzly silhouette: shoulder hump is the highest point of the back; a black bear has none', () => {
  const top = (b: typeof body, z0: number, z1: number) => Math.max(...Array.from({ length: b.position.length / 3 }, (_, v) => v)
    .filter(v => b.tube[v] <= BEAR_TUBE.hump && b.position[v * 3 + 2] > z0 && b.position[v * 3 + 2] < z1).map(v => b.position[v * 3 + 1]));
  const shoulder = top(body, -.5, -.15), rump = top(body, .4, .8);
  assert.ok(shoulder > rump + .05, `hump ${shoulder.toFixed(2)} vs rump ${rump.toFixed(2)}`);
  assert.ok(shoulder > 1 && shoulder < 1.2, `shoulder height ${shoulder.toFixed(2)} m`);
  const black = buildBody(bearTubes(bearCoat('black'), 'black'));
  assert.ok(top(black, -.5, -.15) < shoulder - .04, 'black bear: no hump');
});

test('dished face: the bridge dips below the straight line from forehead to nose', () => {
  const topAt = (i: number) => BEAR_SKULL[i][1] + BEAR_SKULL[i][3], zAt = (i: number) => BEAR_SKULL[i][0];
  const [a, d, b] = [2, 3, 5], line = topAt(a) + (topAt(b) - topAt(a)) * (zAt(d) - zAt(a)) / (zAt(b) - zAt(a));
  assert.ok(topAt(d) < line - .02, `dish depth ${(line - topAt(d)).toFixed(3)} m`);
  assert.ok(BEAR_SKULL[1][2] > BEAR_SKULL[5][2] * 1.8, 'broad skull, much wider than the snout');
});

test('rendered bear: stands on the ground, five claws per paw, fur covers the body', async () => {
  const { createBear } = await import('../src/render/bear');
  const bear = createBear(1, 'grizzly');
  const box = new THREE.Box3().setFromObject(bear.root);
  assert.ok(Math.abs(box.min.y) < .03, `lowest point ${box.min.y.toFixed(3)} m`);
  assert.ok(box.max.y > 1.05 && box.max.y < 1.35, `top ${box.max.y.toFixed(2)} m (hump plus fur)`);
  assert.equal(bear.root.getObjectsByProperty('name', 'claw').length, 20);
  const fur = bear.root.getObjectByName('fur') as THREE.SkinnedMesh;
  assert.ok(fur.geometry.getAttribute('position').count > 25000 * 5 * .9);
});
