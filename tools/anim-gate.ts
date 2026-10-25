/**
 * Animation gate (T-0020). The recording is sampleBehaviour. The reference is diagramPose in this file:
 * it rebuilds the sagittal diagram from the behaviour row (touchdown, duty, sweep, lift, head pitch) and does not
 * call sampleBehaviour, footTarget, or footState.
 *
 * Score = share of six questions over FRAME_N frames. Pass at >= 0.95.
 * Calibration: an unshifted recording of a row scores >= 0.95; hare-flee shifted by half a cycle scores below 0.95.
 * Known match on the silhouette is IoU 1 (identical rasters). A 5 % body-length keypoint band is question 3.
 */
import { gravity } from '../src/proc/physics';
import {
  behaviourById, headDownOf, jawOnAt, TUCK_HIP_M, type BehaviourAnim, type FootSpec,
} from '../src/core/behaviourData';
import { KEYS, sampleBehaviour, type KeyName, type PoseSample, type Pt } from '../src/core/behaviourPose';

export const FRAME_N = 8;
export const PASS_AT = 0.95;
export const KEY_BAND = 0.05;
export { KEYS };

const frac = (v: number) => v - Math.floor(v);
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const PAWS: KeyName[] = ['pawLF', 'pawLH', 'pawRF', 'pawRH'];

function rotDown(x: number, y: number, a: number): Pt {
  const c = Math.cos(a), s = Math.sin(a);
  return { x: x * c + y * s, y: -x * s + y * c };
}
function leapBob(phase: number, leap: NonNullable<BehaviourAnim['leap']>) {
  const T = leap.seconds, c = leap.crouch, fl = leap.flight, Ta = fl * T, g = gravity();
  const t = clamp01(phase), air = clamp01((t - c) / fl), tau = air * Ta, dip = leap.dip, land = 1 - c - fl;
  if (t < c) return -dip * Math.sin((t / c) * Math.PI / 2);
  if (t < c + fl) return -dip * (1 - air) + (g * Ta / 2) * tau - g * tau * tau / 2;
  return -0.8 * dip * Math.sin(Math.min(1, (t - c - fl) / land) * Math.PI);
}
function diagramBody(b: BehaviourAnim, bob: number): Pick<PoseSample['points'], 'nose' | 'ear' | 'spine' | 'shoulder' | 'hip' | 'tail'> {
  const hip = { x: b.bones.hipX, y: b.bones.hipY - b.drop + bob };
  const shoulder = { x: b.bones.shoulderX, y: b.bones.shoulderY - b.drop + bob };
  const nose0 = { x: b.bones.noseX, y: b.bones.noseY - b.drop + bob };
  const tail = { x: b.bones.tailX, y: b.bones.tailY - b.drop + bob };
  const n = rotDown(nose0.x - shoulder.x, nose0.y - shoulder.y, b.head);
  const e = rotDown(0, b.bones.ear, b.head);
  const nose = { x: shoulder.x + n.x, y: shoulder.y + n.y };
  return {
    hip, shoulder, nose, tail,
    ear: { x: nose.x + e.x, y: nose.y + e.y },
    spine: { x: (hip.x + shoulder.x) / 2, y: (hip.y + shoulder.y) / 2 },
  };
}
/** Stance/swing paw from the row alone. `follow` is the canid swing follow-through. */
function diagramGaitPaw(phase: number, spec: FootSpec, follow: number) {
  const s = frac(phase - spec.touchdown);
  if (s < spec.duty || spec.duty >= 1 - 1e-9) {
    const u = spec.duty <= 1e-9 ? 0 : Math.min(1, s / spec.duty);
    return { x: spec.restX + spec.sweep * (0.5 - u), y: spec.contactY, contact: spec.down };
  }
  const u = (s - spec.duty) / (1 - spec.duty);
  const m = follow * (1 - spec.duty) / spec.duty;
  const smooth = u * u * (3 - 2 * u);
  const zBack = spec.sweep * (0.5 - smooth + m * u * (1 - u) * (1 - 2 * u));
  return { x: spec.restX - zBack, y: spec.lift * Math.sin(Math.PI * u), contact: 'air' as const };
}
function diagramLeapPaw(b: BehaviourAnim, phase: number, i: number, spec: FootSpec) {
  const leap = b.leap!;
  const t = clamp01(phase), airT = clamp01((t - leap.crouch) / leap.flight);
  const s = Math.sin(airT * Math.PI);
  const push = Math.sin(Math.min(1, airT * 2) * Math.PI);
  const hip = i % 2 === 0 ? b.bones.shoulderY : b.bones.hipY;
  const k = hip / TUCK_HIP_M;
  const front = i % 2 === 0;
  const z = front ? 0.08 * k * s : (0.3 * push + 0.1 * s) * k;
  const tuck = front ? 0.55 * k * s : 0.4 * k * s;
  const flying = t > leap.crouch && t < leap.crouch + leap.flight;
  if (!flying) return { x: spec.restX, y: spec.contactY, contact: spec.down };
  return { x: spec.restX - z, y: Math.max(0, leapBob(phase, leap)) + tuck, contact: 'air' as const };
}

