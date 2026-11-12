/**
 * T-0221. The Minimum orbit deck on main (T-0220) was a five-octave 420 km fBm.
 * That is salt-and-pepper: the land disappeared and the terminator went with the
 * fully lit disc. The deck is now the shell's domain warp plus a zonal amount
 * (ITCZ, subtropical minimum, storm tracks).
 *
 * Reference disc: Apollo 17 AS17-148-22727, "The Blue Marble", 7 December 1972.
 * https://images.nasa.gov/details/as17-148-22727
 * https://visibleearth.nasa.gov/images/1133/the-blue-marble
 * Side by side: tasks/evidence/T-0221/side-reference.png
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { hash2u } from '../src/proc/rng';
import { ORBIT_DECK, orbitCloudReport } from '../src/world/globe/cloudCover';

const AFTER = 'tasks/evidence/T-0221/after-clouds.png';

/** Longitude lag, in km, where a row's autocorrelation falls below one half. */
function corrKm(row: number[], latDeg: number) {
  const w = row.length;
  const m = row.reduce((a, b) => a + b, 0) / w;
  let v = 0;
  for (const x of row) v += (x - m) * (x - m);
  if (v < 1e-4) return Infinity;
  const km = 40075 * Math.cos(latDeg * Math.PI / 180) / w;
  for (let lag = 1; lag < w / 2; lag++) {
    let c = 0;
    for (let i = 0; i < w; i++) c += (row[i] - m) * (row[(i + lag) % w] - m);
    if (c / v < 0.5) return lag * km;
  }
  return (w / 2) * km;
}

/** Largest non-black component, split at its own midline. Night over day. */
function terminator(file: string) {
  const { width: W, height: H, data } = PNG.sync.read(readFileSync(file));
  const on = new Uint8Array(W * H);
  for (let p = 0; p < W * H; p++) {
    const i = p * 4;
    if (data[i] > 14 || data[i + 1] > 14 || data[i + 2] > 14) on[p] = 1;
  }
  const seen = new Uint8Array(W * H);
  const stack: number[] = [];
  let best: number[] = [];
  for (let s = 0; s < W * H; s++) {
    if (!on[s] || seen[s]) continue;
    seen[s] = 1; stack.length = 0; stack.push(s);
    const pix: number[] = [];
    while (stack.length) {
      const p = stack.pop()!;
      pix.push(p);
      const y = (p / W) | 0, x = p - y * W;
      for (const q of [p - 1, p + 1, p - W, p + W]) {
        if (q < 0 || q >= W * H || seen[q] || !on[q]) continue;
        const qy = (q / W) | 0, qx = q - qy * W;
        if (Math.abs(qx - x) + Math.abs(qy - y) !== 1) continue;
        seen[q] = 1; stack.push(q);
      }
    }
    if (pix.length > best.length) best = pix;
  }
  let sx = 0, sl = 0, sr = 0, ln = 0, rn = 0, green = 0;
  for (const p of best) { const y = (p / W) | 0; sx += p - y * W; }
  const mid = sx / best.length;
  for (const p of best) {
    const i = p * 4, r = data[i], g = data[i + 1], b = data[i + 2];
    const y = (p / W) | 0, x = p - y * W, lum = (r + g + b) / 3;
    if (g > r + 8 && g > b && g > 28) green++;
    if (x < mid) { sl += lum; ln++; } else { sr += lum; rn++; }
  }
  const bright = Math.max(sl / ln, sr / rn), dark = Math.min(sl / ln, sr / rn);
  return { darkOverBright: dark / bright, green: green / best.length };
}

test('orbit clouds: cover 0.5–0.75 and the autocorrelation is not speckle', () => {
  const r = orbitCloudReport(360, 180);
  assert.ok(r.cover >= 0.5 && r.cover <= 0.75, `cover ${r.cover.toFixed(3)}`);
  assert.ok(r.clear >= 0.15, `clear area ${r.clear.toFixed(3)} (subtropical holes)`);
  assert.ok(r.corrKm >= ORBIT_DECK.corrKm, `correlation ${r.corrKm.toFixed(0)} km`);
  // Independent pixels, the failure the 420 km five-octave deck produced.
  const speckle = Array.from({ length: 360 }, (_, i) => hash2u(i, 40, 2) > 0.4 ? 1 : 0);
  const speckKm = corrKm(speckle, 0);
  assert.ok(speckKm < 150, `speckle control correlated out to ${speckKm.toFixed(0)} km`);
  assert.ok(r.corrKm > speckKm * 3, 'the deck is several times longer than speckle');
});

test('arrival frame: the sun still cuts a terminator, and some land stays visible', () => {
  const t = terminator(AFTER);
  assert.ok(t.darkOverBright < 0.75, `night/day ${t.darkOverBright.toFixed(2)} (a face-on disc is about 1)`);
  assert.ok(t.green > 0.03, `green land fraction ${t.green.toFixed(3)}`);
});
