/**
 * After-frame scores for T-0030. Same foam cut as refs/water/river-audit/measure.mjs.
 * Locality: of the foam pixels in an audit box, the share whose water-plane hit lies in a step lee
 * (channelRough.inLee, sample = half a near water-cell diagonal). No foam scores 1.
 * Advection: Pearson correlation of a water box between flow-*.png, searched along the projected
 * channel direction. Metres come from that pixel shift and the camera. The clock is the rAF
 * estimator capture.mjs injects (same 0.05 s cap as main.ts), cross-checked against the wall gap.
 *
 *   npx tsx tasks/evidence/T-0030/score.ts
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import * as THREE from 'three';
import { png, box, isFoamPixel, FOAM } from '../../../refs/water/river-audit/measure.mjs';
import { positionCamera, DEFAULT_PITCH, RIDER_HEIGHT } from '../../../src/render/math';
import { STAGES } from '../../../src/core/stages/elevation';
import { CHUNK_SIZE } from '../../../src/core/world';
import { riverAt } from '../../../src/core/stages/rivers';
import { advectionScore, foamLocality, inLee, stepsNear } from '../../../src/core/stages/channelRough';

const SEED = 1400;
const NEAR_SEG = 32;
const SAMPLE = (CHUNK_SIZE / NEAR_SEG) * Math.SQRT2 / 2;
const ROOT = 'tasks/evidence/T-0030';
STAGES.on = true;
STAGES.seed = SEED;

/** Rectangles picked on these after-frames. T-0075's rear three-quarter camera put the October 21 audit boxes on the sky. */
const WATER: Record<string, Record<string, number[]>> = {
  'slow1/across-0.png': { channel: [860, 500, 1160, 600] },
};
const AUDIT: Record<string, Record<string, number[]>> = {
  'fast1/across-0.png': { left: [20, 330, 560, 390], right: [720, 360, 1260, 420] },
  'fast1/across-2.png': { left: [20, 330, 560, 390], right: [720, 360, 1260, 420] },
  'order2/across-0.png': { left: [20, 300, 300, 380] },
  'slow1/across-0.png': { left: [60, 335, 470, 380], right: [960, 330, 1270, 380] },
  'slow1/downstream-0.png': { near: [20, 280, 380, 400] },
};

type Img = ReturnType<typeof png>;
const lum = (img: Img, x: number, y: number) => {
  const i = x * img.bpp, row = img.rows[y];
  return 0.2126 * row[i] + 0.7152 * row[i + 1] + 0.0722 * row[i + 2];
};
const foamAt = (img: Img, x: number, y: number) => {
  const i = x * img.bpp, row = img.rows[y];
  return isFoamPixel(row[i], row[i + 1], row[i + 2]);
};

function cameraFor(x: number, z: number, yaw: number, aspect: number) {
  const camera = new THREE.PerspectiveCamera(48, aspect, 0.2, 700);
  positionCamera(camera, x, z, RIDER_HEIGHT, yaw, DEFAULT_PITCH, 0);
  return camera;
}
function project(camera: THREE.PerspectiveCamera, x: number, y: number, z: number, w: number, h: number) {
  const v = new THREE.Vector3(x, y, z).project(camera);
  return { px: (v.x + 1) / 2 * w, py: (1 - v.y) / 2 * h, ndcZ: v.z };
}
function unproject(camera: THREE.PerspectiveCamera, px: number, py: number, w: number, h: number, y0: number) {
  const ndc = new THREE.Vector3((px + 0.5) / w * 2 - 1, -((py + 0.5) / h * 2 - 1), 0.5);
  ndc.unproject(camera);
  const dir = ndc.sub(camera.position).normalize();
  if (Math.abs(dir.y) < 1e-8) return undefined;
  let y = y0, x = 0, z = 0;
  for (let k = 0; k < 4; k++) {
    const t = (y - camera.position.y) / dir.y;
    if (!(t > 0)) return undefined;
    x = camera.position.x + dir.x * t;
    z = camera.position.z + dir.z * t;
    y = riverAt(SEED, x, z)?.surface ?? y;
  }
  return { x, z, hit: riverAt(SEED, x, z) };
}
function pearson(a: Img, b: Img, rect: number[], sx: number, sy: number) {
  const [x0, y0, x1, y1] = rect;
  let n = 0, s0 = 0, s1 = 0, s00 = 0, s11 = 0, s01 = 0;
  for (let y = y0; y < y1; y += 1) for (let x = x0; x < x1; x += 1) {
    const u = x + sx, v = y + sy;
    if (u < 0 || v < 0 || u >= b.w || v >= b.h) continue;
    const p = lum(a, x, y), q = lum(b, u, v);
    n++; s0 += p; s1 += q; s00 += p * p; s11 += q * q; s01 += p * q;
  }
  if (n < 80) return { n, r: -1 };
  const m0 = s0 / n, m1 = s1 / n, v0 = s00 / n - m0 * m0, v1 = s11 / n - m1 * m1;
  if (v0 < 0.25 || v1 < 0.25) return { n, r: 0, flat: true as const };
  return { n, r: (s01 / n - m0 * m1) / Math.sqrt(v0 * v1) };
}

