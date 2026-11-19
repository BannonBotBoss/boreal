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
  let minD = Infinity;
  for (let i = 0; i < now.length; i++) for (let j = i + 1; j < now.length; j++) minD = Math.min(minD, Math.hypot(now[i].x - now[j].x, now[i].z - now[j].z));
  assert.ok(minD >= 0.55, `pups share one patch (${minD.toFixed(2)} m)`);
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
  const caught = followStep(0, 3, 0, 0, 0, 0, 0.05, LITTER.emergeYears, 0, true);
  const home = pupAim(0, 0, 0, 0, 0, true);
  assert.ok(Math.hypot(caught.x - home.x, caught.z - home.z) < 0.05, 'a pup behind the chase view steps back into it');
  const loose = pupAim(4, 0, 0, 0, 1, true);
  const tucked = pupAim(4, 0, 0, 0, 1, true, undefined, true);
  assert.ok(Math.hypot(tucked.x, tucked.z) < Math.hypot(loose.x, loose.z), 'a threat pulls the straggler in');
});

test('wasm litter_follow and litter_separate keep bodies apart', async () => {
  const { readFileSync } = await import('node:fs');
  const bytes = readFileSync(new URL('../public/wasm/boreal_sim.wasm', import.meta.url));
  const { instance } = await WebAssembly.instantiate(bytes, {});
  const x = instance.exports as {
    memory: WebAssembly.Memory;
    litter_scratch(n: number): number;
    litter_body_radius(age: number): number;
    litter_follow(x: number, z: number, slot: number, mx: number, mz: number, yaw: number, dt: number, age: number, time: number, moving: number, threatened: number, vx: number, vz: number, out: number): void;
    litter_separate(n: number, data: number, mx: number, mz: number): void;
  };
  const out = x.litter_scratch(4);
  x.litter_follow(0, 0, 0, 10, 0, 0, 0.2, 4 / 52, 1, 1, 0, 0, 0, out);
  const stepped = new Float64Array(x.memory.buffer, out, 4);
  assert.ok(Number.isFinite(stepped[0]) && Number.isFinite(stepped[1]));
  const n = 2;
  const data = x.litter_scratch(n * 3);
  const buf = new Float64Array(x.memory.buffer, data, n * 3);
  const radius = x.litter_body_radius(4 / 52);
  buf.set([0, 0, radius, 0.01, 0, radius]);
  x.litter_separate(n, data, 5, 0);
  const after = new Float64Array(x.memory.buffer, data, n * 3);
  const gap = Math.hypot(after[0] - after[3], after[1] - after[4]);
  assert.ok(gap >= radius * 2 - 1e-6, `pup bodies overlap: gap ${gap} need ${radius * 2}`);
});
