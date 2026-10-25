/** T-0009 run 10 (grok): which hares run the fore-stance lock. The embodied hare plus the nearest HARE.foreLockNearest rendered
 * hares (hysteresis at rank n + 1), switched at runtime on the rig (BoundController.setForeLock); headless brains have no rig. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { foreLockPick, HARE } from '../src/animals/hare';
import { createBounding, GIRDLE, selectRow, FORE_LOCK_STATS } from '../src/animals/locomotion/bounding';
import { HOST_GAIT, planFor, poseFor } from '../tools/bound-plans';

const h = (x: number, locked = false, embodied = false) => ({ x, z: 0, locked, embodied });

test('foreLockPick: the n nearest get the lock, an embodied hare always (without taking a slot), rank n + 1 keeps its state', () => {
  assert.equal(HARE.foreLockNearest, 3);
  assert.deepEqual(foreLockPick([h(40), h(5), h(12), h(-8), h(30)], 0, 0), [false, true, true, true, false]);
  assert.deepEqual(foreLockPick([h(40, false, true), h(5), h(12), h(-8), h(30)], 0, 0), [true, true, true, true, false], 'embodied far away still locked');
  assert.deepEqual(foreLockPick([h(1, false, true), h(5), h(12), h(-8), h(30)], 0, 0), [true, true, true, true, false], 'embodied takes no slot');
  // hysteresis: the 4th nearest keeps the lock it had (no flapping when two hares cross ranks), the 5th drops it
  assert.deepEqual(foreLockPick([h(40, true), h(5), h(12), h(-8), h(30, true)], 0, 0), [false, true, true, true, true]);
  assert.deepEqual(foreLockPick([h(1), h(2), h(3)], 100, 0), [true, true, true], 'fewer than n: all locked');
  assert.deepEqual(foreLockPick([], 0, 0), []);
});

test('BoundController.setForeLock switches the lock at runtime: fewer fore solves on, the full scan again off', () => {
  const c = createBounding(planFor('hare'), HOST_GAIT, () => 0, { x: 0, z: 0, heading: 0 }, GIRDLE, { pose: poseFor('hare') });
  const v = 8.5, hz = 60; let n = 0;
  const run = (secs: number) => { const s0 = FORE_LOCK_STATS.solves, N = Math.round(secs * hz); for (let k = 0; k < N; k++, n++) c.update(1 / hz, Math.min(v, v * n / hz / 1.5), 0, null, selectRow(v)); return (FORE_LOCK_STATS.solves - s0) / N; };
  assert.equal(c.foreLock, false); run(2); const off = run(1);
  c.setForeLock(true); assert.equal(c.foreLock, true); run(.5); const on = run(1);
  c.setForeLock(false); run(.5); const back = run(1);
  assert.ok(on < off * .7, `solves/frame on ${on.toFixed(0)} vs off ${off.toFixed(0)}`);
  assert.ok(Math.abs(back - off) < off * .05, `off again ${back.toFixed(0)} vs ${off.toFixed(0)}`);
});

test('headless animals run no limb IK: the headless brains (core/agent, core/sim, core/needs) import nothing from src/animals (no rig, no host)', () => {
  const files: string[] = []; const walk = (d: string) => { for (const e of readdirSync(d)) { const p = join(d, e); if (statSync(p).isDirectory()) walk(p); else if (/\.ts$/.test(e)) files.push(p); } };
  for (const d of ['src/core/agent.ts', 'src/core/agent', 'src/core/sim', 'src/core/needs']) {
    let st; try { st = statSync(d); } catch { continue; }
    if (st.isDirectory()) walk(d); else if (d.endsWith('.ts')) files.push(d);
  }
  assert.ok(files.length > 0);
  const bad = files.filter(f => /from ['"][^'"]*animals\//.test(readFileSync(f, 'utf8')));
  assert.deepEqual(bad, []);
});
