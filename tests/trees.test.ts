import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hash, random } from '../src/proc/rng';
import { TREE_FORMS, dbhAt, heightAt } from '../src/core/flora/trees/forms';
import { generateSkeleton } from '../src/render/trees/weberPenn';

const form = TREE_FORMS['black-spruce'];
const wp = { ...form.wp, branches: [0, 40, ...form.wp.branches.slice(2)] }; // buildConifer sets the trunk's whorl count per tree
const sk = (seed: number) => generateSkeleton(wp, 13, .09, random(hash(`tree:test:${seed}`)));

test('trees: black spruce age->height follows the Richards curve (1.3 m at 0, toward hMax 16.5 m)', () => {
  assert.equal(heightAt(form, 0), 1.3);
  const h90 = heightAt(form, 90); assert.ok(h90 > 11 && h90 < 15, `h90=${h90}`);
  assert.ok(heightAt(form, 400) < form.growth.hMax && heightAt(form, 400) > 16);
});
test('trees: DBH inverts Peng et al. 2001 H-DBH (monotone, plausible)', () => {
  const d10 = dbhAt('black-spruce', 10), d15 = dbhAt('black-spruce', 15);
  assert.ok(d10 > 6 && d10 < 16 && d15 > d10, `${d10} ${d15}`);
});
test('trees: the Weber-Penn skeleton is deterministic from the seed and varies between seeds', () => {
  const a = sk(4), b = sk(4), c = sk(5);
  assert.equal(a.stems.length, b.stems.length);
  assert.deepEqual(a.stems.at(-1)!.points.map(p => p.toArray()), b.stems.at(-1)!.points.map(p => p.toArray()));
  assert.notDeepEqual(a.stems.at(-1)!.points.map(p => p.toArray()), c.stems.at(-1)!.points.map(p => p.toArray()));
});
test('trees: spire form: limbs near the top are shorter than at the base of the live crown', () => {
  const s = sk(9), h = s.height, l1 = s.stems.filter(t => t.level === 1 && !t.dead);
  const low = l1.filter(t => t.points[0].y < h * .45), high = l1.filter(t => t.points[0].y > h * .8);
  const mean = (v: typeof l1) => v.reduce((a, t) => a + t.length, 0) / v.length;
  assert.ok(low.length && high.length && mean(high) < mean(low) * .6, `${mean(high)} vs ${mean(low)}`);
});
