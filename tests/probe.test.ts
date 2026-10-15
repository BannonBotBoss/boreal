import test from 'node:test'; import assert from 'node:assert/strict';
import { isIntegrated, probeCap, cachedProbe, saveProbe, median, PROBE } from '../src/core/probe';
import { GOVERNOR, LADDER, applied, governFrame, resetGovernor } from '../src/core/quality';
const mem = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) }; };
test('fast discrete GPU keeps Ultra; slow bench, weak GPU or low memory lower the cap', () => {
  assert.equal(probeCap({ renderer: 'RTX', gpuTier: 3, maxTexture: 16384, deviceMemory: 8, cores: 16, benchMs: 9 }).cap, 0);
  assert.equal(probeCap({ renderer: 'x', benchMs: 30 }).cap, 3);            // 30 × .47 = 14.1 ≤ 14.2
  assert.equal(probeCap({ renderer: 'x', benchMs: 80 }).cap, LADDER.length - 1);
  assert.equal(probeCap({ renderer: 'x', gpuTier: 0 }).cap, LADDER.length - 1);
  assert.equal(probeCap({ renderer: 'x', gpuTier: 3, deviceMemory: 2 }).cap, 3);
  assert.equal(probeCap({ renderer: 'x', gpuTier: 1, benchMs: 8 }).cap, 0, 'measured bench beats a stale detect-gpu tier');
  assert.equal(probeCap({ renderer: 'x' }).cap, 0, 'no evidence, no cap (the governor still steps down)');
});
test('cap is monotone in bench time and relCost is non-increasing', () => {
  let last = 0; for (let ms = 1; ms < 120; ms++) { const c = probeCap({ renderer: 'x', benchMs: ms }).cap; assert.ok(c >= last); last = c; }
  for (let i = 1; i < PROBE.relCost.length; i++) assert.ok(PROBE.relCost[i] <= PROBE.relCost[i - 1]);
  assert.equal(PROBE.relCost.length, LADDER.length);
});
test('cache is per renderer string', () => {
  const s = mem(); saveProbe(s, { renderer: 'A', benchMs: 10 });
  assert.equal(cachedProbe(s, 'A')?.cap, 0); assert.equal(cachedProbe(s, 'B'), undefined);
});
test('governor never climbs above the probe cap', () => {
  const save = { ...GOVERNOR }; GOVERNOR.auto = true; GOVERNOR.probeCap = 2; GOVERNOR.tier = 3; resetGovernor();
  for (let i = 0; i < 300; i++) { governFrame(2, 2, 16); assert.ok(GOVERNOR.tier >= GOVERNOR.probeCap); }
  assert.equal(GOVERNOR.tier, 2); assert.equal(applied(0).name, LADDER[2].name);
  Object.assign(GOVERNOR, save, { probeCap: 0 }); resetGovernor();
});
test('median', () => { assert.equal(median([5, 1, 100]), 5); assert.equal(median([1, 2, 3, 4]), 2.5); });
test('iGPU flagged from the unmasked renderer', () => {
  assert.ok(isIntegrated('ANGLE (Intel, Intel(R) UHD Graphics (0x0000A7A0) Direct3D11)'));
  assert.ok(!isIntegrated('ANGLE (NVIDIA, NVIDIA GeForce RTX 5060 Laptop GPU (0x00002D19) Direct3D11)'));
  assert.ok(probeCap({ renderer: 'Intel(R) Iris(R) Xe Graphics' }).igpu);
});
test('sustained headroom lifts the probe cap one tier at a time', () => {
  const save = { ...GOVERNOR }; let raised = -1; Object.assign(GOVERNOR, { auto: true, capTier: 0, probeCap: 3, tier: 3, probeHits: 0, onProbeRaise: (c: number) => { raised = c; } }); resetGovernor();
  for (let i = 0; i < 400; i++) governFrame(2, 2, 16); // ~6 s of 2 ms frames: 2 windows → not yet
  assert.equal(GOVERNOR.probeCap, 3);
  for (let i = 0; i < 400; i++) governFrame(2, 2, 16);
  assert.equal(GOVERNOR.probeCap, 2); assert.equal(raised, 2); assert.equal(GOVERNOR.tier, 2);
  Object.assign(GOVERNOR, save, { probeCap: 0, probeHits: 0, onProbeRaise: undefined }); resetGovernor();
});
