// node refs/water/river-audit/measure.mjs : per box, mean sRGB, relative luminance of the mean, and the FOAM SHARE = share of
// pixels that read as whitewater (pixel relative luminance > 0.45 and HSV saturation < 0.18). Boxes were chosen on the frames
// before measuring: water only, clear of the wolf, the senses ring and branches where possible. Reuses the no-dependency PNG
// decoder of refs/water/shore-audit/measure.mjs. Also measures real photos (reference/*.png, rebuilt from the committed JPGs by
// reference/to-png.ps1) with the same statistic.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
export function png(path) {
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
const lin = c => (c /= 255) > .04045 ? ((c + .055) / 1.055) ** 2.4 : c / 12.92, L = (r, g, b) => .2126 * lin(r) + .7152 * lin(g) + .0722 * lin(b);
export const FOAM = { lum: .45, sat: .18 };
/** Same cut the audit boxes use: relative luminance above 0.45 and HSV saturation under 0.18. */
export function isFoamPixel(r, g, b) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), sat = mx ? (mx - mn) / mx : 0;
  return L(r, g, b) > FOAM.lum && sat < FOAM.sat;
}
export const box = ({ bpp, rows }, x0, y0, x1, y1) => { const s = [0, 0, 0]; let n = 0, foam = 0;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const r = rows[y][x * bpp], g = rows[y][x * bpp + 1], b = rows[y][x * bpp + 2];
    s[0] += r; s[1] += g; s[2] += b; n++; if (isFoamPixel(r, g, b)) foam++; }
  const m = s.map(v => +(v / n).toFixed(1));
  return { rgb: m, relLum: +L(...m).toFixed(4), foamShare: +(foam / n).toFixed(3), px: n }; };
const root = 'refs/water/river-audit', out = {};
const isMain = process.argv[1]?.endsWith('measure.mjs');
if (isMain) {
const B = {
  'fast1/across-0.png': { left: [20, 330, 560, 390], right: [720, 360, 1260, 420] },
  'fast1/across-2.png': { left: [20, 330, 560, 390], right: [720, 360, 1260, 420] },
  'order2/across-0.png': { left: [20, 300, 300, 380] },
  'slow1/across-0.png': { left: [60, 335, 470, 380], right: [960, 330, 1270, 380] },
  'slow1/downstream-0.png': { near: [20, 280, 380, 400] },
};
// real photos: boxes are listed in reference/SOURCES.json next to each file (chosen on the photo before measuring)
const src = existsSync(`${root}/reference/SOURCES.json`) ? JSON.parse(readFileSync(`${root}/reference/SOURCES.json`, 'utf8')) : [];
for (const s of src) if (s.box) B[`reference/${s.file}`] = { water: s.box, ...(s.extra ?? {}) };
for (const [f, boxes] of Object.entries(B)) { if (!existsSync(`${root}/${f}`)) continue; const img = png(`${root}/${f}`); out[f] = Object.fromEntries(Object.entries(boxes).map(([k, b]) => [k, box(img, ...b)])); }
writeFileSync(`${root}/measure.json`, JSON.stringify({ FOAM, out }, null, 1)); console.log(JSON.stringify(out, null, 1));
}
