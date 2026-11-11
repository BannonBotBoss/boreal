/** Overhead crowns fill the nadir rectangle from the stand placement, and fade at the edge. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { collectCrowns, viewSpan, CROWN_CAP } from '../src/render/trees/overheadCrowns';

test('the field covers the view rectangle and fades at the edge, not in a circle', () => {
  const { hx, hy } = viewSpan(400, 45, 16 / 9);
  assert.ok(hx > hy, 'the frame is wider than it is tall');
  const spots = collectCrowns(hx, hy, () => 1500);
  assert.ok(spots.length > 400 && spots.length <= CROWN_CAP, `count ${spots.length}`);
  let maxEx = 0, maxEz = 0, edgeFade = 0, mid = 0, close = 0;
  const sample = spots.filter((_, i) => i % 23 === 0).slice(0, 60);
  for (const s of spots) {
    maxEx = Math.max(maxEx, Math.abs(s.x) / hx);
    maxEz = Math.max(maxEz, Math.abs(s.z) / hy);
    if (s.fade < 0.95) edgeFade++;
    else mid++;
  }
  for (const s of sample) {
    let best = Infinity;
    for (const o of spots) {
      if (o === s) continue;
      const d = (s.x - o.x) ** 2 + (s.z - o.z) ** 2;
      if (d < best) best = d;
    }
    if (Math.sqrt(best) < 6) close++;
  }
  assert.ok(maxEx > 0.9 && maxEz > 0.9, `extent ${maxEx.toFixed(2)} ${maxEz.toFixed(2)}`);
  assert.ok(edgeFade > 20 && mid > 100, `fade ${edgeFade} full ${mid}`);
  assert.ok(close > 5, `clustered neighbours ${close}`);
  const scales = new Set(spots.map(s => Math.round(s.scale * 20)));
  assert.ok(scales.size > 8, 'scales vary');
});
