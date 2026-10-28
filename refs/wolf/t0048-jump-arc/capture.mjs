// T-0048 in-game capture & walkProbe verification on seed 1400, spawn 148, 64, 0.
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { acquire, release, track } from '../../../tools/bench-lock.mjs';
import { STAGES } from '../../../src/core/stages/elevation.ts';
import { heightAt } from '../../../src/core/world.ts';
import { apexHeight, airSeconds, jumpSeconds, JUMP, jumpFrame } from '../../../src/animals/locomotion/jump.ts';
import { gravity } from '../../../src/proc/physics.ts';
import { WOLF_LEGS } from '../../../src/core/animalBehavior.ts';

STAGES.on = true;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const dir = dirname(fileURLToPath(import.meta.url));
const base = process.env.BOREAL_URL ?? 'http://127.0.0.1:5250';
const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const port = 9350 + Math.floor(Math.random() * 40);
const profile = mkdtempSync(join(tmpdir(), 'agy-t0048-'));

const lockName = 'agy: t0048-jump-arc';
if (!(await acquire(lockName, { waitMs: 5 * 60 * 1000 }))) throw new Error('GPU busy');

const p = spawn(edge, [
  '--headless=new',
  '--disable-gpu-vsync',
  '--disable-frame-rate-limit',
  '--window-size=960,540',
  '--autoplay-policy=no-user-gesture-required',
  '--disable-renderer-backgrounding',
  '--disable-backgrounding-occluded-windows',
  '--disable-background-timer-throttling',
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${profile}`,
  'about:blank',
], { stdio: 'ignore' });
track(p.pid);

let id = 0;
const pending = new Map();
const errors = [];

function summarise(frames) {
  if (!frames.length) return { n: 0 };
  const a = frames[0], b = frames[frames.length - 1];
  const dt = (b.t - a.t) / 1000;
  const dist = Math.hypot(b.bx - a.bx, b.bz - a.bz);
  const gaits = {};
  let speed = 0, byMin = Infinity, byMax = -Infinity, liftMax = -Infinity, peakFrame = null;
  for (const f of frames) {
    gaits[f.gait ?? 'none'] = (gaits[f.gait ?? 'none'] ?? 0) + 1;
    speed += f.speed;
    if (f.by < byMin) byMin = f.by;
    if (f.by > byMax) byMax = f.by;
    const groundY = heightAt(f.bx, f.bz);
    const lift = f.by - groundY;
    f.ground = +groundY.toFixed(4);
    f.lift = +lift.toFixed(4);
    if (lift > liftMax) {
      liftMax = lift;
      peakFrame = f;
    }
  }
  return {
    n: frames.length,
    dt: +dt.toFixed(3),
    dist: +dist.toFixed(3),
    mps: dt ? +(dist / dt).toFixed(3) : null,
    gaitSpeed: +(speed / frames.length).toFixed(3),
    gaits,
    byMin: +byMin.toFixed(3),
    byMax: +byMax.toFixed(3),
    rise: +(byMax - byMin).toFixed(3),
    liftMax: +liftMax.toFixed(4),
    peakFrame,
  };
}

try {
  let target;
  for (let i = 0; i < 60; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
      target = list.find((x) => x.type === 'page');
      if (target) break;
    } catch {}
    await sleep(300);
  }
  if (!target) throw new Error('Edge page target not found');

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => { ws.onopen = r; });
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.id && pending.has(d.id)) {
      pending.get(d.id)(d.result ?? d);
      pending.delete(d.id);
    }
    if (d.method === 'Runtime.exceptionThrown') {
      errors.push((d.params.exceptionDetails.exception?.description ?? d.params.exceptionDetails.text).slice(0, 300));
    }
    if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') {
      errors.push(d.params.args.map((a) => a.value ?? a.description).join(' ').slice(0, 300));
    }
  };
  const cdp = (method, params = {}) => new Promise((r) => {
    const i = ++id;
    pending.set(i, r);
    ws.send(JSON.stringify({ id: i, method, params }));
  });
  const ev = async (expression) => (await cdp('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }))?.result?.value;
  const key = (type, k, code, vk, mod = 0) => cdp('Input.dispatchKeyEvent', { type, key: k, code, windowsVirtualKeyCode: vk, modifiers: mod });
  const shot = async (name) => {
    const s = await cdp('Page.captureScreenshot', { format: 'png' });
    const file = join(dir, `${name}.png`);
    writeFileSync(file, Buffer.from(s.data, 'base64'));
    console.log('saved', file);
  };

  await cdp('Runtime.enable');
  await cdp('Page.enable');
  await cdp('Page.bringToFront');
  await cdp('Emulation.setFocusEmulationEnabled', { enabled: true });

  const url = `${base}/?noprobe&nomenu&walkprobe&rec&hour=12&stages=1&at=148,64,0`;
  await cdp('Page.navigate', { url });
  for (let i = 0; i < 120; i++) {
    await sleep(500);
    const ready = await ev(`document.readyState === 'complete' && !document.getElementById('loading') && !!window.walkProbe && typeof window.borealHold === 'function'`);
    if (ready) break;
  }
  await ev(`window.borealHold(true)`);
  for (let i = 0; i < 120; i++) {
    await sleep(250);
    const dbg = await ev(`(async () => { const interest = await import('/src/core/interest.ts'); const d = typeof globalThis.borealDensity === 'function' ? globalThis.borealDensity() : null; return { queued: interest.queued(), chunks: d?.chunks ?? 0 }; })()`);
    if (dbg && dbg.queued === 0 && dbg.chunks >= 9) break;
  }
  await ev(`window.borealPlace(148, 64, 0)`);
  await sleep(300);
  await shot('stand-flat');
  await ev(`window.borealHold(false)`);
  await sleep(200);

  async function sampleMode(name, steps, ms) {
    for (const s of steps) {
      await key('keyDown', s.key, s.code, s.vk, s.mod ?? 0);
      if (s.waitMs) await sleep(s.waitMs);
    }
    await sleep(1200);
    await ev(`window.walkProbe.clear()`);
    await sleep(ms);
    const frames = await ev(`window.walkProbe.frames.map(f => ({ t: +f.t.toFixed(1), bx: +f.bx.toFixed(4), by: +f.by.toFixed(4), bz: +f.bz.toFixed(4), gait: f.gait, speed: +f.speed.toFixed(3) }))`);
    const stepCount = await ev(`window.walkProbe.steps.length`);
    for (const s of [...steps].reverse()) {
      await key('keyUp', s.key, s.code, s.vk, 0);
    }
    const row = { name, keys: steps.map((s) => s.key), steps: stepCount, ...summarise(frames), frames };
    console.log(name, JSON.stringify({ ...row, frames: undefined, peakFrame: undefined }));
    return row;
  }

  const modes = [];
  modes.push(await sampleMode('walk', [{ key: 'w', code: 'KeyW', vk: 87 }], 2000));
  await shot('move-walk');
  await sleep(400);

  modes.push(await sampleMode('run', [
    { key: 'Shift', code: 'ShiftLeft', vk: 16, mod: 8 },
    { key: 'W', code: 'KeyW', vk: 87, mod: 8 },
  ], 2000));
  await shot('move-run');
  await sleep(400);

  modes.push(await sampleMode('sprint', [
    { key: 'Shift', code: 'ShiftLeft', vk: 16, mod: 8, waitMs: 120 },
    { key: 'C', code: 'KeyC', vk: 67, mod: 8, waitMs: 60 },
    { key: 'W', code: 'KeyW', vk: 87, mod: 8 },
  ], 1200));
  await sleep(600);

  // Place back at exact spawn (148, 64, 0) for the calibrated jump test
  await ev(`window.borealPlace(148, 64, 0)`);
  await sleep(400);
  await ev(`window.walkProbe.clear()`);
  await key('keyDown', ' ', 'Space', 32);
  await sleep(420);
  await shot('jump-air');
  await key('keyUp', ' ', 'Space', 32);
  await sleep(600);
  await shot('jump-land');

  const jumpFrames = await ev(`window.walkProbe.frames.map(f => ({ t: +f.t.toFixed(1), bx: +f.bx.toFixed(4), by: +f.by.toFixed(4), bz: +f.bz.toFixed(4), speed: +f.speed.toFixed(3) }))`);
  const jump = summarise(jumpFrames);
  const apex = apexHeight();
  const score = +(jump.liftMax / apex).toFixed(4);
  const midFlightMatch = +(jumpFrame({ t: (JUMP.crouch + JUMP.flight / 2) * jumpSeconds(), kind: 'jump' }, WOLF_LEGS.hip).heightOff / apex).toFixed(4);
  const mismatchPreFix = +(0.479 / apex).toFixed(4);

  const out = {
    seed: STAGES.seed,
    spawn: { x: 148, z: 64, yaw: 0 },
    physics: {
      g: +gravity().toFixed(5),
      jumpSeconds: jumpSeconds(),
      airSeconds: +airSeconds().toFixed(4),
      crouchShare: JUMP.crouch,
      flightShare: JUMP.flight,
      landShare: JUMP.land,
      apexHeightM: +apex.toFixed(4),
    },
    calibration: {
      metric: 'peak(tilt world y - heightAt(bx, bz)) / apexHeight()',
      knownMatchMidFlight: midFlightMatch,
      knownMismatchPreFix048: mismatchPreFix,
      measuredPeakLiftM: jump.liftMax,
      measuredScore: score,
      pass: score >= 0.95 && score <= 1.05,
    },
    modes,
    jump,
    jumpFrames,
    errors,
  };
  writeFileSync(join(dir, 'motion.json'), JSON.stringify(out, null, 2));
  console.log('CALIBRATION:', JSON.stringify(out.calibration, null, 2));
  ws.close();
} finally {
  release(lockName);
  await sleep(500);
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
}
