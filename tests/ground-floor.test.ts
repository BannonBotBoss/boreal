/** The spawn ground is thatch, soil and live grass, not one lawn. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import * as THREE from 'three';
import { setGroundFloor, terrainMaterial } from '../src/render/pbr';

function readPng(file: string) {
  const buf = readFileSync(file);
  let o = 8, w = 0, h = 0, color = 0;
  const idat: Buffer[] = [];
  while (o < buf.length) {
    const len = buf.readUInt32BE(o); o += 4;
    const type = buf.subarray(o, o + 4).toString('ascii'); o += 4;
    const data = buf.subarray(o, o + len); o += len + 4;
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); color = data[9]; }
    else if (type === 'IDAT') idat.push(Buffer.from(data));
    else if (type === 'IEND') break;
  }
  const bpp = color === 6 ? 4 : 3, stride = w * bpp, raw = inflateSync(Buffer.concat(idat));
  const rgb = new Uint8Array(w * h * 3);
  const prior = new Uint8Array(stride), row = new Uint8Array(stride);
  let p = 0;
  for (let y = 0; y < h; y++) {
    const filter = raw[p++];
    for (let i = 0; i < stride; i++) {
      const x = raw[p++], a = i >= bpp ? row[i - bpp] : 0, b = prior[i], c = i >= bpp ? prior[i - bpp] : 0;
      let v = x;
      if (filter === 1) v = (x + a) & 255;
      else if (filter === 2) v = (x + b) & 255;
      else if (filter === 3) v = (x + Math.floor((a + b) / 2)) & 255;
      else if (filter === 4) {
        const pr = a + b - c, pa = Math.abs(pr - a), pb = Math.abs(pr - b), pc = Math.abs(pr - c);
        v = (x + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 255;
      }
      row[i] = v;
    }
    prior.set(row);
    for (let x = 0; x < w; x++) {
      const s = (y * w + x) * 3, i = x * bpp;
      rgb[s] = row[i]; rgb[s + 1] = row[i + 1]; rgb[s + 2] = row[i + 2];
    }
  }
  return { w, h, rgb };
}

/**
 * Foreground ground, left and right of the wolf, above the button bar.
 * A lawn pixel is green-dominant and dark. A thatch or soil pixel is browner
 * than it is green. A person calls the before frame one flat green lawn.
 */
export function floorRead(file: string) {
  const { w, h, rgb } = readPng(file);
  const boxes = [
    [0.12, 0.34, 0.58, 0.70],
    [0.68, 0.88, 0.56, 0.68],
  ];
  let n = 0, lawn = 0, brown = 0;
  for (const [xa, xb, ya, yb] of boxes) {
    const x0 = Math.floor(w * xa), x1 = Math.floor(w * xb);
    const y0 = Math.floor(h * ya), y1 = Math.floor(h * yb);
    for (let y = y0; y < y1; y += 2) for (let x = x0; x < x1; x += 2) {
      const i = (y * w + x) * 3;
      const R = rgb[i], G = rgb[i + 1], B = rgb[i + 2];
      n++;
      if (G > R + 6 && G > B + 4 && G < 140) lawn++;
      if (R > 70 && R > G + 5 && G > B) brown++;
    }
  }
  return { lawn: +(lawn / n).toFixed(3), brown: +(brown / n).toFixed(3), n };
}

/** One green lawn: almost every ground pixel is green, and brown thatch is absent. */
export function flatLawn(s: { lawn: number; brown: number }) {
  return s.lawn > 0.85 && s.brown < 0.03;
}

test('prairie feet use thatch and soil, boreal feet use litter', () => {
  setGroundFloor('prairie');
  const mat = terrainMaterial();
  const shader = { fragmentShader: '#include <color_fragment>\n#include <roughnessmap_fragment>\n#include <normal_fragment_maps>\n', vertexShader: '#include <begin_vertex>\n', uniforms: {} as Record<string, { value: number }> };
  mat.onBeforeCompile(shader as never, {} as never);
  assert.match(shader.fragmentShader, /vec3 thatch = vec3\(0\.34, 0\.24, 0\.11\)/);
  assert.match(shader.fragmentShader, /vec3 mossC = vec3\(0\.045, 0\.09, 0\.028\)/);
  assert.equal(shader.uniforms.uFloor.value, 1);
  setGroundFloor('boreal');
  assert.equal(shader.uniforms.uFloor.value, 0);
});

test('the spawn ground is one green lawn, and the fix is not', () => {
  const before = floorRead('tasks/evidence/T-0191/before-ground.png');
  assert.equal(flatLawn(before), true, `before lawn ${before.lawn} brown ${before.brown}`);
  const after = floorRead('tasks/evidence/T-0191/after-ground.png');
  assert.equal(flatLawn(after), false, `after lawn ${after.lawn} brown ${after.brown}`);
  assert.ok(after.brown > 0.12, `thatch share ${after.brown} is still a lawn`);
});
