// Pixel metric for the T-0004 stills. Calibrated on a known match (a frame against itself) and a known
// mismatch (the same frame with a 0.15 sine multiply, the plan's band bound). Not a nature score.
import { readFileSync, writeFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';

function decodePng(path) {
  const d = readFileSync(path);
  let i = 8, w = 0, h = 0, ct = 0;
  const idat = [];
  while (i < d.length) {
    const n = d.readUInt32BE(i), t = d.toString('latin1', i + 4, i + 8), c = d.subarray(i + 8, i + 8 + n);
    if (t === 'IHDR') { w = c.readUInt32BE(0); h = c.readUInt32BE(4); ct = c[9]; }
    if (t === 'IDAT') idat.push(c);
    i += 12 + n;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const bpp = ct === 6 ? 4 : ct === 2 ? 3 : 0;
  if (!bpp) throw new Error('unsupported color type ' + ct);
  const stride = w * bpp, rows = [];
  let prev = new Uint8Array(stride), p = 0;
  for (let y = 0; y < h; y++) {
    const f = raw[p], line = Uint8Array.from(raw.subarray(p + 1, p + 1 + stride));
    p += 1 + stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? line[x - bpp] : 0, b = prev[x], c0 = x >= bpp ? prev[x - bpp] : 0;
      if (f === 1) line[x] = (line[x] + a) & 255;
      else if (f === 2) line[x] = (line[x] + b) & 255;
      else if (f === 3) line[x] = (line[x] + ((a + b) >> 1)) & 255;
      else if (f === 4) {
        const pa = Math.abs(b - c0), pb = Math.abs(a - c0), pc = Math.abs(a + b - 2 * c0);
        line[x] = (line[x] + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c0)) & 255;
      }
    }
    rows.push(line); prev = line;
  }
  return { w, h, bpp, rows };
}
const lum = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
function boxStats(img, box, sineAmp = 0) {
  const { rows, bpp, w } = img;
  const [x0, y0, x1, y1] = box;
  let n = 0, sum = 0, sum2 = 0;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const o = x * bpp, r = rows[y][o], g = rows[y][o + 1], b = rows[y][o + 2];
    let L = lum(r, g, b);
    if (sineAmp) L *= 1 + sineAmp * Math.sin((x / w) * Math.PI * 8);
    sum += L; sum2 += L * L; n++;
  }
  const mean = sum / n, v = Math.max(0, sum2 / n - mean * mean);
  return { n, mean, std: Math.sqrt(v), cv: mean ? Math.sqrt(v) / mean : 0 };
}
function diff(a, b, box) {
  const [x0, y0, x1, y1] = box;
  let n = 0, ad = 0, adR = 0;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const oa = x * a.bpp, ob = x * b.bpp;
    const La = lum(a.rows[y][oa], a.rows[y][oa + 1], a.rows[y][oa + 2]);
    const Lb = lum(b.rows[y][ob], b.rows[y][ob + 1], b.rows[y][ob + 2]);
    ad += Math.abs(La - Lb);
    adR += Math.abs(a.rows[y][oa] - b.rows[y][ob]) + Math.abs(a.rows[y][oa + 1] - b.rows[y][ob + 1]) + Math.abs(a.rows[y][oa + 2] - b.rows[y][ob + 2]);
    n++;
  }
  return { n, meanAbsLum: ad / n, meanAbsChannel: adR / (3 * n) };
}
const dir = new URL('.', import.meta.url).pathname;
const logOn = decodePng(dir + 'log-on.png'), logOff = decodePng(dir + 'log-off.png');
const trunkOn = decodePng(dir + 'trunk-on.png'), trunkOff = decodePng(dir + 'trunk-off.png');
const W = logOn.w, H = logOn.h;
// Center-lower, clear of the wolf's usual lower-centre mass and of the corner HUD. Chosen before looking at the score.
const center = [Math.round(W * .3), Math.round(H * .35), Math.round(W * .7), Math.round(H * .72)];
const out = {
  size: { w: W, h: H },
  box: center,
  calibration: {
    knownMatch_logOff_vs_itself: diff(logOff, logOff, center),
    knownMismatch_logOff_vs_0_15_sine: { note: 'CV of the off frame after a synthetic x-sine of amplitude 0.15, minus the plain CV. The metric is boxStats.cv.', plain: boxStats(logOff, center, 0), sine: boxStats(logOff, center, 0.15) },
  },
  log: { on: boxStats(logOn, center), off: boxStats(logOff, center), diff: diff(logOn, logOff, center) },
  trunk: { on: boxStats(trunkOn, center), off: boxStats(trunkOff, center), diff: diff(trunkOn, trunkOff, center) },
};
writeFileSync(dir + 'measure.json', JSON.stringify(out, null, 2) + '\n');
console.log(JSON.stringify(out, null, 2));
