/**
 * Bound lab (T-0009, grok-gait): side view of the bounding controller (src/animals/locomotion/bounding.ts) on a limb
 * skeleton from bodyPlan.ts. Bones, spine, footprints (fore blue, hind orange: hind prints land ahead of fore prints),
 * contact dots and a readout. Params: ?speed=<m/s> (0 = standing, use ?pose=)  ?ts=<timescale, e.g. .25>  ?plan=host|bones
 * ?row=half-bound|gallop-lagomorph (default by speed)  ?ramp=<s to reach speed, default 1.5>  ?pose=sit-up|graze-crouch|scan|rest|crouch
 * ?cycle=1 (stand → graze → sit-up → run → stop, for the pose recording)  ?shot=1 (no clock: window.__lab.advance(s) steps it)
 */
import { createBounding, selectRow, type BoundRowId, type PoseKind, type BoundFrame } from '../src/animals/locomotion/bounding';
import { limbToWorld } from '../src/animals/locomotion/controller';
import type { LimbDims } from '../src/core/animalBehavior';
import { planFor, HOST_GAIT } from './bound-plans';

const q = new URLSearchParams(location.search), num = (k: string, d: number) => (q.has(k) && Number.isFinite(Number(q.get(k))) ? Number(q.get(k)) : d);
const target = num('speed', 8.5), ts = num('ts', 1), ramp = num('ramp', 1.5), planName = q.get('plan') ?? 'host', forced = (q.get('row') as BoundRowId | null) ?? undefined;
const sk = planFor(planName), ctl = createBounding(sk, HOST_GAIT, () => 0, { x: 0, z: 0, heading: 0 });
const canvas = document.getElementById('c') as HTMLCanvasElement, g = canvas.getContext('2d')!, hud = document.getElementById('hud')!;
const fit = () => { canvas.width = innerWidth * devicePixelRatio; canvas.height = innerHeight * devicePixelRatio; canvas.style.width = innerWidth + 'px'; canvas.style.height = innerHeight + 'px'; };
fit(); addEventListener('resize', fit);

let t = 0, frame: BoundFrame | null = null, maxSlip = 0;
const prints: { leg: number; z: number; t: number }[] = [];
/** ?cycle=1 script: [until t, speed, pose] */
const CYCLE: [number, number, PoseKind | null][] = [[1, 0, null], [3, 0, 'graze-crouch'], [4.5, 0, 'sit-up'], [7.5, 6, null], [9, 0, null], [11, 0, 'sit-up']];
function inputs(time: number): [number, PoseKind | null] {
  if (q.get('cycle') === '1') { for (const [until, v, p] of CYCLE) if (time < until) return [v, p]; return [0, null]; }
  return [ramp > 0 ? Math.min(target, target * time / ramp) : target, (q.get('pose') as PoseKind | null) ?? null];
}
function step(dt: number) {
  const n = Math.max(1, Math.ceil(dt / (1 / 240))), h = dt / n;
  for (let k = 0; k < n; k++) {
    const [v, pose] = inputs(t), row = forced;
    frame = ctl.update(h, v, 0, pose ? { kind: pose } : null, row); t += h;
    for (const td of frame.touchdowns) prints.push({ leg: td.leg, z: td.at.z, t });
    if (t > ramp + .5) maxSlip = Math.max(maxSlip, ...frame.slip);
  }
  while (prints.length > 60) prints.shift();
}

