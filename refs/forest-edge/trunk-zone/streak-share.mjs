// node refs/water/optics-after7/streak-share.mjs <png...> : how much of the T-0023 mirror ratio (ruled box [300,262,900,285] over
// treeline box [300,150,900,230], statistic of measure.mjs) is mirrored SKY seen through the far forest's trunk zone. Streak pixel =
// the edge-gap.mjs class (refs/forest-edge, calibrated: real closed-edge mirrors 0.000-0.024): blue >= green AND luminance > half
// the sky's q95 (sky box [240,100,330,140]). Counterfactual: the same box with streak pixels set to the box's non-streak mean.
// ratioBothClean: the same replacement in the treeline box too (sky between the far trunks, which real closed edges do not show).
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
const px = ({ bpp, rows }, [x0, y0, x1, y1]) => { const o = []; for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const r = rows[y], i = x * bpp; o.push([r[i], r[i + 1], r[i + 2]]); } return o; };
const lumOfMean = a => { const m = [0, 1, 2].map(k => a.reduce((s, p) => s + p[k], 0) / a.length); return .2126 * lin(m[0]) + .7152 * lin(m[1]) + .0722 * lin(m[2]); };
const L = p => .2126 * lin(p[0]) + .7152 * lin(p[1]) + .0722 * lin(p[2]);
for (const f of process.argv.slice(2)) { const im = png(f), T = lumOfMean(px(im, [300, 150, 900, 230])), W = px(im, [300, 262, 900, 285]);
  const s = px(im, [240, 100, 330, 140]).map(p => p[2] >= p[1] ? L(p) : 0).sort((a, b) => a - b), skyL = s[Math.floor(s.length * .95)];
  const streak = p => p[2] >= p[1] && L(p) > skyL * .5, rest = W.filter(p => !streak(p)), n = W.length - rest.length;
  const restMean = [0, 1, 2].map(k => rest.reduce((a, p) => a + p[k], 0) / rest.length), cf = W.map(p => streak(p) ? restMean : p);
  const Tp = px(im, [300, 150, 900, 230]), Trest = Tp.filter(p => !streak(p)), TrestMean = [0, 1, 2].map(k => Trest.reduce((a, p) => a + p[k], 0) / Trest.length), Tcf = lumOfMean(Tp.map(p => streak(p) ? TrestMean : p));
  console.log(JSON.stringify({ treeSkyShare: +(1 - Trest.length / Tp.length).toFixed(4), ratioBothClean: +(lumOfMean(cf) / Tcf).toFixed(3) }));
  console.log(JSON.stringify({ f, skyL: +skyL.toFixed(3), streakShare: +(n / W.length).toFixed(4), ratio: +(lumOfMean(W) / T).toFixed(3), ratioNoStreaks: +(lumOfMean(cf) / T).toFixed(3) })); }
