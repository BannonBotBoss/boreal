/** T-0009 port (grok): the rig on main's headless-sim hares. Sim state -> rig action; only hares in the core/interest near
 *  tier get a limb rig (and the nearest HARE.foreLockNearest the fore lock); farther rendered hares and sim-only hares have none. */
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createHares, hareBody, SIM_ACTION, HARE } from '../src/animals/hare';
import { INTEREST, setInterestCentre } from '../src/core/interest';
import type { SimState } from '../src/core/sim';

test('every sim state maps to a rig action; hareBody reads the sim animal', () => {
  const states: SimState[] = ['graze', 'move', 'freeze', 'flee', 'rest', 'stalk', 'chase', 'eat', 'drink'];
  for (const s of states) assert.ok(SIM_ACTION[s], s);
  assert.equal(SIM_ACTION.freeze, 'alert'); assert.equal(SIM_ACTION.flee, 'flee'); assert.equal(SIM_ACTION.graze, 'feed');
  assert.deepEqual(hareBody({ x: 1, z: 2, heading: .5, speed: 3, state: 'flee' }), { x: 1, z: 2, heading: .5, speed: 3, action: 'flee' });
});

test('LOD: the limb rig only inside the near tier, the fore lock on at most the nearest few', () => {
  const near = INTEREST.near; INTEREST.near = 30; setInterestCentre(0, 0);
  try {
    const hares = createHares(new THREE.Scene());
    for (let i = 0; i < 30; i++) hares.update(1 / 30, { x: 0, z: 0, mode: 'walk', moving: false, pouncing: false });
    const list = hares.list(); assert.ok(list.length > 0);
    for (const h of list) {
      const d = Math.hypot(h.sim.x, h.sim.z);
      assert.equal(!!h.rig, d <= INTEREST.near, `hare ${h.id} at ${d.toFixed(1)} m: rig ${!!h.rig}`);
    }
    assert.ok(hares.stats.locked <= HARE.foreLockNearest + 1, `locked ${hares.stats.locked}`);
    assert.equal(hares.stats.rigged, list.filter(h => h.rig).length);
  } finally { INTEREST.near = near; }
});