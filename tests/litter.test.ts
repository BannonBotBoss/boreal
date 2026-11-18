import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ageAfter, besideMother, birthPlaces, bodyRadius, followStep, growthStage, LITTER, pupAct, pupAim, pupScale, separateHerd, stepHz, trailBackM, trailSlot, walkMps } from '../src/core/litter';

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
  const home = pupAim(0, 0, 0, 0, 0, true);
  const caught = followStep(0, 3, 0, 0, 0, 0, 0.05, LITTER.emergeYears, 0, true);
  const hopped = Math.hypot(caught.x, caught.z - 3);
  assert.ok(hopped <= walkMps(LITTER.emergeYears) * 0.05 + 1e-6, 'a short step does not teleport');
  assert.ok(Math.hypot(caught.x - home.x, caught.z - home.z) > 0.5, 'one frame does not flip the pup onto its home');
  let px = 0, pz = 3, pvx = 0, pvz = 0, prevUx = 0, prevUz = 0;
  for (let i = 0; i < 30; i++) {
    const n = followStep(px, pz, 0, 0, 0, 0, 1 / 30, LITTER.emergeYears, 0, true, false, { vx: pvx, vz: pvz });
    const mx = n.x - px, mz = n.z - pz, m = Math.hypot(mx, mz);
    if (m > 1e-5 && i > 0) assert.ok(mx / m * prevUx + mz / m * prevUz > 0.5, `frame ${i} flipped the step`);
    if (m > 1e-5) { prevUx = mx / m; prevUz = mz / m; }
    px = n.x; pz = n.z; pvx = n.vx; pvz = n.vz;
  }
  assert.ok(Math.hypot(px - home.x, pz - home.z) < Math.hypot(home.x, home.z - 3), 'the pup still walks toward the home');
  const loose = pupAim(4, 0, 0, 0, 1, true);
  const tucked = pupAim(4, 0, 0, 0, 1, true, undefined, true);
  assert.ok(Math.hypot(tucked.x, tucked.z) < Math.hypot(loose.x, loose.z), 'a threat pulls the straggler in');
});

test('a piled litter keeps a body gap from mama and from each other', () => {
  const r = bodyRadius(LITTER.emergeYears);
  const piled = [0, 1, 2, 3, 4].map(i => ({ x: 0.04 * i, z: 0.03 * i, r }));
  const out = separateHerd(piled, 0, 0);
  const mama = LITTER.mamaBodyM + r;
  for (const p of out) assert.ok(Math.hypot(p.x, p.z) >= mama - 1e-6, `inside mama at ${Math.hypot(p.x, p.z).toFixed(3)}`);
  for (let i = 0; i < out.length; i++) for (let j = i + 1; j < out.length; j++) {
    const d = Math.hypot(out[i].x - out[j].x, out[i].z - out[j].z);
    assert.ok(d >= r * 2 - 1e-6, `pups ${i} and ${j} overlap at ${d.toFixed(3)}`);
  }
  const grown = bodyRadius(1);
  assert.ok(grown > r, 'an older pup takes more room');
});
