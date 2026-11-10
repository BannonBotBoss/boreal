/** The spawn wolf is a timber coat, not a white lamp with a yellow rim. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import * as THREE from 'three';
import { dressWolfCoat } from '../src/render/coatFinish';

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
 * The embodied wolf sits in the middle of the ground frame, above the button bar
 * and clear of the senses panel. A blown coat is a near-white core (a person calls
 * it pure white) with a warm rim (the yellow fringe). A timber coat is grey-brown:
 * the same box has no white core.
 */
export function wolfRead(file: string) {
  const { w, h, rgb } = readPng(file);
  const x0 = Math.floor(w * 0.38), x1 = Math.floor(w * 0.62);
  const y0 = Math.floor(h * 0.42), y1 = Math.floor(h * 0.72);
  let white = 0, rim = 0, n = 0, sum = 0;
  const L = (x: number, y: number) => {
    const i = (y * w + x) * 3;
    const R = rgb[i], G = rgb[i + 1], B = rgb[i + 2];
    return { R, G, B, luma: 0.2126 * R + 0.7152 * G + 0.0722 * B, sat: Math.max(R, G, B) - Math.min(R, G, B) };
  };
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const p = L(x, y);
    n++; sum += p.luma;
    const core = p.luma > 220 && p.sat < 40;
    if (!core) continue;
    white++;
    let warm = false;
    for (const [dx, dy] of [[2, 0], [-2, 0], [0, 2], [0, -2], [3, 3], [-3, 2]]) {
      const xx = x + dx, yy = y + dy;
      if (xx < x0 || xx >= x1 || yy < y0 || yy >= y1) continue;
      const q = L(xx, yy);
      if (q.luma > 220 && q.sat < 40) continue;
      if (q.R > 150 && q.R > q.G && q.G >= q.B && q.R - q.B > 25) warm = true;
    }
    if (warm) rim++;
  }
  return { white, rim, mean: +(sum / n).toFixed(1) };
}

/** A person looking at the frame: the wolf is a white shape with a yellow edge. */
export function blownWolf(s: { white: number; rim: number }) {
  return s.white > 250 && s.rim > 30;
}

test('dressing the wolf turns off the lamp fill and caps the coat', () => {
  const mapped = new THREE.MeshStandardMaterial({ map: new THREE.Texture(), color: 0xffffff });
  mapped.emissive.setRGB(1, 0.94, 0.82);
  mapped.emissiveIntensity = 14;
  mapped.emissiveMap = mapped.map;
  mapped.toneMapped = false;
  dressWolfCoat(mapped);
  assert.equal(mapped.emissiveIntensity, 0);
  assert.equal(mapped.emissiveMap, null);
  assert.equal(mapped.toneMapped, true);
  const shader = { fragmentShader: 'void main() {\n#include <opaque_fragment>\n}\n', vertexShader: '' };
  mapped.onBeforeCompile?.(shader as never, {} as never);
  assert.match(shader.fragmentShader, /vec3 saddle = vec3\(0\.16, 0\.14, 0\.12\)/);
  assert.match(shader.fragmentShader, /coat = min\(coat, vec3\(0\.46\)\)/);
  assert.doesNotMatch(shader.fragmentShader, /vec3\(0\.42, 0\.36, 0\.28\)/);
});

test('the spawn frame is a white wolf with a yellow rim, and the fix is not', () => {
  const before = wolfRead('tasks/evidence/T-0190/before-ground.png');
  assert.equal(blownWolf(before), true, `before white ${before.white} rim ${before.rim}`);
  const after = wolfRead('tasks/evidence/T-0190/after-ground.png');
  assert.equal(blownWolf(after), false, `after white ${after.white} rim ${after.rim} mean ${after.mean}`);
  assert.ok(after.white < 80, `after still has a white core (${after.white})`);
});
