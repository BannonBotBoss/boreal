// node refs/water/optics-after2/box-diag.mjs <png...> : T-0023 mirror ratio (statistic of measure.mjs: luminance of the box's mean sRGB)
// with the water box over the SAME x-range as the treeline box (as the photo calibration boxes are), and the right strip alone.
import { readFileSync } from 'node:fs'; import { inflateSync } from 'node:zlib';
function png(path) { const d = readFileSync(path); let i = 8, w = 0, h = 0, ct = 0; const idat = [];
  while (i < d.length) { const n = d.readUInt32BE(i), t = d.toString('latin1', i + 4, i + 8), c = d.subarray(i + 8, i + 8 + n);
    if (t === 'IHDR') { w = c.readUInt32BE(0); h = c.readUInt32BE(4); ct = c[9]; } if (t === 'IDAT') idat.push(c); i += 12 + n; }
  const raw = inflateSync(Buffer.concat(idat)), bpp = ct === 6 ? 4 : 3, stride = w * bpp, rows = []; let prev = new Uint8Array(stride), p = 0;
  for (let y = 0; y < h; y++) { const f = raw[p], line = Uint8Array.from(raw.subarray(p + 1, p + 1 + stride)); p += 1 + stride;
    for (let x = 0; x < stride; x++) { const a = x >= bpp ? line[x - bpp] : 0, b = prev[x], c = x >= bpp ? prev[x - bpp] : 0;
      if (f === 1) line[x] = line[x] + a; else if (f === 2) line[x] = line[x] + b; else if (f === 3) line[x] = line[x] + ((a + b) >> 1);
      else if (f === 4) { const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c); line[x] = line[x] + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c); } }
    rows.push(line); prev = line; } return { bpp, rows }; }
const lin = c => (c /= 255) > .04045 ? ((c + .055) / 1.055) ** 2.4 : c / 12.92;
const mean = ({ bpp, rows }, [x0, y0, x1, y1]) => { const s = [0, 0, 0]; let n = 0; for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const r = rows[y]; for (let k = 0; k < 3; k++) s[k] += r[x * bpp + k]; n++; } const m = s.map(v => v / n); return .2126 * lin(m[0]) + .7152 * lin(m[1]) + .0722 * lin(m[2]); };
for (const f of process.argv.slice(2)) { const im = png(f), T = mean(im, [300, 150, 900, 230]);
  const o = { orig: mean(im, [300, 262, 1200, 285]) / T, sameX: mean(im, [300, 262, 900, 285]) / T, rightHalf: mean(im, [900, 262, 1200, 285]) / mean(im, [900, 150, 1200, 230]) };
  console.log(f, Object.entries(o).map(([k, v]) => k + '=' + v.toFixed(3)).join(' ')); }
