// node refs/water/optics-after/streaks.mjs <dir> : Fresnel check that does not depend on forest structure (T-0023).
// The bright streaks in the mirrored band under the far shore are sky seen between trunks; their luminance over the sky's
// (the same sky, near the horizon, seen directly) is the water's reflectance there. Exact Fresnel (n = 1.333) at 30-45 m
// from the 3.3 m eye: 0.54-0.66. Top 5 % of pixels in water_far vs the top 5 % of the sky box (sky between trunks above).
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
function png(path) { // same decoder as refs/water/shore-audit/measure.mjs
  const d = readFileSync(path); let i = 8, w = 0, h = 0, ct = 0; const idat = [];
  while (i < d.length) { const n = d.readUInt32BE(i), t = d.toString('latin1', i + 4, i + 8), c = d.subarray(i + 8, i + 8 + n);
    if (t === 'IHDR') { w = c.readUInt32BE(0); h = c.readUInt32BE(4); ct = c[9]; } if (t === 'IDAT') idat.push(c); i += 12 + n; }
  const raw = inflateSync(Buffer.concat(idat)), bpp = ct === 6 ? 4 : 3, stride = w * bpp, rows = []; let prev = new Uint8Array(stride), p = 0;
  for (let y = 0; y < h; y++) { const f = raw[p], line = Uint8Array.from(raw.subarray(p + 1, p + 1 + stride)); p += 1 + stride;
    for (let x = 0; x < stride; x++) { const a = x >= bpp ? line[x - bpp] : 0, b = prev[x], c = x >= bpp ? prev[x - bpp] : 0;
      if (f === 1) line[x] = line[x] + a; else if (f === 2) line[x] = line[x] + b; else if (f === 3) line[x] = line[x] + ((a + b) >> 1);
      else if (f === 4) { const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c); line[x] = line[x] + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c); } }
    rows.push(line); prev = line; }
  return { w, h, bpp, rows };
}
const lin = c => (c /= 255) > .04045 ? ((c + .055) / 1.055) ** 2.4 : c / 12.92;
const lums = ({ bpp, rows }, x0, y0, x1, y1) => { const o = []; for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const r = rows[y]; o.push(.2126 * lin(r[x * bpp]) + .7152 * lin(r[x * bpp + 1]) + .0722 * lin(r[x * bpp + 2])); } return o.sort((a, b) => a - b); };
const q = (a, f) => a[Math.min(a.length - 1, Math.floor(a.length * f))];
const dir = process.argv[2], img = png(`${dir}/noon-0.png`);
const water = lums(img, 300, 262, 1200, 285), sky = lums(img, 240, 100, 330, 140); // boxes of measure.mjs (water_far, sky)
const r = { waterTop5: +q(water, .95).toFixed(4), skyTop5: +q(sky, .95).toFixed(4) }; r.reflectance = +(r.waterTop5 / r.skyTop5).toFixed(3); // the sky box holds trunks too: its top 5 % is the sky between them
console.log(JSON.stringify(r));
