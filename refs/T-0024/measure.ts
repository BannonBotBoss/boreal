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

const dir = 'refs/T-0024';
const frames: Record<string, unknown> = {};
for (const label of ['top-2s', 'top-4s', 'top-6s', 'top-stop']) {
  if (!existsSync(`${dir}/${label}.png`) || !existsSync(`${dir}/${label}.json`)) continue;
  const wake = JSON.parse(readFileSync(`${dir}/${label}.json`, 'utf8')) as {
    now?: number; view?: TopCam; rings?: { x: number; z: number; t0: number; amp: number }[];
    wakes?: { x: number; z: number; heading: number; t0: number; speed: number; angle: number; length: number; amp: number }[];
  };
  if (!wake?.view || wake.now === undefined) { frames[label] = { missing: true }; continue; }
  const img = png(`${dir}/${label}.png`);
  const body = { x: wake.view.x, z: wake.view.z };
  const pts = brightPoints(img, wake.view, 0.35).filter(p => Math.hypot(p.x - body.x, p.z - body.z) > 0.45);
  const slot = (wake.wakes ?? []).filter(w => w.amp > 0).at(-1);
  const ringFits = (wake.rings ?? []).filter(r => r.amp > 0).map(r => {
    const age = Math.max(0, wake.now! - r.t0);
    const expected = WAVE.cg * age;
    const near = pts.filter(p => Math.hypot(p.x - r.x, p.z - r.z) < Math.max(0.55, expected + 0.25));
    const fit = fitDisturbance(near, r, slot?.heading ?? wake.view!.heading);
    const sc = expected > 0.05 ? wakeScore({ radius: fit.radius, angleDeg: 1 }, { radius: expected, angleDeg: 1 }) : undefined;
    return { age, expected, radius: fit.radius, nRadius: fit.nRadius, score: sc?.radius };
  }).filter(r => r.age > 0.2 && r.nRadius > 20);
  let angle: { angleDeg: number; expected: number; nAngle: number; score: number } | undefined;
  if (slot) {
    const fit = fitDisturbance(pts, slot, slot.heading);
    const expected = slot.angle * 180 / Math.PI;
    angle = { angleDeg: fit.angleDeg, expected, nAngle: fit.nAngle, score: wakeScore(fit, { radius: fit.radius || 1, angleDeg: expected }).angle };
  }
  const best = ringFits.slice().sort((a, b) => (b.score ?? -1) - (a.score ?? -1))[0];
  frames[label] = { speed: slot?.speed, best, angle, bright: pts.length };
}

const report = {
  wave: { c: WAVE.c, cg: WAVE.cg, kelvinDeg: WAVE.kelvin * 180 / Math.PI, walkDeg: angleDeg, walkFr: fr },
  synthetic,
  frames,
};
writeFileSync(`${dir}/measure.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ synthetic, frameKeys: Object.keys(frames) }, null, 2));
if (!(synthetic.match.score >= 0.95)) process.exitCode = 1;
if (!(synthetic.mismatch.score < 0.7)) process.exitCode = 1;