/** Reference pose at `phase`. Built only from the behaviour row. */
export function diagramPose(id: string, phase: number): PoseSample {
  const b = behaviourById(id);
  const p = frac(phase);
  const bob = b.kind === 'leap' && b.leap ? leapBob(p, b.leap) : 0;
  const limbs = b.feet.map((spec, i) => {
    if (b.kind === 'leap') return diagramLeapPaw(b, p, i, spec);
    if (b.kind === 'plant') return { x: spec.restX, y: spec.contactY, contact: spec.down };
    return diagramGaitPaw(p, spec, b.follow);
  });
  const points = diagramBody(b, bob) as PoseSample['points'];
  limbs.forEach((L, i) => { points[PAWS[i]] = { x: L.x, y: L.y }; });
  const contact = limbs.map(L => L.contact) as PoseSample['contact'];
  return {
    phase: p, points, contact,
    jaw: jawOnAt(b.jaw, p),
    headDown: headDownOf(points.nose.y, points.shoulder.y),
    airborne: contact.every(c => c === 'air'),
  };
}

const RASTER = { w: 220, h: 140, ox: 90, oy: 110, scale: 100, radius: 2.5 };
function raster(sample: PoseSample, bodyLength: number) {
  const { w, h, ox, oy, scale, radius } = RASTER;
  const mask = new Uint8Array(w * h);
  const s = scale / bodyLength;
  const hip = sample.points.hip;
  const px = (p: Pt) => ({ x: ox + (p.x - hip.x) * s, y: oy - (p.y - hip.y) * s });
  const stamp = (x: number, y: number) => {
    const x0 = Math.max(0, Math.floor(x - radius)), x1 = Math.min(w - 1, Math.ceil(x + radius));
    const y0 = Math.max(0, Math.floor(y - radius)), y1 = Math.min(h - 1, Math.ceil(y + radius));
    for (let yy = y0; yy <= y1; yy++) for (let xx = x0; xx <= x1; xx++) {
      const dx = xx + 0.5 - x, dy = yy + 0.5 - y;
      if (dx * dx + dy * dy <= radius * radius) mask[yy * w + xx] = 1;
    }
  };
  const stroke = (a: Pt, b: Pt) => {
    const A = px(a), B = px(b);
    const n = Math.max(1, Math.ceil(Math.hypot(B.x - A.x, B.y - A.y)));
    for (let i = 0; i <= n; i++) stamp(A.x + (B.x - A.x) * i / n, A.y + (B.y - A.y) * i / n);
  };
  const p = sample.points;
  stroke(p.hip, p.spine); stroke(p.spine, p.shoulder); stroke(p.shoulder, p.nose); stroke(p.nose, p.ear); stroke(p.hip, p.tail);
  stroke(p.shoulder, p.pawLF); stroke(p.shoulder, p.pawRF); stroke(p.hip, p.pawLH); stroke(p.hip, p.pawRH);
  return mask;
}
/** Intersection over union after hip alignment and body-length scale. Identical poses score 1. */
export function silhouetteIoU(a: PoseSample, b: PoseSample, bodyLength: number) {
  const A = raster(a, bodyLength), B = raster(b, bodyLength);
  let inter = 0, union = 0;
  for (let i = 0; i < A.length; i++) {
    const x = A[i], y = B[i];
    if (x || y) union++;
    if (x && y) inter++;
  }
  return union === 0 ? 1 : inter / union;
}
export function keyFraction(a: PoseSample, b: PoseSample, bodyLength: number) {
  const band = KEY_BAND * bodyLength;
  let hit = 0;
  for (const k of KEYS) {
    const d = Math.hypot(a.points[k].x - b.points[k].x, a.points[k].y - b.points[k].y);
    if (d <= band + 1e-9) hit++;
  }
  return hit / KEYS.length;
}

