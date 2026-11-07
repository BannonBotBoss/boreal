// Run from repository root: node refs/senses/sight-audit/capture.mjs
// Never writes outside C:\dev (uses C:\dev\boreal-agy-loop\work\edge-profile-senses).
import { spawn, execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const out = resolve('refs/senses/sight-audit');
mkdirSync(out, { recursive: true });
const profileDir = resolve('work/edge-profile-senses');
mkdirSync(profileDir, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));

let edgeProc;
let ws;
try {
  edgeProc = spawn(
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    [
      '--headless=new',
      '--disable-extensions',
      '--no-first-run',
      '--disable-gpu-vsync',
      '--disable-frame-rate-limit',
      '--remote-debugging-port=9478',
      `--user-data-dir=${profileDir}`,
      'about:blank',
    ],
    { stdio: 'ignore' }
  );

  let tabs;
  for (let i = 0; i < 40; i++) {
    try {
      tabs = await (await fetch('http://127.0.0.1:9478/json')).json();
      break;
    } catch {
      await sleep(500);
    }
  }
  if (!tabs) throw new Error('Edge remote debugging did not start on 9478');
  ws = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl);
  await new Promise(r => (ws.onopen = r));

  let id = 0;
  const pending = new Map();
  const errors = [];
  ws.onmessage = e => {
    const d = JSON.parse(e.data);
    if (d.id) {
      pending.get(d.id)?.(d.result);
      pending.delete(d.id);
    }
    if (d.method === 'Runtime.exceptionThrown') errors.push(d.params);
  };
  const cdp = (method, params = {}) =>
    new Promise((r, j) => {
      const n = ++id;
      pending.set(n, r);
      ws.send(JSON.stringify({ id: n, method, params }));
      setTimeout(() => {
        if (pending.delete(n)) j(new Error(method + ' timeout'));
      }, 45000).unref();
    });
  const ev = async expression => {
    const r = await cdp('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
    return r.result?.value;
  };
  const snapPng = async () => {
    try {
      const s = await Promise.race([
        cdp('Page.captureScreenshot', { format: 'png' }),
        new Promise((_, j) => setTimeout(() => j(new Error('short timeout')), 5000)),
      ]);
      if (s?.data) return s.data;
    } catch {}
    return ev(`(() => {
      const c = document.querySelector('canvas');
      return c.toDataURL('image/png').split(',')[1];
    })()`);
  };

  await cdp('Runtime.enable');
  await cdp('Page.enable');
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
  const url = 'http://127.0.0.1:5173/?nomenu&noprobe&view=ground&rec&day=227&hour=12';
  await cdp('Page.navigate', { url });

  let ready = false;
  for (let i = 0; i < 90; i++) {
    await sleep(1000);
    if (await ev("document.readyState==='complete' && !document.getElementById('loading') && !!window.__boreal")) {
      ready = true;
      break;
    }
  }
  if (!ready) throw new Error('not ready: ' + (await ev('location.href')));
  await sleep(3000);

  await ev(`(async () => {
    window.auditWeather = await import('/src/core/weather.ts');
    window.auditSenses = await import('/src/core/senses.ts');
    window.auditNeedSenses = await import('/src/core/needs/senses.ts');
    window.auditSpecies = await import('/src/core/needs/species/index.ts');
    window.auditDeltas = await import('/src/core/deltas.ts');
    window.auditGround = await import('/src/core/ground.ts');
    window.auditDrives = await import('/src/core/drives.ts');
    window.auditDrives.resetDrives({ x: 9999, z: 9999, hunger: 0, protect: 0 });
    const c = document.querySelector('canvas');
    window.auditStart = performance.now();
    window.auditChunks = [];
    window.auditRecorder = new MediaRecorder(c.captureStream(15), { mimeType: 'video/webm' });
    auditRecorder.ondataavailable = e => auditChunks.push(e.data);
    auditRecorder.start();
  })()`);

  const observations = [];

  // Frame 0: Trigger the hare to bolt/flee (by briefly placing the wolf 4 m from it), then place the wolf 14 m UPWIND of the fleeing hare
  // (where scentLevel < SENSES.threshold 0.025 and all other plants/logs are > 20 m away), wait 1.9 s so prior sense bubbles expire (life = 1.75 s),
  // and keep the wolf at 14 m from the fleeing hare for 0.35 s so the HUD ticks while the hare is actively fleeing (sim.speed > 1.5 m/s) in front of the wolf.
  const obs0 = await ev(`(async () => {
    auditDrives.resetDrives({ x: 9999, z: 9999, hunger: 0, protect: 0 });
    auditDeltas.DELTAS.log.length = 0;
    const h0 = window.borealHares.list()[0];
    const w = auditWeather.windAt(h0.x, 0.8, h0.z);
    const wLen = Math.hypot(w.x, w.z) || 1;
    const ux = w.x / wLen, uz = w.z / wLen;
    // Trigger bolt by placing wolf 4 m from h0 for 0.25 s, then move to 14 m upwind for 1.85 s so any close-range bubbles expire:
    window.borealPlace(h0.x - ux * 4, h0.z - uz * 4, Math.atan2(-ux, -uz), 0);
    await new Promise(r => setTimeout(r, 250));
    for (let step = 0; step < 37; step++) {
      const hCur = window.borealHares.list().find(h => h.id === h0.id) || window.borealHares.list()[0];
      // If hare stopped fleeing, briefly step within 4.5 m to re-trigger flee, then resume 14 m tracking during the final 1.8 s
      const dTarget = step < 5 && !(hCur.sim.speed > 1.5) ? 4.5 : 14.0;
      const px = hCur.x - ux * dTarget;
      const pz = hCur.z - uz * dTarget;
      const yawNow = Math.atan2(-(hCur.x - px), -(hCur.z - pz));
      window.borealPlace(px, pz, yawNow, 0);
      await new Promise(r => setTimeout(r, 50));
    }
    const hFinal = window.borealHares.list().find(h => h.id === h0.id) || window.borealHares.list()[0];
    const pFinal = __boreal.player();
    const windNow = auditWeather.windAt(pFinal.x, 0.8, pFinal.z);
    const dist = Math.hypot(hFinal.x - pFinal.x, hFinal.z - pFinal.z);
    const actualSpeed = Number((hFinal.sim?.speed ?? 0).toFixed(3));
    const wolfScentOfHare = auditSenses.scentLevel(
      { x: pFinal.x, z: pFinal.z },
      { key: 'hare:' + hFinal.id, kind: 'hare', x: hFinal.x, z: hFinal.z, potency: 0.7 },
      windNow
    );
    const expectedPercept = auditNeedSenses.perceive(
      auditSpecies.WOLF_NEEDS,
      { x: pFinal.x, z: pFinal.z, heading: pFinal.yaw },
      { x: hFinal.x, z: hFinal.z, speed: actualSpeed },
      { daylight: 1, wind: windNow }
    );
    const sightBubbles = document.querySelectorAll('.sense-bubble-sight').length;
    const scentBubbles = document.querySelectorAll('.sense-bubble-scent').length;
    const soundBubbles = document.querySelectorAll('.sense-bubble-sound').length;
    return {
      frame: 0,
      scenario: 'Wolf 14 m upwind of actively fleeing hare in broad daylight (scentLevel < 0.025, sim.speed > 1.5 m/s)',
      wolf: { x: Number(pFinal.x.toFixed(2)), z: Number(pFinal.z.toFixed(2)), yaw: Number(pFinal.yaw.toFixed(3)) },
      hare: { id: hFinal.id, x: Number(hFinal.x.toFixed(2)), z: Number(hFinal.z.toFixed(2)), state: hFinal.state, simSpeedMps: actualSpeed, distanceM: Number(dist.toFixed(2)) },
      wind: { x: Number(windNow.x.toFixed(3)), z: Number(windNow.z.toFixed(3)) },
      wolfScentLevelOfHare: Number(wolfScentOfHare.toFixed(6)),
      expectedSightStrength: Number(expectedPercept.sight.toFixed(4)),
      domSightBubbles: sightBubbles,
      domScentBubbles: scentBubbles,
      domSoundBubbles: soundBubbles,
    };
  })()`);
  observations.push(obs0);
  writeFileSync(resolve(out, 'frame-0.png'), Buffer.from(await snapPng(), 'base64'));

  // Frame 1: Positive control — move the hare into an open spot with no nearby plants/logs (x=80, z=-25) so `lastHits` (thoughtCap=3)
  // is not filled by closer plants, wait 1.9 s for prior sense bubbles to expire and reemit cooldown (0.9 s) to clear,
  // then keep the wolf 2.5 m from the hare so distance < presenceM (6 m), wolfScentLevelOfHare >= SENSES.threshold (0.025),
  // smell() lastHits includes the hare, and both scent and sight bubbles appear!
  const obs1 = await ev(`(async () => {
    auditDrives.resetDrives({ x: 9999, z: 9999, hunger: 0, protect: 0 });
    auditDeltas.DELTAS.log.length = 0;
    // Wait 1.9 s at (120, -28) far from entities so all existing bubbles expire and reemit cooldowns clear:
    window.borealPlace(120, -28, 0, 0);
    await new Promise(r => setTimeout(r, 1900));
    const h0 = window.borealHares.list()[0];
    h0.x = 80; h0.z = -25; h0.sim.x = 80; h0.sim.z = -25;
    for (let step = 0; step < 8; step++) {
      const hCur = window.borealHares.list().find(h => h.id === h0.id) || window.borealHares.list()[0];
      const w = auditWeather.windAt(hCur.x, 0.8, hCur.z);
      const wLen = Math.hypot(w.x, w.z) || 1;
      const ux = w.x / wLen, uz = w.z / wLen;
      const px = hCur.x + ux * 2.5;
      const pz = hCur.z + uz * 2.5;
      const yawNow = Math.atan2(-(hCur.x - px), -(hCur.z - pz));
      window.borealPlace(px, pz, yawNow, 0);
      await new Promise(r => setTimeout(r, 50));
    }
    const hCheck = window.borealHares.list().find(h => h.id === h0.id) || window.borealHares.list()[0];
    const pCheck = __boreal.player();
    const windNow = auditWeather.windAt(pCheck.x, 0.8, pCheck.z);
    const dist = Math.hypot(hCheck.x - pCheck.x, hCheck.z - pCheck.z);
    const actualSpeed = Number((hCheck.sim?.speed ?? 0).toFixed(3));
    const hareSource = { key: 'hare:' + hCheck.id, kind: 'hare', x: hCheck.x, z: hCheck.z, potency: 0.7 };
    const wolfScentOfHare = auditSenses.scentLevel({ x: pCheck.x, z: pCheck.z }, hareSource, windNow);
    const inSmellHits = auditSenses.smell({ x: pCheck.x, z: pCheck.z }, [hareSource], windNow, pCheck.yaw).some(s => s.key === hareSource.key);
    const expectedPercept = auditNeedSenses.perceive(
      auditSpecies.WOLF_NEEDS,
      { x: pCheck.x, z: pCheck.z, heading: pCheck.yaw },
      { x: hCheck.x, z: hCheck.z, speed: actualSpeed },
      { daylight: 1, wind: windNow }
    );
    const sightBubbles = document.querySelectorAll('.sense-bubble-sight').length;
    const scentBubbles = document.querySelectorAll('.sense-bubble-scent').length;
    return {
      frame: 1,
      scenario: 'Positive control: Wolf 2.5 m from hare (inside scent threshold 0.025 and presenceM 6 m; lastHits includes hare)',
      wolf: { x: Number(pCheck.x.toFixed(2)), z: Number(pCheck.z.toFixed(2)), yaw: Number(pCheck.yaw.toFixed(3)) },
      hare: { id: hCheck.id, x: Number(hCheck.x.toFixed(2)), z: Number(hCheck.z.toFixed(2)), state: hCheck.state, simSpeedMps: actualSpeed, distanceM: Number(dist.toFixed(2)) },
      wind: { x: Number(windNow.x.toFixed(3)), z: Number(windNow.z.toFixed(3)) },
      wolfScentLevelOfHare: Number(wolfScentOfHare.toFixed(6)),
      inSmellLastHits: inSmellHits,
      expectedSightStrength: Number(expectedPercept.sight.toFixed(4)),
      domSightBubbles: sightBubbles,
      domScentBubbles: scentBubbles,
    };
  })()`);
  observations.push(obs1);
  writeFileSync(resolve(out, 'frame-1.png'), Buffer.from(await snapPng(), 'base64'));

  // Frame 2: Place wolf away from hares in the loaded clearing and record an invisible scent delta 2.0 m ahead (strongest scent hit).
  // Because deltaSources are included in smell() lastHits and within presenceM (6 m), ui/senses.ts falsely emits a sight (eye) bubble!
  const obs2 = await ev(`(async () => {
    auditDrives.resetDrives({ x: 9999, z: 9999, hunger: 0, protect: 0 });
    for (const h of window.borealHares.list()) { h.x = 0; h.z = 0; h.sim.x = 0; h.sim.z = 0; }
    const px = 80, pz = -28, yaw = 0;
    window.borealPlace(px, pz, yaw, 0);
    auditDeltas.DELTAS.log.length = 0;
    // Wait 1.9 s so all previous sense bubbles expire (life = 1.75 s) and reemit cooldown (0.9 s) clears
    await new Promise(r => setTimeout(r, 1900));
    auditDeltas.DELTAS.log.length = 0;
    // Record an invisible scent mark 2.0 m ahead (at x=80, z=-30) at current game year
    auditDeltas.record({ kind: 'scent', x: 80, z: -30, t: auditGround.GROUND.years, m: 1 });
    await new Promise(r => setTimeout(r, 1050));
    const pCheck = __boreal.player();
    const sightBubbles = document.querySelectorAll('.sense-bubble-sight').length;
    const scentBubbles = document.querySelectorAll('.sense-bubble-scent').length;
    return {
      frame: 2,
      scenario: 'Invisible territory scent mark (delta kind=scent) 2.0 m ahead of wolf with no animal in view',
      wolf: { x: Number(pCheck.x.toFixed(2)), z: Number(pCheck.z.toFixed(2)), yaw: Number(pCheck.yaw.toFixed(3)) },
      scentMark: { kind: 'scent', x: 80, z: -30, distanceM: 2.0 },
      expectedSightBubbles: 0,
      domSightBubbles: sightBubbles,
      domScentBubbles: scentBubbles,
    };
  })()`);
  observations.push(obs2);
  writeFileSync(resolve(out, 'frame-2.png'), Buffer.from(await snapPng(), 'base64'));

  const videoBase64 = await ev(`new Promise(resolve => {
    auditRecorder.onstop = async () => {
      const blob = new Blob(auditChunks, { type: 'video/webm' });
      const buf = await blob.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let bin = '';
      for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
      resolve(btoa(bin));
    };
    auditRecorder.stop();
  })`);
  writeFileSync(resolve(out, 'recording.webm'), Buffer.from(videoBase64, 'base64'));
  writeFileSync(resolve(out, 'observations.json'), JSON.stringify({ url, errors, observations }, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify({ errors: errors.length, observations }, null, 2));
} finally {
  try {
    ws?.close();
  } catch {}
  if (edgeProc?.pid) {
    try {
      execSync(`taskkill /PID ${edgeProc.pid} /T /F`, { stdio: 'ignore' });
    } catch {}
  }
}