const LEG = ['LF', 'LH', 'RF', 'RH'];
function draw() {
  if (!frame) return;
  const W = canvas.width, H = canvas.height, s = Math.min(W / 1.6, H / .7), gy = H * .72;
  const cam = frame.z; // body origin (under the hips) in the middle; travel is −z → screen right
  const X = (z: number) => W * .45 - (z - cam) * s, Y = (y: number) => gy - y * s;
  g.fillStyle = '#1b1d22'; g.fillRect(0, 0, W, H);
  // ground with 10 cm ticks
  g.strokeStyle = '#555'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, gy); g.lineTo(W, gy); g.stroke();
  g.fillStyle = '#444'; for (let m = Math.floor((cam - 2) * 10); m < (cam + 2) * 10; m++) { const x = X(m / 10); g.fillRect(x, gy + 2, 1, m % 10 === 0 ? 10 : 4); }
  // prints
  for (const p of prints) { g.fillStyle = p.leg % 2 ? '#f39a3c' : '#4fa3ff'; g.globalAlpha = .85; g.beginPath(); g.ellipse(X(p.z), gy + 14 + (p.leg < 2 ? 0 : 8), p.leg % 2 ? 7 : 4, 3, 0, 0, 7); g.fill(); }
  g.globalAlpha = 1;
  const pts = (i: number) => {
    const L: LimbDims = i % 2 === 0 ? sk.legs : sk.legs.hind, a = frame!.limbs[i], dir = (u: number) => ({ z: -Math.sin(u), y: -Math.cos(u) });
    const a1 = a.girdle + a.leg, a2 = a1 + a.knee, a3 = a2 + a.wrist, j = a.joint, top = frame!.tops[i];
    const k = { z: j.z + L.upper * dir(a1).z, y: j.y + L.upper * dir(a1).y }, w = { z: k.z + L.lower * dir(a2).z, y: k.y + L.lower * dir(a2).y };
    const f = { z: w.z + (L.foot ?? 0) * dir(a3).z, y: w.y + (L.foot ?? 0) * dir(a3).y };
    return [top, j, k, w, f].map(p => limbToWorld({ x: 0, y: p.y, z: p.z }, frame!.x, frame!.z, 0, frame!.tilt, sk.hips[i]));
  };
  const limbs = [0, 1, 2, 3].map(pts);
  const drawLimb = (i: number, far: boolean) => {
    const P = limbs[i]; g.strokeStyle = far ? (i % 2 ? '#8a5a2c' : '#2f5f93') : (i % 2 ? '#f6a54a' : '#63b3ff'); g.lineWidth = far ? 4 : 6; g.lineCap = 'round'; g.lineJoin = 'round';
    g.beginPath(); P.forEach((p, k) => k ? g.lineTo(X(p.z), Y(p.y)) : g.moveTo(X(p.z), Y(p.y))); g.stroke();
    g.fillStyle = '#fff'; for (const p of P.slice(1, 4)) { g.beginPath(); g.arc(X(p.z), Y(p.y), far ? 2 : 3, 0, 7); g.fill(); }
    if (frame!.contact[i]) { g.fillStyle = '#7f7'; g.beginPath(); g.arc(X(P[4].z), Y(P[4].y) + 6, 4, 0, 7); g.fill(); }
  };
  // far side (right legs) first
  drawLimb(2, true); drawLimb(3, true);
  // spine: hip top → shoulder top, bowed up by the flexion (flexed back = arched)
  const hip = limbs[1][0], sho = limbs[0][0], mid = { z: (hip.z + sho.z) / 2, y: (hip.y + sho.y) / 2 + .03 + .18 * frame.spineFlex * Math.hypot(hip.z - sho.z, hip.y - sho.y) };
  g.strokeStyle = '#d9c7a0'; g.lineWidth = 9; g.beginPath(); g.moveTo(X(hip.z), Y(hip.y + .015)); g.quadraticCurveTo(X(mid.z), Y(mid.y + .015), X(sho.z), Y(sho.y + .015)); g.stroke();
  // head and ears ahead of the shoulder
  const pitch = frame.tilt.pitch, hx = sho.z - .06 * Math.cos(pitch), hy = sho.y + .035 + .06 * Math.sin(pitch);
  g.fillStyle = '#d9c7a0'; g.beginPath(); g.ellipse(X(hx), Y(hy), .035 * s, .025 * s, -pitch, 0, 7); g.fill();
  g.strokeStyle = '#d9c7a0'; g.lineWidth = 5; g.beginPath(); g.moveTo(X(hx + .01), Y(hy + .015)); g.lineTo(X(hx + .035), Y(hy + .075)); g.stroke();
  drawLimb(0, false); drawLimb(1, false);
  // suspension label
  const airborne = frame.contact.every(c => !c), last = frame.plan.suspensions.find(w => { const p = ((frame!.stride - w.from) % 1 + 1) % 1; return p < w.to - w.from; });
  hud.textContent = [
    `t ${t.toFixed(2)} s  timescale ${ts}  plan ${planName}  row ${frame.plan.row}`,
    `speed ${Math.abs(inputs(t - 1e-6)[0]).toFixed(2)} m/s  ${frame.plan.hz.toFixed(2)} Hz  stride ${frame.plan.stride.toFixed(2)} m`,
    `duty ${frame.plan.duty.toFixed(3)} (data ${frame.plan.dutyData.toFixed(3)})  phase ${frame.stride.toFixed(2)}`,
    `contact ${frame.contact.map((c, i) => c ? LEG[i] : '··').join(' ')}  ${airborne ? (last?.kind ?? 'air').toUpperCase() + ' SUSPENSION' : ''}`,
    `spine flex ${frame.spineFlex.toFixed(2)} rad  pitch ${frame.tilt.pitch.toFixed(2)}  pose ${frame.pose}`,
    `max planted slip ${(maxSlip * 1000).toFixed(1)} mm  leash steps ${frame.leashes}`,
    `prints: fore ● blue, hind ● orange (top row left, bottom row right)`,
  ].join('\n');
}
const lab = { advance(seconds: number) { step(seconds); draw(); return { t, frame }; }, get t() { return t; }, get frame() { return frame; } };
(window as unknown as { __lab: typeof lab }).__lab = lab;
step(1e-3); draw();
if (q.get('shot') !== '1') { let last = performance.now(); const tick = (now: number) => { const dt = Math.min(.05, (now - last) / 1000) * ts; last = now; step(dt); draw(); requestAnimationFrame(tick); }; requestAnimationFrame(tick); }
