/**
 * Live browser screen recording + frame sampler + runtime telemetry for T-0238:
 * Predator-prey hunting, clover/forage resource coupling, trace persistence, and autonomous/deer agent pipeline.
 *
 * Captures 4 diagnostic live gameplay scenes in NW Ontario boreal forest into recording.webm + frame-0..3.png + observations.json:
 * - Frame 0: Wolf locking ('q') and standstill impulse-pouncing (' ', 0 -> 8.0 m/s in 1/30 s = 240 m/s^2, mid-air steerLeap)
 *   onto a ring-spawned snowshoe hare over cloverless ground (createCloverField unmounted, SimWorld.food = [], 0 droppings).
 * - Frame 1: Wolf running & turning ('w'+'d'+'Shift', 6 m/s) while HOLDING a hare after engageHold synchronously skipped
 *   'pinned' -> 'held' in 0.00 s ("Pinned. X eats, B releases." & "HOLDING" simultaneous), with 66-deg pitched hare on upper
 *   canine, both wolf forelegs stuck forward at +0.9 rad in mid-run, 5 hungry pups receiving 0 food, instant 0.00 s 'x' swallow,
 *   and broken reload bond ('b').
 * - Frame 2: Autonomous wolf ('Autonomous: On') approaching a hare to ~1.2 m (agent.ts scan hold > catchContact 0.9 m,
 *   never stalking/pouncing, 0 captures) and gaining +1.0 %/s (+150.34 kJ/s) free idle energy during 'recover'.
 * - Frame 3: Visible 3D White-tailed Deer at ~41.5 m (> withinEarshot 40 m, < deer sight 80 m / hearing 60 m / scent 150 m)
 *   frozen completely motionless (0 brain/joint updates) and excluded from wolf huntLock ('aiming' never locks cervids).
 *
 * Uses agy preview port 5262 and tools/bench-lock.mjs, terminating Vite and headless Edge cleanly in finally.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { acquire, track, release } from '../../../tools/bench-lock.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
mkdirSync(__dirname, { recursive: true });

const PORT = 5262;
const BASE_URL = process.env.BOREAL_URL || `http://127.0.0.1:${PORT}`;
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const CDP_PORT = 9376;
const WORK_ROOT = resolve(__dirname, '../../../work');
const PROFILE = resolve(WORK_ROOT, 'edge-hunt-predator-prey-audit-profile');
const LOCK_NAME = 'agy: T-0238-predator-prey-agent-audit';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const KEY_SPEC = {
  w: { key: 'w', code: 'KeyW' },
  a: { key: 'a', code: 'KeyA' },
  s: { key: 's', code: 'KeyS' },
  d: { key: 'd', code: 'KeyD' },
  q: { key: 'q', code: 'KeyQ' },
  x: { key: 'x', code: 'KeyX' },
  b: { key: 'b', code: 'KeyB' },
  c: { key: 'c', code: 'KeyC' },
  shift: { key: 'Shift', code: 'ShiftLeft' },
  space: { key: ' ', code: 'Space' },
};

async function main() {
  if (!(await acquire(LOCK_NAME))) throw new Error('Timed out waiting for bench-lock');
  let viteProc = null;
  let edge = null;
  try {
    if (!process.env.BOREAL_URL) {
      const viteBoot = `
        import { createServer } from 'vite';
        const srv = await createServer({
          server: { host: '127.0.0.1', port: ${PORT}, strictPort: true, watch: null },
          logLevel: 'error',
        });
        await srv.listen();
        await srv.transformRequest('/src/main.ts');
        await srv.transformRequest('/src/animals/hare.ts');
        await srv.transformRequest('/src/core/huntHold.ts');
        await srv.transformRequest('/src/core/autonomy.ts');
      `;
      viteProc = spawn(process.execPath, ['--input-type=module', '-e', viteBoot], {
        stdio: 'ignore',
        cwd: resolve(__dirname, '../../..'),
      });
      if (viteProc.pid) track(viteProc.pid);
      let up = false;
      for (let i = 0; i < 60; i++) {
        try {
          const r = await fetch(`${BASE_URL}/src/animals/hare.ts`);
          if (r.ok) { up = true; break; }
        } catch {}
        await sleep(500);
      }
      if (!up) throw new Error(`Vite server did not start on ${BASE_URL}`);
    }

    rmSync(PROFILE, { recursive: true, force: true });
    mkdirSync(PROFILE, { recursive: true });

    edge = spawn(EDGE, [
      '--headless=new',
      '--disable-extensions',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-renderer-backgrounding',
      '--disable-backgrounding-occluded-windows',
      '--disable-background-timer-throttling',
      `--remote-debugging-port=${CDP_PORT}`,
      `--user-data-dir=${PROFILE}`,
      '--window-size=1280,720',
      '--mute-audio',
      'about:blank',
    ], { stdio: 'ignore' });
    if (edge.pid) track(edge.pid);

    let wsUrl = null;
    for (let i = 0; i < 40; i++) {
      await sleep(250);
      try {
        const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`);
        const pages = await res.json();
        const page = pages.find((p) => p.type === 'page' && p.webSocketDebuggerUrl);
        if (page) { wsUrl = page.webSocketDebuggerUrl; break; }
      } catch {}
    }
    if (!wsUrl) throw new Error('Failed to connect to headless Edge CDP');

    const ws = new WebSocket(wsUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

    let seq = 1;
    const pending = new Map();
    const pageErrors = [];
    ws.onmessage = (ev) => {
      const msg = JSON.parse(String(ev.data));
      if (msg.id && pending.has(msg.id)) {
        const { resolve: r, reject: j } = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.error) j(new Error(msg.error.message));
        else r(msg.result);
      }
      if (msg.method === 'Runtime.exceptionThrown') {
        pageErrors.push(msg.params?.exceptionDetails?.text || 'exception');
      }
    };
    const send = (method, params = {}) => new Promise((r, j) => {
      const id = seq++;
      pending.set(id, { resolve: r, reject: j });
      ws.send(JSON.stringify({ id, method, params }));
    });
    const evalJs = async (expression) => {
      const res = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
      if (res?.exceptionDetails) {
        throw new Error(`Eval error: ${res.exceptionDetails.text} ${res.exceptionDetails.exception?.description || ''}`);
      }
      return res?.result?.value;
    };
    const heldKeys = new Set();
    const setKey = async (name, down) => {
      if (down === heldKeys.has(name)) return;
      if (down) heldKeys.add(name); else heldKeys.delete(name);
      const spec = KEY_SPEC[name];
      await evalJs(`window.dispatchEvent(new KeyboardEvent(${JSON.stringify(down ? 'keydown' : 'keyup')}, {
        key: ${JSON.stringify(spec.key)},
        code: ${JSON.stringify(spec.code)},
        bubbles: true,
        cancelable: true
      }))`);
    };
    const releaseAllKeys = async () => {
      for (const k of [...heldKeys]) await setKey(k, false);
    };
    const snapPng = async (outFile) => {
      try {
        const res = await Promise.race([
          send('Page.captureScreenshot', { format: 'png', optimizeForSpeed: true }),
          sleep(6000).then(() => { throw new Error('captureScreenshot timeout'); }),
        ]);
        writeFileSync(resolve(__dirname, outFile), Buffer.from(res.data, 'base64'));
      } catch {
        const dataUrl = await evalJs(`window.__compCanvas.toDataURL('image/png')`);
        writeFileSync(resolve(__dirname, outFile), Buffer.from(dataUrl.split(',')[1], 'base64'));
      }
    };

    await send('Page.enable');
    await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });

    const bootUrl = `${BASE_URL}/?nomenu&noprobe&view=ground&stages=1&date=2026-07-15&hour=13&needs=water:75,energy:55&contacts=1&rec`;
    await send('Page.navigate', { url: bootUrl });

    let booted = false;
    for (let i = 0; i < 100; i++) {
      await sleep(500);
      booted = await evalJs(`Boolean(
        document.readyState === 'complete' &&
        !document.getElementById('loading') &&
        window.__boreal &&
        window.borealPlace &&
        /Stamina\\s+\\d+/.test(document.getElementById('status')?.innerText || '')
      )`);
      if (booted) break;
    }
    if (!booted) throw new Error(`Game failed to boot: ${JSON.stringify(pageErrors)}`);

    const waitWorldJobs = async (msMin = 3000) => {
      await sleep(msMin);
      await evalJs(`(async () => {
        const findMod = (sub) => performance.getEntriesByType('resource').map((r) => r.name).find((n) => n.includes(sub)) || sub;
        const intMod = await import(findMod('/src/core/interest.ts'));
      const qualMod = await import(findMod('/src/core/quality.ts'));
      qualMod.GOVERNOR.auto = false;
      qualMod.GOVERNOR.tier = 2;
        for (let i = 0; i < 40; i++) {
          if ((intMod.STATS?.queued ?? 0) === 0) break;
          await new Promise((r) => setTimeout(r, 150));
        }
        await new Promise((r) => setTimeout(r, 400));
      })()`);
    };
    await waitWorldJobs(3600);

    // Ensure wolf energy > 40 so pounce (' ') is enabled (livingHere() sometimes spawns a wolf at energy=9)
    const initEnergy = await evalJs(`window.__boreal.player().energy`);
    if (initEnergy < 35) {
      for (let attempt = 0; attempt < 5; attempt++) {
        await evalJs(`(() => {
          const hs = window.__boreal.hares();
          if (!hs.length) return;
          const h = hs[0];
          const p = window.__boreal.player();
          const yaw = Math.atan2(-(h.x - p.x), -(h.z - p.z));
          window.borealPlace(h.x + Math.sin(yaw) * 0.42, h.z + Math.cos(yaw) * 0.42, yaw, -0.10);
        })()`);
        await setKey('w', true);
        await sleep(160);
        await setKey('w', false);
        if (await evalJs(`/HOLDING/.test(document.getElementById('status')?.innerText || '')`)) {
          await setKey('x', true);
          await sleep(80);
          await setKey('x', false);
          await sleep(120);
          break;
        }
      }
    }

    // Start continuous composite 20 fps WebM screen recorder
    await evalJs(`(() => {
      const comp = document.createElement('canvas');
      comp.width = 1280; comp.height = 720;
      window.__compCanvas = comp;
      const ctx = comp.getContext('2d');
      const glCanvas = document.getElementById('world');
      window.__auditStage = 'Booting predator-prey & agent audit...';
      window.__stopComp = false;
      const drawComp = () => {
        if (!window.__stopComp) {
          ctx.drawImage(glCanvas, 0, 0, 1280, 720);
          ctx.fillStyle = 'rgba(10, 16, 20, 0.86)';
          ctx.fillRect(12, 12, 990, 74);
          ctx.fillStyle = '#eaf2ee';
          ctx.font = '13px monospace';
          const statusLines = (document.getElementById('status')?.innerText || '').split('\\n');
          const noticeTxt = document.getElementById('notice')?.style?.display !== 'none'
            ? (document.getElementById('notice')?.innerText || '')
            : '';
          ctx.fillText(window.__auditStage, 22, 32);
          ctx.fillText(statusLines[0] || '', 22, 52);
          ctx.fillText((statusLines[1] || '') + (noticeTxt ? ' | NOTICE: ' + noticeTxt : ''), 22, 72);
          requestAnimationFrame(drawComp);
        }
      };
      requestAnimationFrame(drawComp);
      const stream = comp.captureStream(20);
      const chunks = [];
      const rec = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8' });
      rec.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunks.push(e.data); };
      window.__recChunks = chunks;
      window.__rec = rec;
      rec.start(100);
      return true;
    })()`);

    const observations = {
      capturedAt: new Date().toISOString(),
      url: bootUrl,
      pageErrors,
      scenes: {},
    };

    // =========================================================================
    // SCENE 0 (frame-0.png): Lock ('q') + Standstill Impulse Pounce (' ') onto Ring-Spawned Hare (0 Clover)
    // =========================================================================
    await evalJs(`window.__auditStage = 'Frame 0: Standstill 8 m/s pounce (240 m/s^2) + mid-air steerLeap onto ring-spawned hare (0 clover)';`);
    const hareTarget0 = await evalJs(`(() => {
      const p = window.__boreal.player();
      const hs = window.__boreal.hares();
      const sorted = [...hs].sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z));
      const h = sorted[0];
      const distFromPlayer = hs.map((x) => Number(Math.hypot(x.x - p.x, x.z - p.z).toFixed(2)));
      const yaw = Math.atan2(-(h.x - p.x), -(h.z - p.z));
      const wx = h.x + Math.sin(yaw) * 4.8;
      const wz = h.z + Math.cos(yaw) * 4.8;
      window.borealPlace(wx, wz, yaw, -0.09);
      return { targetId: h.id, hx: h.x, hz: h.z, wx, wz, yaw, count: hs.length, spawnRingDistancesM: distFromPlayer };
    })()`);

    await setKey('q', true);
    await sleep(550);
    const prePounce = await evalJs(`(async () => {
      const findMod = (sub) => performance.getEntriesByType('resource').map((r) => r.name).find((n) => n.includes(sub)) || sub;
      const fieldsMod = await import(findMod('/src/core/fields.ts'));
      const deltasMod = await import(findMod('/src/core/deltas.ts'));
      const p = window.__boreal.player();
      const statusText = document.getElementById('status')?.innerText || '';
      return {
        player: p,
        statusText,
        lockedInHud: statusText.includes('Lock on'),
        cloverStateSize: fieldsMod.CLOVER_STATE.size,
        droppingsDeltas: deltasMod.DELTAS.log.filter((d) => d.kind === 'droppings').length,
      };
    })()`);

    // Standstill jump/pounce (' ') while keeping 'q' held!
    const tPounce0 = Date.now();
    await setKey('space', true);
    await sleep(340);
    await snapPng('frame-0.png');
    const midPounce = await evalJs(`(() => {
      const p = window.__boreal.player();
      const statusText = document.getElementById('status')?.innerText || '';
      return { player: p, statusText };
    })()`);
    const dtPounceS = (Date.now() - tPounce0) / 1000;
    const measuredLeapDistM = Math.hypot(midPounce.player.x - prePounce.player.x, midPounce.player.z - prePounce.player.z);
    await setKey('space', false);
    await sleep(600);
    await setKey('q', false);

    observations.scenes.frame0_standstillPounceAndCloverGap = {
      hareSetup: hareTarget0,
      prePounce,
      midPounce,
      dtPounceS: Number(dtPounceS.toFixed(3)),
      measuredLeapDistM: Number(measuredLeapDistM.toFixed(3)),
    };

    // =========================================================================
    // SCENE 1 (frame-1.png): Catch/Hold Hare -> Running & Turning ('w'+'d'+'Shift') with +0.9 rad Forelegs + Eat ('x') + Bond ('b')
    // =========================================================================
    await evalJs(`window.__auditStage = 'Frame 1: engageHold skips pinned->held in 0s; wolf runs at 6 m/s with +0.9 rad stuck forelegs';`);
    let caughtHoldInfo = null;
    for (let attempt = 0; attempt < 8; attempt++) {
      await evalJs(`(() => {
        const hs = window.__boreal.hares();
        if (!hs.length) return;
        const h = hs[0];
        const p = window.__boreal.player();
        const yaw = Math.atan2(-(h.x - p.x), -(h.z - p.z));
        window.borealPlace(h.x + Math.sin(yaw) * 0.42, h.z + Math.cos(yaw) * 0.42, yaw, -0.10);
      })()`);
      await setKey('space', true);
      await sleep(160);
      await setKey('space', false);
      const checkHold = await evalJs(`(() => {
        const statusText = document.getElementById('status')?.innerText || '';
        const noticeText = document.getElementById('notice')?.innerText || '';
        return { holding: /HOLDING/.test(statusText), statusText, noticeText };
      })()`);
      if (checkHold.holding) {
        caughtHoldInfo = checkHold;
        break;
      }
    }

    // Run ('w'+'shift') and turn right ('d') so the follow camera stays centered on the wolf while angling her body to reveal
    // the hare held in her jaws and her +0.9 rad raised forelegs!
    await setKey('w', true);
    await setKey('shift', true);
    await setKey('d', true);
    await sleep(650);
    await snapPng('frame-1.png');

    const runningWhileHolding = await evalJs(`(() => {
      const p = window.__boreal.player();
      const statusText = document.getElementById('status')?.innerText || '';
      const noticeText = document.getElementById('notice')?.innerText || '';
      return { player: p, statusText, noticeText };
    })()`);
    await releaseAllKeys();
    await sleep(250);

    // Press 'b' (releasePrey) on this first held hare so Energy stays ~50/100 (< 85) for Scene 2 Autonomous hunt,
    // AND measure missing commitContext() + reload clock=0 bond bug!
    const savedBeforeRelease = await evalJs(`localStorage.getItem('boreal.events.v1')`);
    await setKey('b', true);
    await sleep(90);
    await setKey('b', false);
    await sleep(120);
    const bondTelemetry = await evalJs(`(async () => {
      const findMod = (sub) => performance.getEntriesByType('resource').map((r) => r.name).find((n) => n.includes(sub)) || sub;
      const eventsMod = await import(findMod('/src/core/events.ts'));
      const huntHoldMod = await import(findMod('/src/core/huntHold.ts'));
      const savedImmediatelyAfterRelease = localStorage.getItem('boreal.events.v1');
      const statusText = document.getElementById('status')?.innerText || '';
      const noticeText = document.getElementById('notice')?.innerText || '';
      const simBondCtx = eventsMod.rememberBond(eventsMod.createContext(), 'hare:1', { at: 25.0, tau: 180, species: 'hare' });
      const b0 = simBondCtx.bonds['hare:1'];
      const bondStrengthAtReloadClock0 = huntHoldMod.friendStrength(b0.at, 0, b0.tau);
      const friendCountAtReloadClock0 = eventsMod.friendCount(simBondCtx, 0);
      return {
        savedBeforeReleaseWasNull: ${savedBeforeRelease === null},
        savedImmediatelyAfterReleaseCommitted: savedImmediatelyAfterRelease !== ${JSON.stringify(savedBeforeRelease)},
        hudShows1Friend: /1 friends/.test(statusText),
        statusText,
        noticeText,
        bondStrengthAtReloadClock0: Number(bondStrengthAtReloadClock0.toFixed(4)),
        friendCountAtReloadClock0,
      };
    })()`);

    // =========================================================================
    // SCENE 2 (frame-2.png): Autonomous Wolf (Energy ~50/100) Stalling at ~1.2 m on Unbonded Hare + Delta Eviction
    // =========================================================================
    await evalJs(`window.__auditStage = 'Frame 2: Autonomous wolf stalls at 1.2 m (> 0.9 m catch) without pouncing; +1%/s free idle energy';`);
    const autoSetup = await evalJs(`(() => {
      const hs = window.__boreal.hares();
      // Pick the furthest hare (not the just-released bonded one)
      const p = window.__boreal.player();
      const sorted = [...hs].sort((a, b) => Math.hypot(b.x - p.x, b.z - p.z) - Math.hypot(a.x - p.x, a.z - p.z));
      const h = sorted[0] || hs[0];
      const yaw = Math.atan2(-(h.x - p.x), -(h.z - p.z));
      const wx = h.x + Math.sin(yaw) * 4.2;
      const wz = h.z + Math.cos(yaw) * 4.2;
      window.borealPlace(wx, wz, yaw, -0.10);
      const btn = document.getElementById('autonomous');
      if (btn && btn.getAttribute('aria-pressed') !== 'true') btn.click();
      return { targetId: h?.id, hx: h?.x, hz: h?.z, wx, wz };
    })()`);

    const autoTrace = [];
    for (let i = 0; i < 16; i++) {
      await sleep(160);
      const sample = await evalJs(`(() => {
        const p = window.__boreal.player();
        const hs = window.__boreal.hares();
        const nearest = hs.map((h) => ({ id: h.id, d: Number(Math.hypot(h.x - p.x, h.z - p.z).toFixed(3)), state: h.state }))
          .sort((a, b) => a.d - b.d)[0] || null;
        return {
          tMs: ${i * 160},
          energy: Number(p.energy.toFixed(3)),
          mode: p.mode,
          nearestHare: nearest,
          statusLine: (document.getElementById('status')?.innerText || '').split('\\n')[0],
        };
      })()`);
      autoTrace.push(sample);
      if (i === 8) await snapPng('frame-2.png');
    }

    const deltaEvictionProbe = await evalJs(`(async () => {
      const btn = document.getElementById('autonomous');
      if (btn && btn.getAttribute('aria-pressed') === 'true') btn.click();
      const findMod = (sub) => performance.getEntriesByType('resource').map((r) => r.name).find((n) => n.includes(sub)) || sub;
      const deltasMod = await import(findMod('/src/core/deltas.ts'));
      const fieldsMod = await import(findMod('/src/core/fields.ts'));
      const groundMod = await import(findMod('/src/core/ground.ts'));
      const savedCopy = [...deltasMod.DELTAS.log];
      const initialScentMarks = savedCopy.filter((d) => d.kind === 'scent').length;

      const patchKey = 'forage:audit-test-stripped';
      const maxG = fieldsMod.berryMaxG(1);
      const eaten = fieldsMod.takePatch({ key: patchKey, x: 1234.5, z: 1234.5, kind: 'forage', grams: maxG + 10, by: 'wolf:player' });
      const grazedRowBefore = deltasMod.findGrazed(patchKey);
      const gramsImmediatelyAfterStrip = fieldsMod.settledGrams({ key: patchKey, x: 1234.5, z: 1234.5, kind: 'forage', grams: 0, by: '' }).grams;

      for (let i = 0; i < 1505; i++) {
        deltasMod.record({ kind: 'footprint', x: 5000 + i * 2.5, z: 5000, t: groundMod.GROUND.years, m: 1 }, 0.3);
      }
      const grazedRowAfterFootprints = deltasMod.findGrazed(patchKey) || null;
      const gramsAfterFootprintEviction = fieldsMod.settledGrams({ key: patchKey, x: 1234.5, z: 1234.5, kind: 'forage', grams: 0, by: '' }).grams;

      deltasMod.DELTAS.log.length = 0;
      deltasMod.DELTAS.log.push(...savedCopy);

      return {
        initialScentMarks,
        maxG: Number(maxG.toFixed(3)),
        eaten: Number(eaten.toFixed(3)),
        grazedStoredM: grazedRowBefore?.m ?? null,
        gramsImmediatelyAfterStrip: Number(gramsImmediatelyAfterStrip.toFixed(4)),
        evictedByFootprints: grazedRowAfterFootprints === null,
        gramsAfterFootprintEviction: Number(gramsAfterFootprintEviction.toFixed(3)),
      };
    })()`);

    // Now catch one more hare and press 'x' (eatPrey) to record 0.00 s instant swallow telemetry!
    for (let attempt = 0; attempt < 6; attempt++) {
      await evalJs(`(() => {
        const hs = window.__boreal.hares();
        if (!hs.length) return;
        const h = hs[hs.length - 1];
        const p = window.__boreal.player();
        const yaw = Math.atan2(-(h.x - p.x), -(h.z - p.z));
        window.borealPlace(h.x + Math.sin(yaw) * 0.42, h.z + Math.cos(yaw) * 0.42, yaw, -0.10);
      })()`);
      await setKey('space', true);
      await sleep(160);
      await setKey('space', false);
      if (await evalJs(`/HOLDING/.test(document.getElementById('status')?.innerText || '')`)) break;
    }
    const beforeEat = await evalJs(`window.__boreal.player()`);
    await setKey('x', true);
    await sleep(90);
    await setKey('x', false);
    await sleep(100);
    const afterEat = await evalJs(`(async () => {
      const findMod = (sub) => performance.getEntriesByType('resource').map((r) => r.name).find((n) => n.includes(sub)) || sub;
      const deltasMod = await import(findMod('/src/core/deltas.ts'));
      const p = window.__boreal.player();
      const carcassDeltas = deltasMod.DELTAS.log.filter((d) => d.kind === 'carcass');
      return {
        player: p,
        energyGainInstant: Number((p.energy - ${beforeEat.energy}).toFixed(3)),
        waterGainInstant: Number((p.water - ${beforeEat.water}).toFixed(3)),
        noticeText: document.getElementById('notice')?.innerText || '',
        statusText: document.getElementById('status')?.innerText || '',
        carcassDeltas,
      };
    })()`);

    observations.scenes.frame1_holdCarryEatAndBond = {
      caughtHoldInfo,
      runningWhileHolding,
      beforeEat,
      afterEat,
      bondTelemetry,
    };
    observations.scenes.frame2_autonomousStallAndDeltaEviction = {
      autoSetup,
      autoTrace,
      anyHareCaughtByAutonomous: autoTrace.some((s) => /HOLDING/.test(s.statusLine)),
      deltaEvictionProbe,
    };

    // =========================================================================
    // SCENE 3 (frame-3.png): Visible 3D White-Tailed Deer at ~41.5 m Frozen by withinEarshot (40 m) & Un-lockable
    // =========================================================================
    await evalJs(`window.__auditStage = 'Frame 3: Visible 3D White-tailed Deer at ~41.5 m frozen solid (> 40 m withinEarshot) & un-lockable';`);
    const deerScene = await evalJs(`(async () => {
      const findMod = (sub) => performance.getEntriesByType('resource').map((r) => r.name).find((n) => n.includes(sub)) || sub;
      const popMod = await import(findMod('/src/core/population.ts'));
      const worldMod = await import(findMod('/src/core/world.ts'));
      const p = window.__boreal.player();
      const foundDeer = [];
      const cx0 = Math.round(p.x / worldMod.CHUNK_SIZE);
      const cz0 = Math.round(p.z / worldMod.CHUNK_SIZE);
      for (let dz = -5; dz <= 5; dz++) {
        for (let dx = -5; dx <= 5; dx++) {
          const ents = worldMod.generateChunk(cx0 + dx, cz0 + dz);
          const allEnts = popMod.applyPopulation(ents, cx0 + dx, cz0 + dz);
          const spruces = allEnts.filter((e) => e.kind === 'spruce');
          for (const e of allEnts) {
            if (e.kind === 'deer') {
              foundDeer.push({ key: e.key, x: e.x, z: e.z, h: worldMod.heightAt(e.x, e.z), localTrees: spruces.length, trees: spruces });
            }
          }
        }
      }
      foundDeer.sort((a, b) => a.localTrees - b.localTrees);
      let best = null;
      let bestPose = null;
      for (const d of foundDeer.slice(0, 25)) {
        for (let ang = 0; ang < Math.PI * 2; ang += Math.PI / 12) {
          const dist = 41.5;
          const wx = d.x + Math.sin(ang) * dist;
          const wz = d.z + Math.cos(ang) * dist;
          const wh = worldMod.heightAt(wx, wz);
          if (!worldMod.isDryLand(wx, wz, wh) || wh < 1.0) continue;
          // Ensure unobstructed terrain & tree line-of-sight between wolf eye (wh + 1.4) and deer chest (d.h + 1.0)
          let blocked = false;
          for (let s = 3; s < dist - 2; s += 3) {
            const u = s / dist;
            const sx = wx + (d.x - wx) * u;
            const sz = wz + (d.z - wz) * u;
            const losY = (wh + 1.4) * (1 - u) + (d.h + 1.0) * u;
            if (worldMod.heightAt(sx, sz) > losY - 0.15) { blocked = true; break; }
            if (d.trees.some((t) => Math.hypot(t.x - sx, t.z - sz) < 2.2)) { blocked = true; break; }
          }
          if (blocked) continue;
          const yaw = Math.atan2(-(d.x - wx), -(d.z - wz));
          best = { key: d.key, x: d.x, z: d.z, h: d.h, localTrees: d.localTrees };
          bestPose = { wx, wz, wh, yaw, dist };
          break;
        }
        if (bestPose) break;
      }
      if (!best && foundDeer[0]) {
        const d = foundDeer[0];
        const dist = 41.5;
        best = { key: d.key, x: d.x, z: d.z, h: d.h, localTrees: d.localTrees };
        bestPose = { wx: d.x, wz: d.z + dist, wh: worldMod.heightAt(d.x, d.z + dist), yaw: 0, dist };
      }
      if (best && bestPose) {
        window.borealPlace(bestPose.wx, bestPose.wz, bestPose.yaw, -0.03);
      }
      return { totalNearbyDeer: foundDeer.length, chosenDeer: best, cameraPose: bestPose };
    })()`);

    await waitWorldJobs(3200);
    await setKey('q', true);
    const deerSamples = [];
    for (let i = 0; i < 10; i++) {
      await sleep(150);
      const s = await evalJs(`(() => {
        const statusText = document.getElementById('status')?.innerText || '';
        return {
          step: ${i},
          statusText,
          aimingButNotLocked: statusText.includes('aiming') && !statusText.includes('Lock on'),
        };
      })()`);
      deerSamples.push(s);
      if (i === 6) await snapPng('frame-3.png');
    }
    await releaseAllKeys();

    const deerModuleProbe = await evalJs(`(async () => {
      const findMod = (sub) => performance.getEntriesByType('resource').map((r) => r.name).find((n) => n.includes(sub)) || sub;
      const abMod = await import(findMod('/src/core/animalBehavior.ts'));
      const spMod = await import(findMod('/src/core/species.ts'));
      const rSetMod = await import(findMod('/src/core/renderSettings.ts'));
      const wcMod = await import(findMod('/src/core/worldClock.ts'));
      const coarseMod = await import(findMod('/src/core/coarse.ts'));
      const intMod = await import(findMod('/src/core/interest.ts'));
      const d = 41.5;
      const earshotActive = abMod.withinEarshot({ x: 0, y: 0, z: 0 }, { x: d, y: 0, z: 0 });
      const lodMark = coarseMod.markFor(d, wcMod.observation());
      return {
        testDistanceM: d,
        playerHearingRadiusM: abMod.PLAYER_HEARING_RADIUS,
        interestNearM: intMod.INTEREST.near,
        interestMidM: intMod.INTEREST.mid,
        withinEarshotAt41_5m: earshotActive,
        renderAnimalDistanceM: rSetMod.RENDER.animalDistance,
        lodBodyShareAt41_5m: lodMark.body,
        deerSightRangeM: spMod.DEER_AGENT.senses.sight.range,
        deerHearingRangeM: spMod.DEER_AGENT.senses.hearing.range,
        deerScentRangeM: spMod.DEER_AGENT.senses.scent.range,
      };
    })()`);

    observations.scenes.frame3_frozenDeerAndCervidHuntExclusion = {
      deerScene,
      deerSamples,
      deerModuleProbe,
    };

    const webmBase64 = await evalJs(`new Promise((resolve) => {
      window.__stopComp = true;
      const rec = window.__rec;
      rec.onstop = async () => {
        const blob = new Blob(window.__recChunks, { type: 'video/webm' });
        const buf = await blob.arrayBuffer();
        const bytes = new Uint8Array(buf);
        let bin = '';
        const chunk = 0x8000;
        for (let i = 0; i < bytes.length; i += chunk) {
          bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
        }
        resolve(btoa(bin));
      };
      rec.stop();
    })`);
    const webmBuf = Buffer.from(webmBase64, 'base64');
    writeFileSync(resolve(__dirname, 'recording.webm'), webmBuf);
    observations.recordingBytes = webmBuf.length;

    writeFileSync(resolve(__dirname, 'observations.json'), JSON.stringify(observations, null, 2) + '\n');
    console.log(`Captured recording.webm (${webmBuf.length} bytes), frame-0..3.png, and observations.json.`);
    ws.close();
  } finally {
    try { if (edge) edge.kill(); } catch {}
    try { if (viteProc) viteProc.kill(); } catch {}
    await sleep(500);
    release();
    try { rmSync(PROFILE, { recursive: true, force: true }); } catch {}
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