export interface Measured {
  duty: number[];
  touchdown: number[];
  air: number;
}
/** Duty, touchdown phase, and airborne fraction of a recorder, over `n` equal steps. */
export function measureCycle(record: (phase: number) => PoseSample, n = 200): Measured {
  const down: boolean[][] = [[], [], [], []];
  let air = 0;
  for (let i = 0; i < n; i++) {
    const s = record(i / n);
    if (s.airborne) air++;
    s.contact.forEach((c, k) => { down[k][i] = c !== 'air'; });
  }
  const duty = down.map(col => col.filter(Boolean).length / n);
  const touchdown = down.map(col => {
    for (let i = 0; i < n; i++) if (col[i] && !col[(i - 1 + n) % n]) return i / n;
    return col[0] ? 0 : Number.NaN;
  });
  return { duty, touchdown, air: air / n };
}

function contactSig(s: PoseSample) {
  return `${s.contact.join(',')}|${s.jaw ? 1 : 0}|${s.headDown ? 1 : 0}|${s.airborne ? 1 : 0}`;
}

export interface FrameScore {
  phase: number;
  iou: number;
  keys: number;
  order: boolean;
  contact: boolean;
  pass: boolean[];
}
export interface GateReport {
  id: string;
  frames: number;
  score: number;
  pass: boolean;
  q6: string;
  questions: string[];
  frame: FrameScore[];
  failed: number[];
}

const QUESTION = [
  'recording: same frame count over one cycle',
  'overall: silhouette IoU after hip and body-length normalisation >= 0.95',
  'body parts: share of keypoints within 5% of body length >= 0.95',
  'order and timing: paw, head, and airborne flags match',
  'contact: feet and jaws touch in the same frames',
  'real data: duty, footfall, and flight match the published row',
];

function realData(b: BehaviourAnim, record: (phase: number) => PoseSample): { pass: boolean; detail: string } {
  const m = measureCycle(record);
  if (b.kind === 'leap' && b.leap) {
    const ok = Math.abs(m.air - b.leap.flight) <= 0.02;
    return { pass: ok, detail: `airborne ${m.air.toFixed(3)} vs flight ${b.leap.flight}` };
  }
  if (b.kind === 'plant') {
    const ok = b.speed === 0 && m.duty.every((d, i) => Math.abs(d - b.feet[i].duty) <= 0.02);
    return { pass: ok, detail: `plant duty ${m.duty.map(d => d.toFixed(2)).join(',')}` };
  }
  const dutyOk = m.duty.every((d, i) => Math.abs(d - b.feet[i].duty) <= 0.02);
  const tdOk = m.touchdown.every((t, i) => Number.isFinite(t) && Math.abs(frac(t - b.feet[i].touchdown + 0.5) - 0.5) <= 0.015);
  const hz = b.speed > 0 && b.feet[0].sweep > 0 ? b.speed / (b.feet[0].sweep / b.feet[0].duty) : 0;
  const hzOk = b.hz === 0 || Math.abs(hz - b.hz) / b.hz <= 0.02;
  return {
    pass: dutyOk && tdOk && hzOk,
    detail: `duty ${m.duty.map(d => d.toFixed(3)).join(',')} vs ${b.feet.map(f => f.duty.toFixed(3)).join(',')}; hz ${hz.toFixed(3)} vs ${b.hz.toFixed(3)}`,
  };
}

export function scoreAnimation(id: string, record: (phase: number) => PoseSample = p => sampleBehaviour(id, p), frames = FRAME_N): GateReport {
  const b = behaviourById(id);
  const q6 = realData(b, record);
  const frame: FrameScore[] = [];
  for (let i = 0; i < frames; i++) {
    const phase = i / frames;
    const got = record(phase);
    const ref = diagramPose(id, phase);
    const iou = silhouetteIoU(got, ref, b.bones.bodyLength);
    const keys = keyFraction(got, ref, b.bones.bodyLength);
    const order = contactSig(got) === contactSig(ref);
    const contact = got.contact.every((c, k) => c === ref.contact[k]) && got.jaw === ref.jaw;
    const pass = [frames === FRAME_N, iou >= PASS_AT, keys >= PASS_AT, order, contact, q6.pass];
    frame.push({ phase, iou, keys, order, contact, pass });
  }
  const marks = frame.flatMap(f => f.pass);
  const score = marks.filter(Boolean).length / marks.length;
  const failed = frame.flatMap((f, i) => f.pass.every(Boolean) ? [] : [i]);
  return { id, frames, score, pass: score >= PASS_AT, q6: q6.detail, questions: QUESTION, frame, failed };
}

