/**
 * The standing sky was clear when the weather reported cloud 0.32.
 * The cirrus dome's old threshold (0.62 − 0.4·C) sits on the mean of the
 * field, so almost no direction gets a veil. domeCoverThreshold is the
 * coverage threshold: the share of directions with a visible veil tracks
 * the reported fraction.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { domeCoverThreshold } from '../src/render/sky';

const fract = (x: number) => x - Math.floor(x);
function hash2s(x: number, y: number, s: number) {
  return fract(Math.sin(x * 127.1 + y * 311.7 + s) * 43758.5453);
}
function vnoise(x: number, y: number, s: number) {
  const i = Math.floor(x), j = Math.floor(y);
  const fx = x - i, fy = y - j;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const a = hash2s(i, j, s), b = hash2s(i + 1, j, s), c = hash2s(i, j + 1, s), d = hash2s(i + 1, j + 1, s);
  return (a * (1 - ux) + b * ux) * (1 - uy) + (c * (1 - ux) + d * ux) * uy;
}
function fbm(x: number, y: number, s: number) {
  let v = 0, a = 0.5;
  for (let i = 0; i < 5; i++) { v += a * vnoise(x, y, s); x = x * 2.03 + 17.1; y = y * 2.03 + 17.1; a *= 0.5; }
  return v;
}
/** The dome's cirrusField, without the wind-shear hook (a small bend). */
function cirrus(uvx: number, uvy: number, seed: number) {
  const sheet = fbm(uvx * 0.5, uvy * 0.5, seed);
  const fibers = fbm(uvx * 0.85 + 3.4, uvy * 4.8 + 3.4, seed);
  const lace = fbm(uvx * 1.55 + 9.1, uvy * 7.2 + 9.1, seed);
  return sheet * 0.38 + fibers * 0.4 + lace * 0.22;
}
const smooth = (e0: number, e1: number, x: number) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

const FIELD = (() => {
  const seed = (1 % 997) * 0.37;
  const ns: number[] = [];
  for (let k = 0; k < 2400; k++) {
    const elev = 0.08 + (k % 24) / 24 * 0.55;
    const ang = k * 2.399;
    const pack = 2.2;
    ns.push(cirrus(Math.cos(ang) / (elev + 0.055) * pack, Math.sin(ang) / (elev + 0.055) * pack, seed));
  }
  return ns;
})();

/** Share of directions whose veil is actually visible. The old line at C=0.32 is about 0.06. */
function visibleFraction(threshold: number) {
  let n = 0;
  for (const v of FIELD) {
    const veil = smooth(threshold - 0.06, threshold + 0.34, v);
    const core = smooth(threshold + 0.14, threshold + 0.46, v);
    const cloud = veil * (1 - core) * 0.38 + core;
    if (cloud > 0.12) n++;
  }
  return n / FIELD.length;
}

test('a reported third of the sky is cloudy, and a clear report stays clear', () => {
  const clear = visibleFraction(domeCoverThreshold(0));
  const scattered = visibleFraction(domeCoverThreshold(0.32));
  const overcast = visibleFraction(domeCoverThreshold(1));
  assert.ok(clear < 0.03, `clear report still drew ${clear.toFixed(3)}`);
  assert.ok(scattered > 0.2 && scattered < 0.5, `cloud 0.32 drew ${scattered.toFixed(3)}, not about a third`);
  assert.ok(overcast > 0.7, `overcast drew ${overcast.toFixed(3)}`);
  // The retired line. It is what made the 15 Aug standing sky look clear.
  const retired = visibleFraction(0.62 - 0.4 * 0.32);
  assert.ok(retired < 0.12, `the old threshold was not the clear-sky defect (${retired.toFixed(3)})`);
  assert.ok(scattered > retired * 3, 'the new threshold must show much more cloud than the old one at 0.32');
});

test('the dome uses the coverage threshold', () => {
  const src = readFileSync(new URL('../src/render/sky.ts', import.meta.url), 'utf8');
  assert.match(src, /domeCoverThreshold\(Math\.max\(w\.cloud/);
  assert.equal(src.includes('0.62 - .4 *'), false);
});
