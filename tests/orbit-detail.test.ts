/**
 * T-0220. From 23,572 km a Minimum tile is one vertex every ~310 km, so ice drew as
 * axis-aligned rectangles and the continents were those same vertices. The orbit map
 * is a filtered equirectangular of the bilinear DEM plus surfaceColour, and the cloud
 * deck is the CPU twin of the shell (the shell's octave count is 0 on this tier).
 *
 * Reference disc: Apollo 17 AS17-148-22727, "The Blue Marble", 7 December 1972.
 * https://images.nasa.gov/details/as17-148-22727
 * https://visibleearth.nasa.gov/images/1133/the-blue-marble
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { coarseMetres, coarseMetresLinear } from '../src/world/globe/coarseRelief';
import { bakeOrbitAlbedo, orbitWeight } from '../src/world/globe/orbitAlbedo';
import { orbitCloudReport } from '../src/world/globe/cloudCover';

const REF = 'tasks/evidence/T-0220/ref-apollo17.png';
const BEFORE = 'tasks/evidence/T-0220/before-orbit.png';
const AFTER = 'tasks/evidence/T-0220/after-orbit.png';

/** Near-white components that fill their box the way the coarse ice quads did.
 *  A real cloud deck (Apollo 17) stays under the fill gate. Page chrome sits on
 *  the black background and is dropped with it. */
export function brightBlocks(file: string, thr = 120) {
  const { width: W, height: H, data } = PNG.sync.read(readFileSync(file));
  const bg = new Uint8Array(W * H), br = new Uint8Array(W * H);
  let disc = 0, sr = 0, sg = 0, sb = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4, r = data[i], g = data[i + 1], b = data[i + 2], p = y * W + x;
    if (r < 12 && g < 12 && b < 12) { bg[p] = 1; continue; }
    disc++; sr += r; sg += g; sb += b;
    const mn = Math.min(r, g, b), mx = Math.max(r, g, b);
    if (mn > thr && mx - mn < 60) br[p] = 1;
  }
  const seen = new Uint8Array(W * H), stack: number[] = [];
  let n = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const s = y * W + x;
    if (!br[s] || seen[s]) continue;
    seen[s] = 1; stack.length = 0; stack.push(s);
    let area = 0, minx = x, maxx = x, miny = y, maxy = y, edgeBg = 0;
    while (stack.length) {
      const p = stack.pop()!;
      const py = (p / W) | 0, px = p - py * W;
      area++;
      if (px < minx) minx = px; if (px > maxx) maxx = px; if (py < miny) miny = py; if (py > maxy) maxy = py;
      for (const q of [p - 1, p + 1, p - W, p + W]) {
        if (q < 0 || q >= W * H) { edgeBg++; continue; }
        const qy = (q / W) | 0, qx = q - qy * W;
        if (Math.abs(qx - px) + Math.abs(qy - py) !== 1) continue;
        if (bg[q]) edgeBg++;
        if (seen[q] || !br[q]) continue;
        seen[q] = 1; stack.push(q);
      }
    }
    const w = maxx - minx + 1, h = maxy - miny + 1, fill = area / (w * h);
    if (edgeBg > area * 0.12) continue;
    if (area < 900 || w < 24 || h < 18 || fill < 0.5 || fill > 0.88) continue;
    if (w / h > 2.6 || h / w > 2.6) continue;
    n++;
  }
  return { n, disc, mean: [sr / disc, sg / disc, sb / disc] };
}

test('orbit map: Earth coasts from the bilinear DEM, not a nearest-cell grid', () => {
  assert.ok(coarseMetresLinear(0, -150) < -1000, 'central Pacific is ocean');
  assert.ok(coarseMetresLinear(24, 12) > 0, 'Sahara is land');
  assert.ok(coarseMetresLinear(28, 87) > 1500, 'Himalaya stays high enough for the ice line');
  const step = coarseMetresLinear(28, 87);
  const near = coarseMetres(28, 87);
  assert.ok(Math.abs(step - near) < 800, 'bilinear stays on the same cell as nearest, not a second planet');
  const map = bakeOrbitAlbedo();
  assert.ok(map.landShare > 0.24 && map.landShare < 0.34, `land share ${map.landShare.toFixed(3)} vs ETOPO1 0.292`);
  assert.equal(orbitWeight(23_572_733), 1);
  assert.equal(orbitWeight(100), 0);
});

test('orbit deck: organised cover, not the fine fBm that speckled the disc', () => {
  const r = orbitCloudReport(360, 180);
  assert.ok(r.cover >= 0.45 && r.cover <= 0.75, `cover ${r.cover.toFixed(3)}`);
  assert.ok(r.corrKm >= 220, `autocorrelation ${r.corrKm.toFixed(0)} km`);
});

test('arrival disc: no axis-aligned bright blocks, mean colour within 15% of Apollo 17', () => {
  const ref = brightBlocks(REF);
  const before = brightBlocks(BEFORE);
  const after = brightBlocks(AFTER);
  assert.equal(ref.n, 0, 'Apollo 17 is the negative control: real clouds are not rectangles');
  assert.ok(before.n >= 2, `the coarse disc still has ${before.n} bright blocks`);
  assert.equal(after.n, 0, `the filtered disc has ${after.n} bright blocks`);
  for (let k = 0; k < 3; k++) {
    const gap = Math.abs(after.mean[k] - ref.mean[k]) / ref.mean[k];
    assert.ok(gap <= 0.15, `channel ${k}: ${after.mean[k].toFixed(1)} vs ${ref.mean[k].toFixed(1)} (${(gap * 100).toFixed(1)}%)`);
    const miss = Math.abs(before.mean[k] - ref.mean[k]) / ref.mean[k];
    if (k === 0) assert.ok(miss > 0.25, 'the unfiltered disc is the mismatch the colour check is calibrated on');
  }
});
