/** T-0064 (grok-play; proposed under T-0044, then briefly T-0061): the snowshoe hare is a Playable. Reuses T-0009's createHareModel/poseHare, HARE_NEEDS speeds and stamina,
 *  and the same playerSpeed/pounceSpeed as the wolf; the wolf's numbers must not move. */
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { PLAYABLES, playable } from '../src/render/playables';
import { playerSpeed, pounceSpeed, PLAYER } from '../src/core/playerTuning';
import { HARE_NEEDS, WOLF_NEEDS } from '../src/core/needs/species';
import { staminaRates } from '../src/core/needs/engine';
import { createHares } from '../src/animals/hare';
import type { WolfMode } from '../src/core/wolfModes';

test('the wolf is unchanged: base 2 / 4 / 7 x the feel scale, old pounce rule', () => {
  assert.deepEqual((['walk', 'run', 'sprint', 'stealth', 'super-stealth'] as WolfMode[]).map(m => playerSpeed(m)), [2, 6, 10.5, .8, .35]);
  assert.deepEqual((['walk', 'run', 'sprint', 'stealth', 'super-stealth'] as WolfMode[]).map(m => playerSpeed(m, WOLF_NEEDS)), [2, 6, 10.5, .8, .35]);
  assert.equal(pounceSpeed(0), 8); assert.equal(pounceSpeed(10), 11.5); assert.equal(pounceSpeed(0, WOLF_NEEDS), 8);
});

test('the hare: sourced walk 1.2 and gallop 2.91 m/s, never faster than its burst speed (12.5 m/s, ECCC)', () => {
  const v = (m: WolfMode) => playerSpeed(m, HARE_NEEDS);
  assert.equal(v('walk'), HARE_NEEDS.body.speeds.walk.v);
  assert.ok(Math.abs(v('run') - HARE_NEEDS.body.speeds.run.v * PLAYER.speedScale.run) < 1e-9);
  assert.ok(v('sprint') <= HARE_NEEDS.behaviour.evasion.burstSpeed.v && v('sprint') >= HARE_NEEDS.body.speeds.sprint.v);
  assert.ok(v('stealth') < v('walk') && v('super-stealth') < v('stealth')); // stealth keeps the wolf's ratio to walk
});

test('a hare leap is shorter than a wolf pounce (burst speed ratio), and still carries a run', () => {
  assert.ok(pounceSpeed(0, HARE_NEEDS) < pounceSpeed(0) && pounceSpeed(0, HARE_NEEDS) > 0);
  assert.equal(pounceSpeed(10, HARE_NEEDS), 11.5);
});

test('the hare is a playable: available, eats by gathering, own needs and stamina, and is created from the T-0009 rig', () => {
  const p = PLAYABLES.find(x => x.id === 'hare')!; assert.ok(p.available); assert.equal(playable('hare').id, 'hare');
  assert.deepEqual(p.actions, ['gather']); assert.equal(p.threat, false);
  assert.ok(staminaRates(HARE_NEEDS).sprint > staminaRates(WOLF_NEEDS).sprint); // 8 s vs 12 s
  const rig = p.create(); assert.ok(rig.root instanceof THREE.Object3D && rig.sensor.parent === rig.root);
  let skinned = 0; rig.root.traverse(o => { if ((o as THREE.SkinnedMesh).isSkinnedMesh) skinned++; }); assert.ok(skinned > 0, 'furred skin');
  rig.brain.speed = 8.5; rig.root.position.set(5, 2, 5);
  for (let i = 0; i < 20; i++) rig.animate({ time: i / 30, dt: 1 / 30, moving: true, elapsed: 0, mode: 'sprint' });
  assert.ok(rig.root.position.toArray().every(Number.isFinite));
  rig.animate({ time: 1, dt: 1 / 30, moving: false, action: 'gather', elapsed: .5, mode: 'walk' }); // eating pose
  assert.ok(rig.root.position.toArray().every(Number.isFinite));
});

test('NPC hares do not flee an embodied hare (not a predator), and fear the wolf again when it is one', () => {
  const run = (predator: boolean) => {
    const hares = createHares(new THREE.Scene());
    for (let i = 0; i < 60; i++) hares.update(1 / 30, { x: 0, z: 0, mode: 'run', moving: true, pouncing: false, predator });
    // walk straight at the nearest hare; count hares that noticed (left grazing)
    const h = [...hares.list()].sort((a, b) => Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z))[0];
    for (let i = 0; i < 300; i++) hares.update(1 / 30, { x: h.sim.x + 1, z: h.sim.z, mode: 'sprint', moving: true, pouncing: false, predator });
    return hares.list().filter(x => x.state === 'flee' || x.state === 'freeze').length;
  };
  assert.ok(run(true) > 0, 'a wolf-like player scares hares');
  assert.equal(run(false), 0, 'a hare player does not');
});
