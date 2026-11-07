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

  // Frame 0: Place the wolf 16 m UPWIND of a live hare (so wind blows from the wolf toward the hare).
  // The hare smells/sees the wolf and flees right in front of the wolf in broad daylight,
  // yet because the hare is downwind of the wolf's nose, scentLevel < SENSES.threshold and Wolf senses shows 0 sight bubbles!
  const obs0 = await ev(`(async () => {
    auditDrives.resetDrives({ x: 9999, z: 9999, hunger: 0, protect: 0 });
    auditDeltas.DELTAS.log.length = 0;
    const hares = __boreal.hares();
    const h0 = hares[0];
    const w = auditWeather.windAt(h0.x, 0.8, h0.z);
    const wLen = Math.hypot(w.x, w.z) || 1;
    const ux = w.x / wLen, uz = w.z / wLen;
    // Place wolf 16 m upwind of h0 so vector from hare to wolf is (-ux*16, -uz*16):
    // In scentLevel(nose, source, wind): dx = nose.x - source.x, dz = nose.z - source.z.
    // We want down = (dx * wind.x + dz * wind.z) / speed < 0 for the wolf (nose=wolf, source=hare),
    // which means nose - source is opposite to wind -> wolf is upwind of hare!
    const px = h0.x - ux * 16;
    const pz = h0.z - uz * 16;
    const yawToHare = Math.atan2(-(h0.x - px), -(h0.z - pz));
    window.borealPlace(px, pz, yawToHare, 0);
    // Wait 1.8 s so any prior sense bubbles expire (life = 1.75 s) and the hare reacts/flees while sensesHUD updates
    await new Promise(r => setTimeout(r, 1850));
    const hNow = __boreal.hares().find(h => h.id === h0.id) || __boreal.hares()[0];
    const pNow = __boreal.player();
    const windNow = auditWeather.windAt(pNow.x, 0.8, pNow.z);
    const yawNow = Math.atan2(-(hNow.x - pNow.x), -(hNow.z - pNow.z));
    window.borealPlace(pNow.x, pNow.z, yawNow, 0);
    await new Promise(r => setTimeout(r, 450));
    const hFinal = __boreal.hares().find(h => h.id === hNow.id) || hNow;
    const pFinal = __boreal.player();
    const dist = Math.hypot(hFinal.x - pFinal.x, hFinal.z - pFinal.z);
    const wolfScentOfHare = auditSenses.scentLevel(
      { x: pFinal.x, z: pFinal.z },
      { key: 'hare:' + hFinal.id, kind: 'hare', x: hFinal.x, z: hFinal.z, potency: 0.7 },
      windNow
    );
    const speedEst = hFinal.state === 'flee' ? 8.5 : 1.2;
    const expectedPercept = auditNeedSenses.perceive(
      auditSpecies.WOLF_NEEDS,
      { x: pFinal.x, z: pFinal.z, heading: pFinal.yaw },
      { x: hFinal.x, z: hFinal.z, speed: speedEst },
      { daylight: 1, wind: windNow }
    );
    const sightBubbles = document.querySelectorAll('.sense-bubble-sight').length;
    const scentBubbles = document.querySelectorAll('.sense-bubble-scent').length;
    const soundBubbles = document.querySelectorAll('.sense-bubble-sound').length;
    return {
      frame: 0,
      scenario: 'Wolf upwind of visible hare in broad daylight (wind blowing from wolf to hare)',
      wolf: { x: Number(pFinal.x.toFixed(2)), z: Number(pFinal.z.toFixed(2)), yaw: Number(pFinal.yaw.toFixed(3)) },
      hare: { id: hFinal.id, x: Number(hFinal.x.toFixed(2)), z: Number(hFinal.z.toFixed(2)), state: hFinal.state, distanceM: Number(dist.toFixed(2)) },
      wind: { x: Number(windNow.x.toFixed(3)), z: Number(windNow.z.toFixed(3)) },
      wolfScentLevelOfHare: Number(wolfScentOfHare.toFixed(6)),
      expectedSightStrength: Number(expectedPercept.sight.toFixed(4)),
      domSightBubbles: sightBubbles,
      domScentBubbles: scentBubbles,
      domSoundBubbles: soundBubbles,
    };
  })()`);
  observations.push(obs0);
  const shot0 = await cdp('Page.captureScreenshot', { format: 'png' });
  writeFileSync(resolve(out, 'frame-0.png'), Buffer.from(shot0.data, 'base64'));

  // Frame 1: Place the wolf 3.5 m from the live hare (inside both scent threshold and presenceM = 6 m) and wait 1.1 s (> reemit 0.9 s).
  // Now scentLevel >= SENSES.threshold AND seen.sight >= SENSES.threshold, so both scent and sight bubbles appear.
  const obs1 = await ev(`(async () => {
    auditDrives.resetDrives({ x: 9999, z: 9999, hunger: 0, protect: 0 });
    auditDeltas.DELTAS.log.length = 0;
    const hares = __boreal.hares();
    const h0 = hares[0];
    const w = auditWeather.windAt(h0.x, 0.8, h0.z);
    const wLen = Math.hypot(w.x, w.z) || 1;
    const ux = w.x / wLen, uz = w.z / wLen;
    const px = h0.x + ux * 3.5;
    const pz = h0.z + uz * 3.5;
    const yawToHare = Math.atan2(-(h0.x - px), -(h0.z - pz));
    window.borealPlace(px, pz, yawToHare, 0);
    await new Promise(r => setTimeout(r, 1100));
    const hFinal = __boreal.hares().find(h => h.id === h0.id) || __boreal.hares()[0];
    const px2 = hFinal.x + ux * 3.5;
    const pz2 = hFinal.z + uz * 3.5;
    const yawNow = Math.atan2(-(hFinal.x - px2), -(hFinal.z - pz2));
    window.borealPlace(px2, pz2, yawNow, 0);
    await new Promise(r => setTimeout(r, 1050));
    const hCheck = __boreal.hares().find(h => h.id === hFinal.id) || hFinal;
    const pCheck = __boreal.player();
    const windNow = auditWeather.windAt(pCheck.x, 0.8, pCheck.z);
    const dist = Math.hypot(hCheck.x - pCheck.x, hCheck.z - pCheck.z);
    const wolfScentOfHare = auditSenses.scentLevel(
      { x: pCheck.x, z: pCheck.z },
      { key: 'hare:' + hCheck.id, kind: 'hare', x: hCheck.x, z: hCheck.z, potency: 0.7 },
      windNow
    );
    const expectedPercept = auditNeedSenses.perceive(
      auditSpecies.WOLF_NEEDS,
      { x: pCheck.x, z: pCheck.z, heading: pCheck.yaw },
      { x: hCheck.x, z: hCheck.z, speed: hCheck.state === 'flee' ? 8.5 : 0 },
      { daylight: 1, wind: windNow }
    );
    const sightBubbles = document.querySelectorAll('.sense-bubble-sight').length;
    const scentBubbles = document.querySelectorAll('.sense-bubble-scent').length;
    return {
      frame: 1,
      scenario: 'Wolf within scent threshold and presenceM of hare in broad daylight (lastHits includes hare)',
      wolf: { x: Number(pCheck.x.toFixed(2)), z: Number(pCheck.z.toFixed(2)), yaw: Number(pCheck.yaw.toFixed(3)) },
      hare: { id: hCheck.id, x: Number(hCheck.x.toFixed(2)), z: Number(hCheck.z.toFixed(2)), state: hCheck.state, distanceM: Number(dist.toFixed(2)) },
      wind: { x: Number(windNow.x.toFixed(3)), z: Number(windNow.z.toFixed(3)) },
      wolfScentLevelOfHare: Number(wolfScentOfHare.toFixed(6)),
      expectedSightStrength: Number(expectedPercept.sight.toFixed(4)),
      domSightBubbles: sightBubbles,
      domScentBubbles: scentBubbles,
    };
  })()`);
  observations.push(obs1);
  const shot1 = await cdp('Page.captureScreenshot', { format: 'png' });
  writeFileSync(resolve(out, 'frame-1.png'), Buffer.from(shot1.data, 'base64'));

  // Frame 2: Place wolf away from hares in the loaded clearing and record an invisible scent delta 2.0 m ahead (strongest scent hit).
  // Because deltaSources are included in smell() lastHits and within presenceM (6 m), ui/senses.ts falsely emits a sight (eye) bubble!
  const obs2 = await ev(`(async () => {
    auditDrives.resetDrives({ x: 9999, z: 9999, hunger: 0, protect: 0 });
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
  const shot2 = await cdp('Page.captureScreenshot', { format: 'png' });
  writeFileSync(resolve(out, 'frame-2.png'), Buffer.from(shot2.data, 'base64'));

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
