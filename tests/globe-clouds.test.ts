/**
 * T-0221 picture checks against Apollo 17 AS17-148-22727.
 * https://images.nasa.gov/details/as17-148-22727
 * https://visibleearth.nasa.gov/images/1133/the-blue-marble
 *
 * The mask-only tests passed a grey disc. These read the rendered frame.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { ORBIT_DECK, orbitCloudReport } from '../src/world/globe/cloudCover';

const AFTER = 'tasks/evidence/T-0221/after-clouds.png';
const REF = 'tasks/evidence/T-0220/ref-apollo17.png';

function discPixels(file: string) {
  const { width: W, height: H, data } = PNG.sync.read(readFileSync(file));
  const on = new Uint8Array(W * H);
  for (let p = 0; p < W * H; p++) {
    const i = p * 4;
    if (data[i] > 10 || data[i + 1] > 10 || data[i + 2] > 10) on[p] = 1;
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
  return { W, H, data, pix: best };
}

/** Saturated blue, the same cut on the game frame and on Apollo 17. */
function isOcean(r: number, g: number, b: number) {
  const lum = (r + g + b) / 3;
  return b > 60 && b > r + 20 && b > g + 5 && b - r > 25 && lum < 200;
}

export function litDisc(file: string) {
  const { W, data, pix } = discPixels(file);
  let sr = 0, sg = 0, sb = 0, n = 0, blue = 0;
  const bins = new Array(8).fill(0);
  const dark = new Uint8Array(data.length / 4);
  let sx = 0, sy = 0, minx = 1e9, maxx = -1, miny = 1e9, maxy = -1;
  for (const p of pix) {
    const y = (p / W) | 0, x = p - y * W;
    sx += x; sy += y;
    if (x < minx) minx = x; if (x > maxx) maxx = x; if (y < miny) miny = y; if (y > maxy) maxy = y;
  }
  const cx = sx / pix.length, cy = sy / pix.length;
  const lit: [number, number][] = [];
  for (const p of pix) {
    const i = p * 4, r = data[i], g = data[i + 1], b = data[i + 2];
    const lum = (r + g + b) / 3;
    const y = (p / W) | 0, x = p - y * W;
    if (lum < 40) { dark[p] = 1; continue; }
    n++; sr += r; sg += g; sb += b; bins[Math.min(7, lum / 32 | 0)]++; lit.push([x, y]);
    if (isOcean(r, g, b)) blue++;
  }
  const bound: [number, number][] = [];
  for (const [x, y] of lit) {
    const p = y * W + x;
    if (dark[p - 1] || dark[p + 1] || dark[p - W] || dark[p + W]) bound.push([x, y]);
  }
  return {
    mean: [sr / n, sg / n, sb / n] as [number, number, number],
    blue: blue / n,
    bins,
    n,
    straightThrough: straightThrough(bound, cx, cy, Math.hypot((maxx - minx) / 2, (maxy - miny) / 2)),
  };
}

/** True when the day/night boundary is a straight line through the middle of the disc. */
export function straightThrough(bound: [number, number][], cx: number, cy: number, rad: number) {
  if (bound.length < 30 || rad < 20) return false;
  let mx = 0, my = 0;
  for (const [x, y] of bound) { mx += x; my += y; }
  mx /= bound.length; my /= bound.length;
  let sxx = 0, syy = 0, sxy = 0;
  for (const [x, y] of bound) { const dx = x - mx, dy = y - my; sxx += dx * dx; syy += dy * dy; sxy += dx * dy; }
  const tr = sxx + syy, det = sxx * syy - sxy * sxy;
  const lam = tr / 2 + Math.sqrt(Math.max(0, tr * tr / 4 - det));
  let vx = sxy, vy = lam - sxx;
  const vl = Math.hypot(vx, vy) || 1;
  vx /= vl; vy /= vl;
  const nx = -vy, ny = vx;
  let res = 0, minp = 1e9, maxp = -1e9;
  for (const [x, y] of bound) {
    const dx = x - mx, dy = y - my;
    res += (dx * nx + dy * ny) ** 2;
    const t = dx * vx + dy * vy;
    if (t < minp) minp = t; if (t > maxp) maxp = t;
  }
  res = Math.sqrt(res / bound.length);
  const dist = Math.abs((cx - mx) * nx + (cy - my) * ny);
  return res < 0.06 * rad && dist < 0.18 * rad && (maxp - minp) > 1.2 * rad;
}

/** Two peaks with a valley between them. A single haze lump does not qualify. */
export function histogramBimodal(bins: number[]) {
  let best = 0;
  for (let i = 0; i < bins.length; i++) for (let j = i + 2; j < bins.length; j++) {
    let valley = Infinity;
    for (let k = i + 1; k < j; k++) valley = Math.min(valley, bins[k]);
    if (valley < bins[i] && valley < bins[j]) best = Math.max(best, Math.min(bins[i], bins[j]) / Math.max(valley, 1e-9));
  }
  return best >= 1.25;
}

test('a straight diameter through the disc is rejected, an arc is not', () => {
  const line: [number, number][] = [];
  for (let y = 40; y <= 260; y++) line.push([150, y]);
  assert.equal(straightThrough(line, 150, 150, 120), true);
  const arc: [number, number][] = [];
  for (let a = -1; a <= 1; a += 0.04) arc.push([150 + Math.cos(a) * 90, 150 + Math.sin(a) * 90]);
  assert.equal(straightThrough(arc, 150, 150, 120), false);
});

test('lit disc matches Apollo 17: blue ocean, mean colour, bimodal clouds, curved terminator', () => {
  const game = litDisc(AFTER);
  const apollo = litDisc(REF);
  const blueGap = Math.abs(game.blue - apollo.blue);
  assert.ok(blueGap <= 0.15, `saturated blue ${game.blue.toFixed(3)} vs Apollo ${apollo.blue.toFixed(3)} (${(blueGap * 100).toFixed(1)} points)`);
  for (let k = 0; k < 3; k++) {
    const gap = Math.abs(game.mean[k] - apollo.mean[k]) / apollo.mean[k];
    assert.ok(gap <= 0.15, `channel ${k}: ${game.mean[k].toFixed(1)} vs ${apollo.mean[k].toFixed(1)} (${(gap * 100).toFixed(1)}%)`);
  }
  assert.ok(histogramBimodal(game.bins), `cloud histogram not bimodal: ${game.bins.join(',')}`);
  assert.equal(game.straightThrough, false, 'the day/night boundary is a straight line through the disc');
});

test('orbit mask stays a deck of systems, cover near 0.6, longer than speckle', () => {
  const r = orbitCloudReport(360, 180);
  assert.ok(r.cover >= 0.45 && r.cover <= 0.75, `cover ${r.cover.toFixed(3)}`);
  assert.ok(r.corrKm >= ORBIT_DECK.corrKm, `correlation ${r.corrKm.toFixed(0)} km`);
});