/** What the sampled frames show. Written from the recording, not from the task sentence. */
export function seeFrames(id: string, frames = FRAME_N): string {
  const lines = [`${id}: ${frames} frames over one cycle`];
  for (let i = 0; i < frames; i++) {
    const s = sampleBehaviour(id, i / frames);
    const paws = ['LF', 'LH', 'RF', 'RH'].map((n, k) => `${n} ${s.contact[k]}`).join(', ');
    const nose = s.points.nose, hip = s.points.hip;
    lines.push(`frame ${i} phase ${s.phase.toFixed(3)}: nose (${nose.x.toFixed(3)}, ${nose.y.toFixed(3)}) m, hip y ${hip.y.toFixed(3)}, ${paws}, jaw ${s.jaw ? 'on target' : 'off'}, head ${s.headDown ? 'down' : 'up'}, ${s.airborne ? 'airborne' : 'supported'}`);
  }
  return lines.join('\n');
}

function svgPose(s: PoseSample, bodyLength: number, x0: number, y0: number, w: number, h: number) {
  const scale = (w * 0.7) / bodyLength;
  const hip = s.points.hip;
  const p = (q: Pt) => `${(x0 + w * 0.22 + (q.x - hip.x) * scale).toFixed(1)},${(y0 + h * 0.72 - (q.y - hip.y) * scale).toFixed(1)}`;
  const line = (a: Pt, b: Pt) => `<line x1="${p(a).split(',')[0]}" y1="${p(a).split(',')[1]}" x2="${p(b).split(',')[0]}" y2="${p(b).split(',')[1]}" stroke="#1c1a16" stroke-width="1.4"/>`;
  const pts = s.points;
  return [
    line(pts.hip, pts.spine), line(pts.spine, pts.shoulder), line(pts.shoulder, pts.nose), line(pts.nose, pts.ear), line(pts.hip, pts.tail),
    line(pts.shoulder, pts.pawLF), line(pts.shoulder, pts.pawRF), line(pts.hip, pts.pawLH), line(pts.hip, pts.pawRH),
  ].join('');
}

/** Side-by-side strip: recording on top, reference underneath. */
export function stripSvg(id: string, frames = FRAME_N) {
  const b = behaviourById(id);
  const fw = 120, fh = 90, pad = 8;
  const W = pad + frames * fw, H = pad * 2 + fh * 2 + 16;
  let body = `<rect width="100%" height="100%" fill="#f4f1ea"/>`;
  body += `<text x="${pad}" y="14" font-family="sans-serif" font-size="11" fill="#333">${id} recording</text>`;
  body += `<text x="${pad}" y="${pad + fh + 26}" font-family="sans-serif" font-size="11" fill="#333">${id} reference</text>`;
  for (let i = 0; i < frames; i++) {
    const phase = i / frames;
    const y1 = 18, y2 = pad + fh + 30;
    body += svgPose(sampleBehaviour(id, phase), b.bones.bodyLength, pad + i * fw, y1, fw, fh);
    body += svgPose(diagramPose(id, phase), b.bones.bodyLength, pad + i * fw, y2, fw, fh);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${body}</svg>\n`;
}

export function frameSvg(sample: PoseSample, bodyLength: number, label: string) {
  const w = 240, h = 160;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="100%" height="100%" fill="#f7f5f0"/>${svgPose(sample, bodyLength, 0, 10, w, h - 10)}<text x="8" y="16" font-family="sans-serif" font-size="12" fill="#333">${label}</text></svg>\n`;
}

export function gateLines(report: GateReport) {
  const head = `${report.id} score ${report.score.toFixed(3)} ${report.pass ? 'PASS' : 'FAIL'} (${report.frames} frames)`;
  const qs = report.questions.map((q, i) => {
    const ok = report.frame.every(f => f.pass[i]);
    return `${ok ? 'pass' : 'FAIL'}  ${i + 1}. ${q}`;
  });
  const bad = report.failed.length ? `failed frames: ${report.failed.join(',')}` : 'failed frames: none';
  return [head, ...qs, report.q6, bad].join('\n');
}
