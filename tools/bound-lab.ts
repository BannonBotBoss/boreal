/**
 * Bound lab (T-0009, grok-gait): side view of the bounding controller (src/animals/locomotion/bounding.ts) on a limb
 * skeleton from bodyPlan.ts. Bones, spine, footprints (fore blue, hind orange: hind prints land ahead of fore prints),
 * contact dots and a readout. Params: ?speed=<m/s> (0 = standing, use ?pose=)  ?ts=<timescale, e.g. .25>  ?plan=host|bones|canid-limits|blob
 * ?row=half-bound|gallop-lagomorph (default by speed)  ?ramp=<s to reach speed, default 1.5>  ?pose=sit-up|graze-crouch|scan|rest|crouch
 * ?cycle=1 (stand → graze → sit-up → run → stop, for the pose recording)  ?shot=1 (no clock: window.__lab.advance(s) steps it)
 * Run 3: ?plan=game|split|blade|v3 with an optional ':level' (level-trunk posture), e.g. ?plan=v3:level (tools/bound-plans.ts);
 * ?turn=<deg> stands still and asks for heading +deg at 1 s, back to 0 at 5 s (turning in place, bounding.ts TURN), with a top view.
 * Split hind feet draw the toes (MTP → toe tip); a fore blade draws pivot → glenoid.
 */
import { createBounding, limbPoints, GIRDLE, type BoundRowId, type PoseKind, type BoundFrame } from '../src/animals/locomotion/bounding';
import { planFor, poseFor, HOST_GAIT } from './bound-plans';

const q = new URLSearchParams(location.search), num = (k: string, d: number) => (q.has(k) && Number.isFinite(Number(q.get(k))) ? Number(q.get(k)) : d);
const target = num('speed', 8.5), ts = num('ts', 1), ramp = num('ramp', 1.5), planName = q.get('plan') ?? 'host', forced = (q.get('row') as BoundRowId | null) ?? undefined;
const sk = planFor(planName), ctl = createBounding(sk, HOST_GAIT, () => 0, { x: 0, z: 0, heading: 0 }, GIRDLE, { pose: poseFor(planName), turnInPlace: true });
const turnDeg = q.has('turn') ? num('turn', 90) : null, headingAt = (time: number) => turnDeg !== null && time >= 1 && time < 5 ? turnDeg * Math.PI / 180 : 0;
const canvas = document.getElementById('c') as HTMLCanvasElement, g = canvas.getContext('2d')!, hud = document.getElementById('hud')!;
const fit = () => { canvas.width = innerWidth * devicePixelRatio; canvas.height = innerHeight * devicePixelRatio; canvas.style.width = innerWidth + 'px'; canvas.style.height = innerHeight + 'px'; };
fit(); addEventListener('resize', fit);

