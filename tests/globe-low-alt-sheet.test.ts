import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { cloudClear } from '../src/world/globe/transition';
import { PLANET } from '../src/world/globe/planet';

/** 8-bit RGB or RGBA PNG, no interlace. The gate below is the T-0056 lower-half sheet metric. */
function readPng(file: string) {
  const buf = readFileSync(file);
  assert.equal(buf.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  let o = 8, w = 0, h = 0, depth = 0, color = 0, interlace = 1;
  const idat: Buffer[] = [];
  while (o < buf.length) {
    const len = buf.readUInt32BE(o); o += 4;
    const type = buf.subarray(o, o + 4).toString('ascii'); o += 4;
    const data = buf.subarray(o, o + len); o += len + 4;
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); depth = data[8]; color = data[9]; interlace = data[12]; }
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
  }
  assert.equal(depth, 8); assert.ok(color === 2 || color === 6); assert.equal(interlace, 0);
  const bpp = color === 2 ? 3 : 4, stride = w * bpp, raw = inflateSync(Buffer.concat(idat));
  const rgb = new Uint8Array(w * h * 3), prior = new Uint8Array(stride), row = new Uint8Array(stride);
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
      } else if (filter !== 0) throw new Error(`png filter ${filter}`);
      row[i] = v;
    }
    prior.set(row);
    for (let x = 0; x < w; x++) { const s = (y * w + x) * 3, i = x * bpp; rgb[s] = row[i]; rgb[s + 1] = row[i + 1]; rgb[s + 2] = row[i + 2]; }
  }
  return { w, h, rgb };
}

/** Lower half (y from 55%), viewport as captured. Beige and luma match tasks/T-0056. */
function lowerHalf(file: string) {
  const { w, h, rgb } = readPng(file);
  const y0 = Math.floor(h * 0.55);
  let n = 0, r = 0, g = 0, b = 0, l2 = 0, beige = 0;
  for (let y = y0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 3, R = rgb[i], G = rgb[i + 1], B = rgb[i + 2];
    const L = 0.2126 * R + 0.7152 * G + 0.0722 * B;
    r += R; g += G; b += B; l2 += L * L; n++;
    if (R > 170 && G > 150 && B > 110 && R + 15 > G && G + 10 > B) beige++;
  }
  const meanL = (0.2126 * r + 0.7152 * g + 0.0722 * b) / n;
  const stdL = Math.round(Math.sqrt(Math.max(0, l2 / n - meanL * meanL)) * 10) / 10;
  return { n, stdL, beige: Math.round(1000 * beige / n) / 1000, mean: [r / n, g / n, b / n] };
}

const dir = 'tasks/evidence/2026-10-23-grok-t0056';
/** Flat beige sheet: the known-bad gate. Open ground is the pass. */
const isSheet = (s: { beige: number; stdL: number }) => s.beige >= 0.95 && s.stdL <= 4;
const isOpen = (s: { beige: number; stdL: number }) => s.beige <= 0.05 && s.stdL >= 8;

test('T-0056: the known-bad 3000 m sheet fails the gate and the fixed render passes', () => {
  // Recorded mismatch from the 10:25 run (issue #43 URL, SwiftShader): luma std 2.0, beige 1.
  const recorded = lowerHalf(`${dir}/known-bad-1016-alt3000.png`);
  assert.equal(isSheet(recorded), true, `recorded sheet ${JSON.stringify(recorded)}`);
  assert.ok(recorded.stdL >= 1.5 && recorded.stdL <= 2.5, `recorded luma sd ~2 (${recorded.stdL})`);
  assert.equal(isOpen(recorded), false);

  // Same URL on this branch before the call, same signature.
  const before = lowerHalf(`${dir}/before-alt3000.png`);
  assert.equal(isSheet(before), true, `before ${JSON.stringify(before)}`);
  assert.equal(before.stdL, 2);
  assert.equal(before.beige, 1);
  assert.equal(isOpen(before), false);

  // After setClear(cloudClear(alt)) on the standalone path. Not the sheet.
  const after = lowerHalf(`${dir}/after-alt3000.png`);
  assert.equal(isSheet(after), false, `after ${JSON.stringify(after)}`);
  assert.equal(isOpen(after), true, `after ${JSON.stringify(after)}`);
  assert.equal(after.beige, 0);
  assert.ok(after.stdL >= 8 && after.stdL !== 2, `fixed luma sd ${after.stdL}`);

  // Known match: atmosphere off, and orbit still a disc (cloudClear at 2.2 radii is 0).
  for (const file of [`${dir}/known-match-1016-atmos0.png`, `${dir}/before-alt3000-atmos0.png`, `${dir}/after-alt3000-atmos0.png`]) {
    const s = lowerHalf(file);
    assert.equal(isOpen(s), true, `${file} ${JSON.stringify(s)}`);
  }
  const orbit = lowerHalf(`${dir}/after-orbit.png`);
  assert.equal(isSheet(orbit), false, `orbit ${JSON.stringify(orbit)}`);
  assert.ok(orbit.stdL > 20, `orbit disc luma sd ${orbit.stdL}`);

  assert.equal(cloudClear(3000), 1);
  assert.equal(cloudClear(PLANET.radius * 2.2), 0);
  const src = readFileSync('src/world/globe/globeView.ts', 'utf8');
  assert.match(src, /if \(atmos\) atmos\.setClear\(localClouds\?\.mesh\.visible \? cloudClear\(alt\) \* localCloudFade\(alt\) : 0\)/); // T-0073: the shell opens only where the local column draws, eased (issue #107)
  assert.equal(/opts\.shared\)\s*atmos\.setClear/.test(src), false);
});
