/**
 * T-0024 frame gate. Reads the top-down PNGs and the wake JSON written by capture.mjs.
 * Also paints a synthetic PNG of a known ring and a known wake and scores that, so the pixel path is calibrated
 * on a known match and a known mismatch before the game frames are trusted.
 */
import { deflateSync } from 'node:zlib';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { WAVE, fitDisturbance, wakeScore, projectTop, unprojectTop, hullFroude, wakeHalfAngleDeg, WATERLINE, type TopCam } from '../../src/core/waterWake';

function png(path: string) {
  const d = readFileSync(path); let i = 8, w = 0, h = 0, ct = 0; const idat: Buffer[] = [];
  while (i < d.length) {
    const n = d.readUInt32BE(i), t = d.toString('latin1', i + 4, i + 8), c = d.subarray(i + 8, i + 8 + n);
    if (t === 'IHDR') { w = c.readUInt32BE(0); h = c.readUInt32BE(4); ct = c[9]; }
    if (t === 'IDAT') idat.push(c); i += 12 + n;
  }
  const raw = inflateSync(Buffer.concat(idat)), bpp = ct === 6 ? 4 : 3, stride = w * bpp, rows: Uint8Array[] = [];
  let prev = new Uint8Array(stride), p = 0;
  for (let y = 0; y < h; y++) {
    const f = raw[p], line = Uint8Array.from(raw.subarray(p + 1, p + 1 + stride)); p += 1 + stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? line[x - bpp] : 0, b = prev[x], cc = x >= bpp ? prev[x - bpp] : 0;
      if (f === 1) line[x] = (line[x] + a) & 255; else if (f === 2) line[x] = (line[x] + b) & 255;
      else if (f === 3) line[x] = (line[x] + ((a + b) >> 1)) & 255;
      else if (f === 4) {
        const pa = Math.abs(b - cc), pb = Math.abs(a - cc), pc = Math.abs(a + b - 2 * cc);
        line[x] = (line[x] + (pa <= pb && pa <= pc ? a : pb <= pc ? b : cc)) & 255;
      }
    }
    rows.push(line); prev = line;
  }
  return { w, h, bpp, rows };
}
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcTable[n] = c; }
const crc = (b: Buffer) => { let c = 0xffffffff; for (const x of b) c = crcTable[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function chunk(type: string, data: Buffer) {
  const head = Buffer.alloc(4); head.writeUInt32BE(data.length);
  const typed = Buffer.concat([Buffer.from(type), data]);
  const sum = Buffer.alloc(4); sum.writeUInt32BE(crc(typed));
  return Buffer.concat([head, typed, sum]);
}
function writePng(path: string, w: number, h: number, rgb: Uint8Array) {
  const stride = w * 3 + 1, raw = Buffer.alloc(stride * h);
  for (let y = 0; y < h; y++) {
    raw[y * stride] = 0;
    for (let x = 0; x < w * 3; x++) raw[y * stride + 1 + x] = rgb[y * w * 3 + x];
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  writeFileSync(path, Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ]));
}
function lum(rows: Uint8Array[], bpp: number, x: number, y: number) {
  const px = rows[y][x * bpp], g = rows[y][x * bpp + 1], b = rows[y][x * bpp + 2];
  const lin = [px, g, b].map(c => { const s = c / 255; return s > 0.04045 ? ((s + 0.055) / 1.055) ** 2.4 : s / 12.92; });
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

const W = 640, H = 360;
const cam: TopCam = { x: 0, z: 0, heading: 0.4, h: 6, fovDeg: 40, y: -0.25 };
const radius = 0.8, fr = hullFroude(2, WATERLINE.wolf), angleDeg = wakeHalfAngleDeg(fr);
function paint(rScale: number, angDeg: number) {
  const rgb = new Uint8Array(W * H * 3);
  const place = (behind: number, lateral: number) => {
    const fx = -Math.sin(cam.heading), fz = -Math.cos(cam.heading), rx = Math.cos(cam.heading), rz = -Math.sin(cam.heading);
    return { x: cam.x - behind * fx + lateral * rx, z: cam.z - behind * fz + lateral * rz };
  };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const p = unprojectTop(x + 0.5, y + 0.5, cam, W, H);
    const rr = Math.hypot(p.x - cam.x, p.z - cam.z);
    const fx = -Math.sin(cam.heading), fz = -Math.cos(cam.heading);
    const behind = -((p.x - cam.x) * fx + (p.z - cam.z) * fz);
    const lateral = (p.x - cam.x) * Math.cos(cam.heading) + (p.z - cam.z) * -Math.sin(cam.heading);
    const ang = behind > 0.05 ? Math.atan2(Math.abs(lateral), behind) * 180 / Math.PI : 999;
    const ring = Math.abs(rr - radius * rScale) < 0.015;
    const arm = behind > 0.5 && Math.abs(ang - angDeg) < 0.4;
    if (ring || arm) { const i = (y * W + x) * 3; rgb[i] = rgb[i + 1] = rgb[i + 2] = 255; }
    else { const i = (y * W + x) * 3; rgb[i] = 40; rgb[i + 1] = 70; rgb[i + 2] = 72; }
  }
  return rgb;
}
function brightPoints(img: { w: number; h: number; bpp: number; rows: Uint8Array[] }, view: TopCam, minLum: number) {
  const pts: { x: number; z: number }[] = [];
  for (let y = 0; y < img.h; y += 1) for (let x = 0; x < img.w; x += 1) {
    if (lum(img.rows, img.bpp, x, y) < minLum) continue;
    pts.push(unprojectTop(x + 0.5, y + 0.5, view, img.w, img.h));
  }
  return pts;
}
const synthCam = cam;
writePng('refs/T-0024/synthetic-match.png', W, H, paint(1, angleDeg));
writePng('refs/T-0024/synthetic-mismatch.png', W, H, paint(2, 40));
function scorePng(path: string, r: number, ang: number) {
  const img = png(path);
  const pts = brightPoints(img, synthCam, 0.5).filter(p => Math.hypot(p.x - synthCam.x, p.z - synthCam.z) > 0.15);
  const fit = fitDisturbance(pts, synthCam, synthCam.heading);
  return { ...fit, ...wakeScore(fit, { radius: r, angleDeg: ang }), n: pts.length };
}
const synthetic = {
  match: scorePng('refs/T-0024/synthetic-match.png', radius, angleDeg),
  mismatch: scorePng('refs/T-0024/synthetic-mismatch.png', radius, angleDeg),
};

type Shot = {
  now?: number; view?: TopCam;
  rings?: { x: number; z: number; t0: number; amp: number }[];
  wakes?: { x: number; z: number; heading: number; speed: number; angle: number; amp: number }[];
};
function shot(label: string): { img: ReturnType<typeof png>; wake: Shot } | undefined {
  if (!existsSync(`${dir}/${label}.png`) || !existsSync(`${dir}/${label}.json`)) return undefined;
  const wake = JSON.parse(readFileSync(`${dir}/${label}.json`, 'utf8')) as Shot;
  if (!wake.view || wake.now === undefined) return undefined;
  return { img: png(`${dir}/${label}.png`), wake };
}
/** Screen luminance on the sRGB scale the PNG stores, so a ridge and the lake can be compared by eye. */
function srgbLum(img: ReturnType<typeof png>, view: TopCam, x: number, z: number) {
  const s = projectTop({ x, z }, view, img.w, img.h);
  const px = Math.round(s.x), py = Math.round(s.y);
  if (px < 0 || py < 0 || px >= img.w || py >= img.h) return undefined;
  const i = px * img.bpp, row = img.rows[py];
  return 0.2126 * row[i] + 0.7152 * row[i + 1] + 0.0722 * row[i + 2];
}
/**
 * Wake angle. Mean luminance along each half-angle, background = median of the arms outside 12–30°,
 * measured angle = the luminance-weighted mean of the degrees above half the peak excess.
 * A frame whose peak excess is under 15 is unmeasurable: the lake has been lifted flat by adaptation.
 */
function gameAngle(label: string) {
  const s = shot(label); if (!s) return { missing: true };
  const slot = (s.wake.wakes ?? []).filter(w => w.amp > 0).at(-1);
  if (!slot) return { noWake: true };
  const fx = -Math.sin(slot.heading), fz = -Math.cos(slot.heading);
  const rx = Math.cos(slot.heading), rz = -Math.sin(slot.heading);
  const rows: { deg: number; L: number }[] = [];
  for (let deg = 5; deg <= 50; deg++) {
    let sum = 0, n = 0;
    for (let behind = 0.45; behind <= 2.4; behind += 0.06) for (const sign of [-1, 1]) {
      const lateral = sign * Math.tan(deg * Math.PI / 180) * behind;
      const L = srgbLum(s.img, s.wake.view!, slot.x - behind * fx + lateral * rx, slot.z - behind * fz + lateral * rz);
      if (L === undefined) continue; sum += L; n++;
    }
    if (n) rows.push({ deg, L: sum / n });
  }
  const floor = rows.filter(o => o.deg < 12 || o.deg > 30).map(o => o.L).sort((a, b) => a - b);
  const bg = floor[Math.floor(floor.length / 2)] ?? 0;
  const max = Math.max(...rows.map(o => o.L));
  const contrast = max - bg;
  const expected = slot.angle * 180 / Math.PI;
  if (!(contrast >= 15)) return { speed: slot.speed, expected, contrast, unmeasurable: 'peak excess under 15: the lake is flat' };
  const hot = rows.filter(o => o.L - bg > 0.5 * contrast);
  let sw = 0, sd = 0; for (const o of hot) { const w = o.L - bg; sw += w; sd += w * o.deg; }
  const measured = sd / sw;
  const score = 1 - Math.abs(measured - expected) / expected;
  return { speed: slot.speed, measured, expected, contrast, score, hot: hot.map(o => o.deg) };
}
/**
 * Ring front. A ring is measurable only when its ridge clears the body (center farther than 0.5 m plus the
 * expected radius); closer than that the wolf covers the water. Azimuths within 60° of the other paw of the
 * same step are left out. The radius is the parabolic peak of the 1 cm mean-luminance profile.
 */
function gameRings(label: string) {
  const s = shot(label); if (!s) return { missing: true };
  const body = s.wake.view!;
  const rings = (s.wake.rings ?? []).filter(r => r.amp > 0 && s.wake.now! - r.t0 > 0.4);
  const scored = rings.map(r => {
    const age = s.wake.now! - r.t0, expected = WAVE.cg * age;
    const clear = Math.hypot(r.x - body.x, r.z - body.z) > 0.5 + expected;
    if (!clear) return { age, expected, clear };
    const sib = rings.find(o => o !== r && Math.abs(o.t0 - r.t0) < 1e-6);
    const bins = new Map<number, number[]>();
    for (let deg = 0; deg < 360; deg += 4) {
      const t = deg * Math.PI / 180, dx = Math.cos(t), dz = Math.sin(t);
      if (sib) {
        const sx = sib.x - r.x, sz = sib.z - r.z, sl = Math.hypot(sx, sz) || 1;
        if ((dx * sx + dz * sz) / sl > 0.5) continue;
      }
      for (let rad = 0.03; rad <= Math.max(0.45, expected * 2); rad += 0.01) {
        const L = srgbLum(s.img, body, r.x + dx * rad, r.z + dz * rad);
        if (L === undefined) continue;
        const b = Math.round(rad * 100), arr = bins.get(b); if (arr) arr.push(L); else bins.set(b, [L]);
      }
    }
    let bestB = 0, bestL = -1;
    for (const [b, arr] of bins) {
      if (arr.length < 8) continue;
      const m = arr.reduce((a, c) => a + c, 0) / arr.length;
      if (m > bestL) { bestL = m; bestB = b; }
    }
    const mean = (b: number) => { const a = bins.get(b); return a && a.length > 5 ? a.reduce((p, q) => p + q, 0) / a.length : undefined; };
    const yl = mean(bestB - 1), yr = mean(bestB + 1);
    let peak = bestB / 100;
    if (yl !== undefined && yr !== undefined) {
      const den = yl - 2 * bestL + yr;
      if (den !== 0) peak = (bestB + 0.5 * (yl - yr) / den) / 100;
    }
    return { age, expected, clear, peak, score: 1 - Math.abs(peak - expected) / expected };
  });
  return { rings: scored };
}

const dir = 'refs/T-0024';
const frames = {
  walkAngle: gameAngle('top-walk'),
  stopAngle: gameAngle('top-stop'),
  stopRings: gameRings('top-stop'),
  agedAngle: gameAngle('top-aged'),
};

const report = {
  wave: { c: WAVE.c, cg: WAVE.cg, kelvinDeg: WAVE.kelvin * 180 / Math.PI, walkDeg: angleDeg, walkFr: fr },
  synthetic,
  frames,
};
writeFileSync(`${dir}/measure.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ synthetic, frameKeys: Object.keys(frames) }, null, 2));
if (!(synthetic.match.score >= 0.95)) process.exitCode = 1;
if (!(synthetic.mismatch.score < 0.7)) process.exitCode = 1;
const ringScores = (frames.stopRings.rings ?? []).filter(r => r.clear && typeof r.score === 'number').map(r => r.score as number);
if (ringScores.length < 1 || ringScores.some(s => !(s >= 0.95))) process.exitCode = 1;
for (const a of [frames.walkAngle, frames.stopAngle]) {
  if (!('score' in a) || !(a.score >= 0.95)) process.exitCode = 1;
}
