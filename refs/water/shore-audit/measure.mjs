// node refs/water/shore-audit/measure.mjs <dir> : mean sRGB and relative luminance of fixed boxes in the recorded frames (no deps)
import { readFileSync, writeFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
function png(path) {
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
const box = ({ bpp, rows }, x0, y0, x1, y1) => { const s = [0, 0, 0]; let n = 0;
  for (let y = y0; y < y1; y += 2) for (let x = x0; x < x1; x += 2) { for (let k = 0; k < 3; k++) s[k] += rows[y][x * bpp + k]; n++; }
  const m = s.map(v => +(v / n).toFixed(1)), lin = m.map(c => (c /= 255) > .04045 ? ((c + .055) / 1.055) ** 2.4 : c / 12.92);
  return { rgb: m, relLum: +(.2126 * lin[0] + .7152 * lin[1] + .0722 * lin[2]).toFixed(4) }; };
const dir = process.argv[2], out = {};
const B = { 'noon-0.png': { water_near: [300, 300, 1200, 345], water_far: [300, 262, 1200, 285], far_treeline: [300, 150, 900, 230], far_shore: [300, 232, 900, 250], sky: [240, 100, 330, 140], near_grass: [300, 470, 560, 560] },
  'evening-1.png': { water_near: [300, 300, 1200, 345], water_far: [300, 262, 1200, 285], far_treeline: [300, 150, 900, 230], sky: [200, 5, 330, 30] },
  'wade-5.png': { water_center: [300, 420, 560, 560], water_far: [300, 270, 1200, 300] } };
for (const [f, boxes] of Object.entries(B)) { const img = png(`${dir}/${f}`); out[f] = Object.fromEntries(Object.entries(boxes).map(([k, b]) => [k, box(img, ...b)])); }
writeFileSync(`${dir}/measure.json`, JSON.stringify(out, null, 1)); console.log(JSON.stringify(out));
