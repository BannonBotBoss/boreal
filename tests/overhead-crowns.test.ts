/** Overhead crowns follow cover, stay small, and fade in world metres. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { collectCrowns, viewSpan, CROWN_CAP } from '../src/render/trees/overheadCrowns';

test('the field covers the view and fades by world distance, not the screen edge', () => {
  const { hx, hy } = viewSpan(400, 45, 16 / 9);
  assert.ok(hx > hy, 'the frame is wider than it is tall');
  const spots = collectCrowns(hx, hy, () => 1500);
  assert.ok(spots.length > 400 && spots.length <= CROWN_CAP, `count ${spots.length}`);
  let maxEx = 0, maxEz = 0, frameFade = 0, frameN = 0, close = 0;
  const scales: number[] = [];
  const groups = [0, 0, 0];
  const sample = spots.filter((_, i) => i % 23 === 0).slice(0, 80);
  for (const s of spots) {
    const ex = Math.abs(s.x) / hx, ez = Math.abs(s.z) / hy;
    maxEx = Math.max(maxEx, ex);
    maxEz = Math.max(maxEz, ez);
    if (Math.max(ex, ez) < 0.92) {
      frameN++;
      if (s.fade < 0.98) frameFade++;
    }
    scales.push(s.scale);
    groups[s.group]++;
  }
  for (const s of sample) {
    let best = Infinity;
    for (const o of spots) {
      if (o === s) continue;
      const d = (s.x - o.x) ** 2 + (s.z - o.z) ** 2;
      if (d < best) best = d;
    }
    if (Math.sqrt(best) < 8) close++;
  }
  scales.sort((a, b) => a - b);
  assert.ok(maxEx > 0.95 && maxEz > 0.95, `extent ${maxEx.toFixed(2)} ${maxEz.toFixed(2)}`);
  assert.equal(frameFade, 0, `in-frame fade ${frameFade} of ${frameN}`);
  assert.ok(close > 8, `clustered neighbours ${close}`);
  assert.ok(scales[0] < 3.4 && scales[scales.length - 1] > 6 && scales[scales.length - 1] < 8, `spread ${scales[0].toFixed(1)}..${scales[scales.length - 1].toFixed(1)}`);
  assert.ok(groups[0] > groups[2] && groups[2] > 20, `groups ${groups.join(',')}`);
});

test('a low cover sample opens a gap', () => {
  const { hx, hy } = viewSpan(400, 45, 16 / 9);
  const spots = collectCrowns(hx, hy, () => 1500, () => 1, (x, z) => Math.hypot(x, z) < 90 ? 0 : 1);
  const inside = spots.filter(s => Math.hypot(s.x, s.z) < 70).length;
  assert.equal(inside, 0, `trees in the opening ${inside}`);
  assert.ok(spots.length > 100, `trees outside ${spots.length}`);
});
