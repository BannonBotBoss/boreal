import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ageAfter, besideMother, birthPlaces, followStep, growthStage, LITTER, pupAct, pupAim, pupScale, stepHz, trailBackM, trailSlot, walkMps } from '../src/core/litter';

test('five pups are born on the den ring at four weeks and walk toward their mother', () => {
  const born = birthPlaces(21.5, 8.5);
  assert.equal(born.length, LITTER.count);
  assert.equal(growthStage(LITTER.emergeYears), 'pup');
  for (const pup of born) {
    assert.ok(Math.abs(Math.hypot(pup.x - 21.5, pup.z - 8.5) - LITTER.denRingM) < 1e-9);
    assert.ok(Math.abs(pup.ageYears - 4 / 52) < 1e-12);
  }
  const slot = trailSlot(0, 0, 0, 0);
  const before = Math.hypot(slot.x, slot.z);
  const stepped = followStep(0, 0, 0, 0, 0, 0, 1);
  assert.ok(Math.hypot(slot.x - stepped.x, slot.z - stepped.z) < before);
  const stayed = followStep(slot.x, slot.z, 0, 0, 0, 0, 1);
  assert.ok(Math.abs(stayed.x - slot.x) < 1e-9 && Math.abs(stayed.z - slot.z) < 1e-9);
  let x = born[0].x, z = born[0].z;
  for (let i = 0; i < 40; i++) ({ x, z } = followStep(x, z, 0, 30, 0, -0.35, 0.5));
  const trail = trailSlot(0, 30, 0, -0.35);
  assert.ok(Math.hypot(x - trail.x, z - trail.z) < Math.hypot(born[0].x - trail.x, born[0].z - trail.z));
});

test('ten real minutes at the default clock grows the litter', () => {
  const tenMin = 7200;
  const older = ageAfter(LITTER.emergeYears, tenMin);
  assert.ok(Math.abs(older - (LITTER.emergeYears + 0.5)) < 1e-9);
  assert.ok(pupScale(older) > pupScale(LITTER.emergeYears) + 0.3);
  assert.ok(trailBackM(older) < trailBackM(LITTER.emergeYears));
  assert.ok(walkMps(older) > walkMps(LITTER.emergeYears));
  assert.ok(stepHz(older) < stepHz(LITTER.emergeYears));
  assert.equal(ageAfter(older, -100), older);
  const young = trailSlot(2, 0, 0, 0, LITTER.emergeYears);
  const grown = trailSlot(2, 0, 0, 0, older);
  assert.ok(Math.hypot(grown.x, grown.z) < Math.hypot(young.x, young.z));
});

test('the litter is a loose clump, not a row, and it moves', () => {
  const at = (time: number, moving: boolean) => {
    const pts = [];
    for (let slot = 0; slot < LITTER.count; slot++) pts.push(pupAim(slot, 0, 0, 0, time, moving));
    return pts;
  };
  const now = at(0, true);
  const later = at(6, true);
  let near = 0;
  const backs = now.map(p => p.z);
  for (const p of now) {
    assert.ok(p.z > 0.05 && p.z < 1.7, `out of the chase view at z ${p.z.toFixed(2)}`);
    assert.ok(Math.abs(p.x) < 1.3, `too wide at x ${p.x.toFixed(2)}`);
    if (Math.hypot(p.x, p.z) < 0.95) near++;
  }
  assert.ok(near >= 2, `only ${near} pups are in the near clump`);
  assert.ok(Math.max(...backs) - Math.min(...backs) > 0.45, 'the spacing is still even');
  const gaps = [...now].sort((a, b) => a.x - b.x).slice(1).map((p, i) => p.x - [...now].sort((a, b) => a.x - b.x)[i].x);
  assert.ok(Math.max(...gaps) - Math.min(...gaps) > 0.08, 'the side gaps are still equal');
  let shifted = 0;
  for (let i = 0; i < now.length; i++) if (Math.hypot(now[i].x - later[i].x, now[i].z - later[i].z) > 0.08) shifted++;
  assert.ok(shifted >= 3, `only ${shifted} pups moved`);
  const headings = new Set(now.map(p => Math.round(p.yaw * 5)));
  assert.ok(headings.size >= 3, 'they still face the same way');
  assert.notEqual(pupAct(0, 0), pupAct(0, 8));
  const stop = at(6, false);
  const reach = (pts: { x: number; z: number }[]) => pts.reduce((s, p) => s + Math.hypot(p.x, p.z), 0) / pts.length;
  assert.ok(reach(stop) < reach(later) * 0.8, 'they do not come in when she stops');
  const left = followStep(0, 0, 1, 40, -12, -0.4, 0.05);
  const slot = trailSlot(1, 40, -12, -0.4);
  assert.ok(Math.abs(left.x - slot.x) < 1e-9 && Math.abs(left.z - slot.z) < 1e-9);
  const nearHer = besideMother(30, 0, -0.35);
  assert.equal(nearHer.length, LITTER.count);
});
