// node refs/water/optics-after2/crop.mjs <in.png> <out.png> x0 y0 x1 y1 [scale] : crop + nearest-neighbour enlarge (zlib only).
import { readFileSync, writeFileSync } from 'node:fs'; import { inflateSync, deflateSync, crc32 } from 'node:zlib';
function png(path) { const d = readFileSync(path); let i = 8, w = 0, h = 0, ct = 0; const idat = [];
  while (i < d.length) { const n = d.readUInt32BE(i), t = d.toString('latin1', i + 4, i + 8), c = d.subarray(i + 8, i + 8 + n);
    if (t === 'IHDR') { w = c.readUInt32BE(0); h = c.readUInt32BE(4); ct = c[9]; } if (t === 'IDAT') idat.push(c); i += 12 + n; }
  const raw = inflateSync(Buffer.concat(idat)), bpp = ct === 6 ? 4 : 3, stride = w * bpp, rows = []; let prev = new Uint8Array(stride), p = 0;
  for (let y = 0; y < h; y++) { const f = raw[p], line = Uint8Array.from(raw.subarray(p + 1, p + 1 + stride)); p += 1 + stride;
    for (let x = 0; x < stride; x++) { const a = x >= bpp ? line[x - bpp] : 0, b = prev[x], c = x >= bpp ? prev[x - bpp] : 0;
      if (f === 1) line[x] = line[x] + a; else if (f === 2) line[x] = line[x] + b; else if (f === 3) line[x] = line[x] + ((a + b) >> 1);
      else if (f === 4) { const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c); line[x] = line[x] + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c); } }
    rows.push(line); prev = line; } return { bpp, rows }; }
const [inp, out, ...n] = process.argv.slice(2), [x0, y0, x1, y1, k = 3] = n.map(Number), { bpp, rows } = png(inp), W = (x1 - x0) * k, H = (y1 - y0) * k;
const raw = Buffer.alloc((W * 3 + 1) * H); for (let y = 0; y < H; y++) { const r = rows[y0 + Math.floor(y / k)], o = y * (W * 3 + 1);
  for (let x = 0; x < W; x++) for (let c = 0; c < 3; c++) raw[o + 1 + x * 3 + c] = r[(x0 + Math.floor(x / k)) * bpp + c]; }
const chunk = (t, d) => { const b = Buffer.alloc(12 + d.length); b.writeUInt32BE(d.length, 0); b.write(t, 4, 'latin1'); d.copy(b, 8); b.writeUInt32BE(crc32(Buffer.concat([Buffer.from(t, 'latin1'), d])) >>> 0, 8 + d.length); return b; };
const ih = Buffer.alloc(13); ih.writeUInt32BE(W, 0); ih.writeUInt32BE(H, 4); ih[8] = 8; ih[9] = 2;
writeFileSync(out, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
