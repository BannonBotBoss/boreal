// T-0025 review probe 2 (claude): thin vertical line pixels (culms) = differ from both x-2 and x+2 neighbours by > 20 luma, same sign.
import { decodePng, measureLittoralFrame } from './m.mjs';
const R = 'C:/dev/boreal-claude-reviews/refs/water/';
function lines(img, bx, wolf, erase) {
  const L = (y, x) => { const o = x * img.bpp; return (img.rows[y][o] + img.rows[y][o + 1] + img.rows[y][o + 2]) / 3; };
  const out = { n: 0, all: 0, r: 0, g: 0, b: 0, l: 0, dark: 0 };
  const copy = erase ? { ...img, rows: img.rows.map(r => Uint8Array.from(r)) } : null;
  for (let y = bx[1]; y <= bx[3]; y++) for (let x = bx[0] + 2; x <= bx[2] - 2; x++) {
    if (wolf && x >= wolf[0] && x <= wolf[2] && y >= wolf[1]) continue;
    out.all++;
    const c = L(y, x), a = L(y, x - 2), b = L(y, x + 2);
    const isLine = (c < a - 20 && c < b - 20) || (c > a + 20 && c > b + 20);
    if (!isLine) continue;
    const o = x * img.bpp; out.n++; out.r += img.rows[y][o]; out.g += img.rows[y][o + 1]; out.b += img.rows[y][o + 2]; out.l += c;
    if (c < a) out.dark++;
    if (copy) for (let k = 0; k < 3; k++) copy.rows[y][o + k] = (img.rows[y][o - 2 * img.bpp + k] + img.rows[y][o + 2 * img.bpp + k]) >> 1;
  }
  const n = out.n || 1;
  return { lineShare: +(out.n / out.all).toFixed(4), darkLineShareOfLines: +(out.dark / n).toFixed(3), meanRGB: [out.r / n, out.g / n, out.b / n].map(v => +v.toFixed(1)), meanLuma: +(out.l / n).toFixed(1), copy };
}
const g = decodePng(R + 'littoral-audit/wade-stop-0.png');
const gb = { emergentBox: [260, 290, 1180, 520], floatingBox: [260, 275, 1180, 480], lakeBox: [260, 275, 1180, 520] };
const gl = lines(g, [20, 290, 1260, 640], [510, 315, 765, 720], true);
const r = decodePng(R + 'reference/t0025-littoral.png');
const rl = lines(r, [80, 360, 1200, 620], null, false);
const c = decodePng(R + 'littoral-audit/littoral-close-0.png');
const cl = lines(c, [260, 295, 1180, 470], [510, 315, 765, 720], false);
const del = ({ copy, ...rest }) => rest;
const s0 = measureLittoralFrame(g, gb), s1 = measureLittoralFrame(gl.copy, gb);
console.log(JSON.stringify({ wadeStop0: del(gl), littoralClose0: del(cl), reference: rl,
  wadeStopScore: s0.calibratedScore, wadeStopScoreCulmsErased: s1.calibratedScore, erasedTerms: { em: s1.emergentCoverShare, fl: s1.floatingCoverShare, il: s1.interleavedColumnShare, vc: s1.verticalCulmRatio } }, null, 1));