const views = JSON.parse(readFileSync('refs/water/river-audit/views.json', 'utf8'));
const sites = ['slow1', 'fast1', 'order2'] as const;
const report: Record<string, unknown> = { FOAM, sampleM: +SAMPLE.toFixed(4), seed: SEED, sites: {} };

for (const site of sites) {
  const v = views[site];
  const dir = `${ROOT}/${site}`;
  const siteOut: Record<string, unknown> = {};
  const boxes: Record<string, unknown> = {};
  for (const [file, named] of [...Object.entries(AUDIT), ...Object.entries(WATER)]) {
    if (!file.startsWith(site + '/')) continue;
    const path = `${dir}/${file.slice(site.length + 1)}`;
    if (!existsSync(path)) { boxes[file] = 'missing'; continue; }
    const img = png(path);
    const prev = boxes[file] && typeof boxes[file] === 'object' ? boxes[file] as Record<string, unknown> : {};
    boxes[file] = { ...prev, ...Object.fromEntries(Object.entries(named).map(([k, b]) => [k, box(img, b[0], b[1], b[2], b[3])])) };
  }
  siteOut.boxes = boxes;

  const across = existsSync(`${dir}/across-0.png`) ? png(`${dir}/across-0.png`) : undefined;
  if (across) {
    const camera = cameraFor(v.view.x, v.view.z, v.view.across, across.w / across.h);
    const y0 = riverAt(SEED, v.river.x, v.river.z)?.surface ?? 0;
    const named = { ...(AUDIT[`${site}/across-0.png`] ?? {}), ...(WATER[`${site}/across-0.png`] ?? {}) };
    const locality: Record<string, unknown> = {};
    for (const [name, rect] of Object.entries(named)) {
      const foam: boolean[] = [], lee: boolean[] = [];
      let water = 0;
      for (let y = rect[1]; y < rect[3]; y += 2) for (let x = rect[0]; x < rect[2]; x += 2) {
        const hit = unproject(camera, x, y, across.w, across.h, y0);
        const on = !!hit?.hit && hit.hit.d <= hit.hit.half;
        if (!on) continue;
        water++;
        const isFoam = foamAt(across, x, y);
        const inL = stepsNear(SEED, hit!.x, hit!.z).some(step => inLee(hit!.x, hit!.z, step, SAMPLE));
        foam.push(isFoam); lee.push(inL);
      }
      locality[name] = { waterSamples: water, foamLocality: +foamLocality(foam, lee).toFixed(4), foamSamples: foam.filter(Boolean).length };
    }
    const steps = stepsNear(SEED, v.river.x, v.river.z).map(step => {
      const centre = { x: step.x + step.dirX * step.height * 0.5, z: step.z + step.dirZ * step.height * 0.5 };
      const surf = riverAt(SEED, centre.x, centre.z)?.surface ?? y0;
      const p = project(camera, centre.x, surf, centre.z, across.w, across.h);
      const onScreen = p.ndcZ < 1 && p.px >= 0 && p.px < across.w && p.py >= 0 && p.py < across.h;
      let leeBox: ReturnType<typeof box> | undefined;
      if (onScreen) {
        const x0 = Math.max(0, Math.floor(p.px - 24)), y0p = Math.max(0, Math.floor(p.py - 18));
        const x1 = Math.min(across.w, Math.ceil(p.px + 24)), y1 = Math.min(across.h, Math.ceil(p.py + 18));
        if (x1 - x0 > 8 && y1 - y0p > 8) leeBox = box(across, x0, y0p, x1, y1);
      }
      return { x: +step.x.toFixed(2), z: +step.z.toFixed(2), height: step.height, slope: +step.slope.toFixed(4), screen: onScreen ? { x: +p.px.toFixed(1), y: +p.py.toFixed(1) } : null, leeBox };
    });
    siteOut.locality = locality;
    siteOut.steps = steps;
    siteOut.model = riverAt(SEED, v.river.x, v.river.z);
  }

  const obsPath = `${dir}/observations.json`;
  const flow0 = existsSync(`${dir}/flow-0.png`) ? png(`${dir}/flow-0.png`) : undefined;
  const flowN = [4, 3, 2, 1].map(i => ({ i, p: `${dir}/flow-${i}.png` })).find(f => existsSync(f.p));
  const flow4 = flowN ? png(flowN.p) : undefined;
  if (across && flow0 && flow4 && existsSync(obsPath)) {
    const obs = JSON.parse(readFileSync(obsPath, 'utf8'));
    const fi = flowN?.i ?? 1;
    const est = (obs.flow ?? []).map((f: { est?: { shader: number } }) => f.est?.shader);
    const walls = (obs.flow ?? []).map((f: { at: string }) => Date.parse(f.at));
    const shaderDt = est[fi] !== undefined && est[0] !== undefined ? est[fi] - est[0] : undefined;
    const wallDt = Number.isFinite(walls[fi]) && Number.isFinite(walls[0]) ? (walls[fi] - walls[0]) / 1000 : undefined;
    const dt = shaderDt ?? wallDt ?? 2;
    const camera = cameraFor(v.view.x, v.view.z, v.view.across, flow0.w / flow0.h);
    const hit = riverAt(SEED, v.river.x, v.river.z);
    const named = (Object.values(WATER[`${site}/across-0.png`] ?? {})[0]
      ?? Object.values(AUDIT[`${site}/across-0.png`] ?? {})[0]) as number[] | undefined;
    const adv: Record<string, unknown> = { shaderDt, wallDt, dtUsed: dt };
    if (hit && named) {
      const y = hit.surface;
      const a = project(camera, v.river.x, y, v.river.z, flow0.w, flow0.h);
      const b = project(camera, v.river.x + hit.dirX, y, v.river.z + hit.dirZ, flow0.w, flow0.h);
      const pxPerM = Math.hypot(b.px - a.px, b.py - a.py);
      const ux = (b.px - a.px) / (pxPerM || 1), uy = (b.py - a.py) / (pxPerM || 1);
      const expectPx = hit.speed * dt * pxPerM;
      let best = { r: -2, along: 0, cross: 0 };
      const crossMax = 8, alongMax = Math.max(12, Math.ceil(Math.abs(expectPx) * 2.2));
      for (let along = -4; along <= alongMax; along++) for (let cross = -crossMax; cross <= crossMax; cross++) {
        const sx = Math.round(ux * along + -uy * cross), sy = Math.round(uy * along + ux * cross);
        const c = pearson(flow0, flow4, named, sx, sy);
        if (c.r > best.r) best = { r: c.r, along, cross };
      }
      const measured = dt > 0 ? best.along / (pxPerM || 1) / dt : 0;
      adv.speed = +hit.speed.toFixed(4);
      adv.pxPerM = +pxPerM.toFixed(2);
      adv.expectPx = +expectPx.toFixed(2);
      adv.best = { r: +best.r.toFixed(3), alongPx: best.along, crossPx: best.cross };
      adv.measured = +measured.toFixed(4);
      adv.advectionScore = +(best.r >= 0.5 ? advectionScore(measured, hit.speed) : NaN);
      adv.flatOrWeak = best.r < 0.5;
      adv.zeroShift = +pearson(flow0, flow4, named, 0, 0).r.toFixed(3);
    }
    siteOut.advection = adv;
  }
  (report.sites as Record<string, unknown>)[site] = siteOut;
  const model = siteOut.model as { speed?: number; slope?: number; depth?: number } | undefined;
  console.log(site, 'model', model ? { speed: model.speed, slope: model.slope, depth: model.depth } : 'no-frame', 'adv', siteOut.advection ?? 'n/a');
}

writeFileSync(`${ROOT}/score.json`, JSON.stringify(report, (k, v) => (typeof v === 'number' && !Number.isFinite(v) ? null : v), 1));
console.log('wrote', `${ROOT}/score.json`);