let t = 0, frame: BoundFrame | null = null, maxSlip = 0;
const prints: { leg: number; z: number; t: number }[] = [];
/** ?cycle=1 script: [until t, speed, pose] */
const CYCLE: [number, number, PoseKind | null][] = [[1, 0, null], [3, 0, 'graze-crouch'], [4.5, 0, 'sit-up'], [7.5, 6, null], [9, 0, null], [11, 0, 'sit-up']];
function inputs(time: number): [number, PoseKind | null] {
  if (q.get('cycle') === '1') { for (const [until, v, p] of CYCLE) if (time < until) return [v, p]; return [0, null]; }
  if (turnDeg !== null) return [0, (q.get('pose') as PoseKind | null) ?? null];
  return [ramp > 0 ? Math.min(target, target * time / ramp) : target, (q.get('pose') as PoseKind | null) ?? null];
}
function step(dt: number) {
  const n = Math.max(1, Math.ceil(dt / (1 / 240))), h = dt / n;
  for (let k = 0; k < n; k++) {
    const [v, pose] = inputs(t), row = forced;
    frame = ctl.update(h, v, headingAt(t), pose ? { kind: pose } : null, row); t += h;
    for (const td of frame.touchdowns) prints.push({ leg: td.leg, z: td.at.z, t });
    if (t > ramp + .5 || turnDeg !== null) maxSlip = Math.max(maxSlip, ...frame.slip);
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
  const limbs = [0, 1, 2, 3].map(i => limbPoints(sk, frame!, i));
  const drawLimb = (i: number, far: boolean) => {
    const P = limbs[i]; g.strokeStyle = far ? (i % 2 ? '#8a5a2c' : '#2f5f93') : (i % 2 ? '#f6a54a' : '#63b3ff'); g.lineWidth = far ? 4 : 6; g.lineCap = 'round'; g.lineJoin = 'round';
    g.beginPath(); P.forEach((p, k) => k ? g.lineTo(X(p.z), Y(p.y)) : g.moveTo(X(p.z), Y(p.y))); g.stroke();
    g.fillStyle = '#fff'; for (const p of P.slice(1, 4)) { g.beginPath(); g.arc(X(p.z), Y(p.y), far ? 2 : 3, 0, 7); g.fill(); }
    if (frame!.contact[i]) { const e = P[P.length - 1]; g.fillStyle = '#7f7'; g.beginPath(); g.arc(X(e.z), Y(e.y) + 6, 4, 0, 7); g.fill(); }
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
  if (turnDeg !== null) top(W, H);
  // suspension label
  const airborne = frame.contact.every(c => !c), last = frame.plan.suspensions.find(w => { const p = ((frame!.stride - w.from) % 1 + 1) % 1; return p < w.to - w.from; });
  hud.textContent = [
    `t ${t.toFixed(2)} s  timescale ${ts}  plan ${planName}  row ${frame.plan.row}`,
    `speed ${Math.abs(inputs(t - 1e-6)[0]).toFixed(2)} m/s  ${frame.plan.hz.toFixed(2)} Hz  stride ${frame.plan.stride.toFixed(2)} m`,
    `duty hind ${frame.plan.duty.toFixed(3)} fore ${frame.plan.foreDuty.toFixed(3)} (data ${frame.plan.dutyData.toFixed(3)} / ${frame.plan.foreDutyData.toFixed(3)})  phase ${frame.stride.toFixed(2)}`,
    `pitch ${(frame.tilt.pitch * 180 / Math.PI).toFixed(1)}°  hip rise ${(ctl.reach.rise * 100).toFixed(1)} cm (derived)  chords fore ${ctl.reach.fore.chord.toFixed(3)} hind ${ctl.reach.hind.chord.toFixed(3)} m`,
    `contact ${frame.contact.map((c, i) => c ? LEG[i] : '··').join(' ')}  ${airborne ? (last?.kind ?? 'air').toUpperCase() + ' SUSPENSION' : ''}`,
    `spine flex ${frame.spineFlex.toFixed(2)} rad  pitch ${frame.tilt.pitch.toFixed(2)}  pose ${frame.pose}`,
    `max planted slip ${(maxSlip * 1000).toFixed(1)} mm  leash steps ${frame.leashes}`,
    `prints: fore ● blue, hind ● orange (top row left, bottom row right)`,
  ].join('\n');
}
/** top view (turning in place): body axis, feet from above (planted filled, stepping hollow), asked vs body heading */
function top(W: number, H: number) {
  const f = frame!, s2 = Math.min(W, H) * 1.1, cx = W * .8, cy = H * .3, P = (x: number, z: number) => [cx + (x - f.x) * s2, cy + (z - f.z) * s2] as const;
  g.fillStyle = '#23262d'; g.fillRect(cx - s2 * .3, cy - s2 * .3, s2 * .6, s2 * .6); g.strokeStyle = '#444'; g.strokeRect(cx - s2 * .3, cy - s2 * .3, s2 * .6, s2 * .6);
  const ends = [limbPoints(sk, f, 1)[0], limbPoints(sk, f, 0)[1]], a = P(ends[0].x, ends[0].z), b = P(ends[1].x, ends[1].z);
  g.strokeStyle = '#d9c7a0'; g.lineWidth = 10; g.lineCap = 'round'; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
  const want = headingAt(t), wv = P(f.x - Math.sin(want) * .25, f.z - Math.cos(want) * .25), o = P(f.x, f.z);
  g.strokeStyle = '#7f7'; g.lineWidth = 2; g.setLineDash([6, 4]); g.beginPath(); g.moveTo(o[0], o[1]); g.lineTo(wv[0], wv[1]); g.stroke(); g.setLineDash([]);
  for (let i = 0; i < 4; i++) { const p = P(f.feet[i].x, f.feet[i].z); g.strokeStyle = g.fillStyle = i % 2 ? '#f6a54a' : '#63b3ff'; g.lineWidth = 3; g.beginPath(); g.arc(p[0], p[1], 7, 0, 7); if (f.contact[i]) g.fill(); else g.stroke(); g.fillStyle = '#fff'; g.font = '12px monospace'; g.fillText(LEG[i], p[0] + 9, p[1] + 4); }
  g.fillStyle = '#ddd'; g.font = '13px monospace';
  g.fillText(`TOP VIEW  asked ${(want * 180 / Math.PI).toFixed(0)}°  body ${(f.heading * 180 / Math.PI).toFixed(1)}°  ${f.turning ? 'TURNING' : 'still'}  steps ${f.turnSteps}`, cx - s2 * .3 + 6, cy - s2 * .3 + 16);
}
const lab = { advance(seconds: number) { step(seconds); draw(); return { t, frame }; }, get t() { return t; }, get frame() { return frame; } };
(window as unknown as { __lab: typeof lab }).__lab = lab;
step(1e-3); draw();
if (q.get('shot') !== '1') { let last = performance.now(); const tick = (now: number) => { const dt = Math.min(.05, (now - last) / 1000) * ts; last = now; step(dt); draw(); requestAnimationFrame(tick); }; requestAnimationFrame(tick); }
