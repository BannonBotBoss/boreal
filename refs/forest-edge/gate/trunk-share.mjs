// grok (continuing claude's T-0032): trunk-zone sky share for the objective 3 gate, with claude's calibrated class
// (refs/forest-edge/edge-gap.mjs, streak-share.mjs): sky pixel = blue >= green AND luminance > half the sky's q95.
// Change vs streak-share.mjs: once the forest is closed, claude's fixed sky box [240,100,330,140] is full of trees (q95 -> ~0,
// so every bluish pixel counts as sky). The sky luminance is a property of the scene (hour 12, same weather), so it is taken
// from the sky box only when that box is still sky (q95 > 0.5) and otherwise from SKY_L, the value every earlier frame of the
// view measured (0.792-0.798, refs/forest-edge/trunk-zone/results.jsonl and gate/before). Boxes per view, identical before/after:
//   a = T-0023 view (?at=30,0,1.571): trunk box [300,150,900,230], mirror box [300,262,900,285] (claude's boxes)
//   b = second view (?at=272,-832,-1.571): trunk box [250,150,600,222] = above the far bank (y 225) and over the x-span of the
//       far shore's land (x 200-615 in the frames; right of it the lake runs to the horizon, no shore). Placed by hand from
//       before/b-default-0.png, the same for every frame.
// node refs/forest-edge/gate/trunk-share.mjs <png...>   (view from the file name: b-* = view b)
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
const lin = c => (c /= 255) > .04045 ? ((c + .055) / 1.055) ** 2.4 : c / 12.92, L = p => .2126 * lin(p[0]) + .7152 * lin(p[1]) + .0722 * lin(p[2]);
const px = ({ bpp, rows }, [x0, y0, x1, y1]) => { const o = []; for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const r = rows[y], i = x * bpp; o.push([r[i], r[i + 1], r[i + 2]]); } return o; };
const SKY_L = 0.795, BOX = { a: { trunk: [300, 150, 900, 230], mirror: [300, 262, 900, 285] }, b: { trunk: [250, 150, 600, 222] } };
for (const f of process.argv.slice(2)) { const im = png(f), v = /(^|[\\/])b-/.test(f) ? 'b' : 'a';
  const s = px(im, [240, 100, 330, 140]).map(p => p[2] >= p[1] ? L(p) : 0).sort((a, b) => a - b), q = s[Math.floor(s.length * .95)], skyL = q > .5 ? q : SKY_L;
  const share = b => { const P = px(im, b); return +(P.filter(p => p[2] >= p[1] && L(p) > skyL * .5).length / P.length).toFixed(4); };
  console.log(JSON.stringify({ f, view: v, skyL: +skyL.toFixed(3), skyFrom: q > .5 ? 'box' : 'scene', trunkSky: share(BOX[v].trunk), ...(BOX[v].mirror ? { mirrorSky: share(BOX[v].mirror) } : {}) })); }