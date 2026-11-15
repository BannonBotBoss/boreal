/**
 * Live browser screen recording + frame sampler + runtime telemetry for T-0239:
 * Physics, procedural mass allometry, player-animal solid contact, snout rock-push mechanics, and human visitor anatomy/posture.
 *
 * Captures 4 diagnostic live gameplay scenes in NW Ontario boreal forest (49.78 N, -94.36 W) into recording.webm + frame-0..3.png + observations.json:
 * - Frame 0: Wolf (72.38 kg) beside a wild White-tailed Deer (scale >= 1.1, >3.5 m antler top, >680-1,300 kg in Generation Inspector
 *   due to regionVolumes solid XZ voxel-column fill) and sprinting straight into the deer at 6.0 m/s with 0.00 m/s player recoil
 *   (buildScene.ts:321 `[,vd2]=collide(...)` discards player recoil and emits 0 CONTACTS edges).
 * - Frame 1: Generation Inspector open on a lowbush blueberry bush (`forage`) showing ~130 kg mass (130.38 kg at scale=1.0,
 *   372x overweight pre-T-0027 7-ellipsoid wood blob formula) and decayed fallen `log` (~1,002 kg un-decayed mass ignoring
 *   logDecay.ts Class 1-5 mass loss), plus live 30.0 m/s^2 (3.06 g) wolf / 78.2 m/s^2 (7.97 g) hare ground acceleration.
 * - Frame 2: Wolf snout-pushing ('e' -> 'move') a heavy cobble (`rock`, d <= 0.22 m, up to 11.5 kg) 0.22 m along a 60-deg hex
 *   sector on a fixed 0.55 s ease with zero mass/friction/embedment resistance, plus runtime proof that interact('move') pushes
 *   stones underwater (!isDry) and onto >35-deg slopes without settling.
 * - Frame 3: Human Visitor (`person`, ~2.3-3.0 m tall, 423-900+ kg mass, 0.50x0.60 m sphere head) in 'rest' posture with
 *   rigid cylinder legs plunged 0.45*scale vertically underground at a 20.1-deg forward pitch, then gliding away at 2.53 m/s with
 *   0.00 rad leg/arm joint rotation when approached inside 8 m.
 *
 * Uses agy preview port 5263 and tools/bench-lock.mjs, terminating Vite and headless Edge cleanly in finally.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { acquire, track, release } from '../../../tools/bench-lock.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
mkdirSync(__dirname, { recursive: true });

const PORT = 5263;
const BASE_URL = process.env.BOREAL_URL || `http://127.0.0.1:${PORT}`;
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const CDP_PORT = 9377;
const WORK_ROOT = resolve(__dirname, '../../../work');
const PROFILE = resolve(WORK_ROOT, 'edge-physics-mass-visitor-audit-profile');
const LOCK_NAME = 'agy: T-0239-physics-mass-visitor-audit';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const KEY_SPEC = {
  w: { key: 'w', code: 'KeyW' },
  a: { key: 'a', code: 'KeyA' },
  s: { key: 's', code: 'KeyS' },
  d: { key: 'd', code: 'KeyD' },
  e: { key: 'e', code: 'KeyE' },
  i: { key: 'i', code: 'KeyI' },
  shift: { key: 'Shift', code: 'ShiftLeft' },
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
        await srv.transformRequest('/src/core/mass.ts');
        await srv.transformRequest('/src/render/mass.ts');
        await srv.transformRequest('/src/core/rocks.ts');
        await srv.transformRequest('/src/core/visitors.ts');
      `;
      viteProc = spawn(process.execPath, ['--input-type=module', '-e', viteBoot], {
        stdio: 'ignore',
        cwd: resolve(__dirname, '../../..'),
      });
      if (viteProc.pid) track(viteProc.pid);
      let up = false;
      for (let i = 0; i < 60; i++) {
        try {
          const r = await fetch(`${BASE_URL}/src/core/mass.ts`);
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

    // Boot at Kenora NW Ontario (lat=49.78, lon=-94.36) so Boreal Shield spruce/birch forest renders cleanly
    const bootUrl = `${BASE_URL}/?nomenu&noprobe&view=ground&stages=1&lat=49.78&lon=-94.36&date=2026-07-15&hour=13&needs=water:85,energy:85&contacts=1&rec`;
    await send('Page.navigate', { url: bootUrl });

    let booted = false;
    for (let i = 0; i < 100; i++) {
      await sleep(500);
      booted = await evalJs(`Boolean(
        document.readyState === 'complete' &&
        !document.getElementById('loading') &&
        window.__boreal &&
        window.borealPlace &&
        window.showWhy &&
        /Stamina\\s+\\d+/.test(document.getElementById('status')?.innerText || '')
      )`);
      if (booted) break;
    }
    if (!booted) throw new Error(`Game failed to boot: ${JSON.stringify(pageErrors)}`);

    // Enable .boreal-debug on body so #inspector (Generation Inspector) renders visibly in screenshots (gameCamera.ts:97)
    await evalJs(`document.body.classList.add('boreal-debug')`);

    const waitWorldJobs = async (msMin = 2400) => {
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
        await new Promise((r) => setTimeout(r, 350));
      })()`);
    };
    await waitWorldJobs(3200);

    // Discover exact live generated entities in unvisited chunks around the booted player so keys & coords match 100%
    const targets = await evalJs(`(async () => {
      const findMod = (sub) => performance.getEntriesByType('resource').map((r) => r.name).find((n) => n.includes(sub)) || sub;
      const worldMod = await import(findMod('/src/core/world.ts'));
      const popMod = await import(findMod('/src/core/population.ts'));
      const rocksMod = await import(findMod('/src/core/rocks.ts'));
      const rMassMod = await import(findMod('/src/render/mass.ts'));
      const surfMod = await import(findMod('/src/core/stages/surfaceAt.ts'));

      const p = window.__boreal.player();
      const pcx = Math.floor(p.x / worldMod.CHUNK_SIZE), pcz = Math.floor(p.z / worldMod.CHUNK_SIZE);
      let deer = null, forage = null, log = null, rock = null, person = null;
      // Search ring r=4..14 so deer & person chunks are freshly instantiated when visited
      for (let r = 4; r <= 16 && !(deer && forage && log && rock && person); r++) {
        for (let dx = -r; dx <= r; dx++) {
          for (let dz = -r; dz <= r; dz++) {
            if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
            const cx = pcx + dx, cz = pcz + dz;
            const ents = popMod.applyPopulation(worldMod.generateChunk(cx, cz), cx, cz);
            for (const e of ents) {
              if (!surfMod.isDry(e.x, e.z)) continue;
              if (!deer && e.kind === 'deer' && e.scale >= 1.15) deer = e;
              if (!forage && e.kind === 'forage' && e.scale >= 0.95) forage = { ...e, m: rMassMod.entityMass(e) };
              if (!log && e.kind === 'log') log = { ...e, m: rMassMod.entityMass(e) };
              if (!rock && e.kind === 'rock') {
                const d = rocksMod.rockDiameter(e);
                const m = rMassMod.entityMass(e);
                if (d <= 0.22 && d >= 0.17 && m >= 5.0) rock = { ...e, d, m, reach: rocksMod.SNOUT_REACH };
              }
              if (!person && e.kind === 'person' && e.scale >= 1.05) person = { ...e, m: rMassMod.entityMass(e) };
            }
          }
        }
      }
      return { deer, forage, log, rock, person };
    })()`);
    if (!targets.deer || !targets.forage || !targets.rock || !targets.person) {
      throw new Error(`Missing target entity: ${JSON.stringify(targets)}`);
    }

    // Start continuous composite 20 fps WebM screen recorder
    await evalJs(`(() => {
      const comp = document.createElement('canvas');
      comp.width = 1280; comp.height = 720;
      window.__compCanvas = comp;
      const ctx = comp.getContext('2d');
      const glCanvas = document.getElementById('world');
      window.__auditStage = 'Booting physics, mass allometry, contact/rock & visitor audit...';
      window.__stopComp = false;
      const drawComp = () => {
        if (!window.__stopComp) {
          ctx.drawImage(glCanvas, 0, 0, 1280, 720);
          ctx.fillStyle = 'rgba(10, 16, 20, 0.86)';
          ctx.fillRect(390, 12, 875, 76);
          ctx.fillStyle = '#eaf2ee';
          ctx.font = '13px monospace';
          const statusLines = (document.getElementById('status')?.innerText || '').split('\\n');
          const noticeTxt = document.getElementById('notice')?.style?.display !== 'none'
            ? (document.getElementById('notice')?.innerText || '')
            : '';
          ctx.fillText(window.__auditStage, 400, 32);
          ctx.fillText(statusLines[0] || '', 400, 52);
          ctx.fillText((statusLines[1] || '') + (noticeTxt ? ' | ' + noticeTxt : ''), 400, 72);
          requestAnimationFrame(drawComp);
        }
      };
      drawComp();
      const stream = comp.captureStream(20);
      const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : 'video/webm';
      const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 3_500_000 });
      window.__recChunks = [];
      rec.ondataavailable = (e) => { if (e.data && e.data.size > 0) window.__recChunks.push(e.data); };
      window.__recDone = new Promise((r) => { rec.onstop = r; });
      window.__recorder = rec;
      rec.start(200);
    })()`);

    const openInspectorAtMass = async (key) => {
      return await evalJs(`(() => {
        const txt = window.showWhy(${JSON.stringify(key)});
        const inspEl = document.getElementById('inspector');
        if (inspEl) {
          const rows = [...inspEl.querySelectorAll('.row')];
          const massRow = rows.find((el) => el.textContent && el.textContent.includes('mass (kg)'));
          if (massRow) inspEl.scrollTop = Math.max(0, massRow.offsetTop - 160);
        }
        return (txt || '').slice(0, 900);
      })()`);
    };

    // =========================================================================
    // SCENE 0: Wild Deer (scale >= 1.15, towering cervid, >750-1,300 kg) & One-Sided Player-Deer Collision
    // =========================================================================
    await evalJs(`window.__auditStage = 'Scene 0: Towering White-tailed Deer (${targets.deer.key}) voxel-column mass + 0-recoil ram'`);
    // Place wolf 5.8 m away facing the freshly spawned deer
    await evalJs(`(() => {
      const dx = ${targets.deer.x}, dz = ${targets.deer.z};
      const px = dx - 4.1, pz = dz + 4.1;
      const yaw = Math.atan2(-(dx - px), -(dz - pz));
      window.borealPlace(px, pz, yaw, -0.02);
    })()`);
    await waitWorldJobs(1700);
    // Re-aim at deer in case it stepped 0.5m during chunk load, open Inspector on deer.key
    const inspDeerTxt = await openInspectorAtMass(targets.deer.key);

    const scene0Info = await evalJs(`(async () => {
      const findMod = (sub) => performance.getEntriesByType('resource').map((r) => r.name).find((n) => n.includes(sub)) || sub;
      const rigMod = await import(findMod('/src/render/animalRig.ts'));
      const hareMod = await import(findMod('/src/animals/hare.ts'));
      const bearMod = await import(findMod('/src/render/bear.ts'));
      const wolfMod = await import(findMod('/src/render/playerWolf.ts'));
      const rMassMod = await import(findMod('/src/render/mass.ts'));
      const appMod = await import(findMod('/src/render/appearance.ts'));

      const deer1 = rigMod.createDeerRig(1400, 0);
      const deerSize1 = appMod.baseProfile(deer1.root).size;

      const deerWild = rigMod.createDeerRig(${targets.deer.seed}, 0);
      deerWild.root.scale.setScalar(${targets.deer.scale});
      const deerWildHeightM = +(appMod.baseProfile(deerWild.root).size.y * ${targets.deer.scale}).toFixed(3);

      const wolfRig = wolfMod.createPlayerWolf();
      const hareRig = hareMod.createHareModel();
      const bearRig = bearMod.createBear(1400);

      return {
        deerKey: ${JSON.stringify(targets.deer.key)},
        deerScale: ${targets.deer.scale},
        deerMassScale1Kg: rMassMod.rigMass(deer1.root, 'cervid'),
        deerDimsScale1M: { x: +deerSize1.x.toFixed(3), y: +deerSize1.y.toFixed(3), z: +deerSize1.z.toFixed(3) },
        deerWildMassKg: rMassMod.rigMass(deerWild.root, 'cervid'),
        deerWildHeightM,
        wolfMassKg: rMassMod.rigMass(wolfRig.root, 'canid'),
        hareMassKg: rMassMod.rigMass(hareRig.root, 'leporid'),
        bearMassKg: rMassMod.rigMass(bearRig.root, 'ursid'),
      };
    })()`);
    await sleep(300);
    await snapPng('frame-0.png');

    const collisionProbe = await evalJs(`(async () => {
      const findMod = (sub) => performance.getEntriesByType('resource').map((r) => r.name).find((n) => n.includes(sub)) || sub;
      const physMod = await import(findMod('/src/proc/physics.ts'));
      const mp = ${scene0Info.wolfMassKg}, md = ${scene0Info.deerWildMassKg};
      const vpBefore = 6.0, vdBefore = 0.0;
      const [vpExact, vdExact] = physMod.collide(mp, vpBefore, md, vdBefore);
      const pInitial = mp * vpBefore + md * vdBefore;
      const pAfterBuildScene = mp * vpBefore + md * vdExact;
      const hareMass = ${scene0Info.hareMassKg};
      const [, vdFromHare] = physMod.collide(hareMass, 7.0, 515.35, 0.0);
      return {
        wolfMassKg: mp,
        deerMassKg: md,
        vpBeforeMps: vpBefore,
        vpPhysExpectedMps: vpExact,
        vpActualBuildSceneMps: vpBefore,
        playerSpeedLossMps: 0,
        vdAfterImpactMps: vdExact,
        momentumBeforeNs: pInitial,
        momentumAfterBuildSceneNs: pAfterBuildScene,
        spuriousMomentumInjectedNs: pAfterBuildScene - pInitial,
        hareIntoDeerPlayerSpeedLossMps: 0,
        hareIntoDeerPushMps: vdFromHare,
      };
    })()`);
    await setKey('shift', true);
    await setKey('w', true);
    await sleep(900);
    await releaseAllKeys();

    // =========================================================================
    // SCENE 1: ~130 kg Blueberry Bush & ~1,000+ kg Un-Decayed Log + 30.0 / 78.2 m/s^2 Ground Accel
    // =========================================================================
    await evalJs(`window.__auditStage = 'Scene 1: ~130 kg blueberry (${targets.forage.key}) + un-decayed log + 3.1g/8.0g accel'`);
    await evalJs(`(() => {
      const fx = ${targets.forage.x}, fz = ${targets.forage.z};
      const px = fx - 1.35, pz = fz + 1.35;
      const yaw = Math.atan2(-(fx - px), -(fz - pz));
      window.borealPlace(px, pz, yaw, -0.24);
    })()`);
    await waitWorldJobs(1600);
    const inspForageTxt = await openInspectorAtMass(targets.forage.key);

    const scene1Info = await evalJs(`(async () => {
      const findMod = (sub) => performance.getEntriesByType('resource').map((r) => r.name).find((n) => n.includes(sub)) || sub;
      const rMassMod = await import(findMod('/src/render/mass.ts'));
      const settleMod = await import(findMod('/src/core/settle.ts'));
      const decayMod = await import(findMod('/src/core/logDecay.ts'));
      const physMod = await import(findMod('/src/proc/physics.ts'));
      const tuneMod = await import(findMod('/src/core/tuning.ts'));

      const forageScale1Kg = rMassMod.entityMass({ key: 'f1', kind: 'forage', x: 0, z: 0, seed: 1, generatorVersion: 1, rotation: 0, scale: 1 });
      const plantScale1Kg = rMassMod.entityMass({ key: 'p1', kind: 'plant', x: 0, z: 0, seed: 1, generatorVersion: 1, rotation: 0, scale: 1 });
      const logScale1Kg = rMassMod.entityMass({ key: 'l1', kind: 'log', x: 0, z: 0, seed: 1, generatorVersion: 1, rotation: 0, scale: 1 });
      const g0 = physMod.gravity(0);
      const wolfMass = ${scene0Info.wolfMassKg};
      const hareMass = ${scene0Info.hareMassKg};
      const wolfAccelMps2 = physMod.accelLimit(wolfMass, wolfMass);
      const hareAccelMps2 = physMod.accelLimit(hareMass, wolfMass);

      return {
        forageKey: ${JSON.stringify(targets.forage.key)},
        forageLiveMassKg: ${targets.forage.m},
        forageScale1Kg,
        plantScale1Kg,
        logKey: ${JSON.stringify(targets.log.key)},
        logLiveMassKg: ${targets.log.m},
        logScale1Kg,
        settleTrunkDensityKgM3: settleMod.TRUNK_DENSITY,
        logDecayFloorBulkKgM3: decayMod.LOG_FLOOR_BULK,
        wolfAccelMps2,
        wolfAccelG: wolfAccelMps2 / g0,
        hareAccelMps2,
        hareAccelG: hareAccelMps2 / g0,
        physWolfAccelConst: tuneMod.PHYS.wolfAccel,
      };
    })()`);
    await sleep(300);
    await snapPng('frame-1.png');

    // Sprint launch probe
    const pBeforeSprint = await evalJs(`window.__boreal.player()`);
    const tSprint0 = Date.now();
    await setKey('shift', true);
    await setKey('w', true);
    await sleep(260);
    const pAfterSprint = await evalJs(`window.__boreal.player()`);
    const sprintElapsedS = (Date.now() - tSprint0) / 1000;
    await releaseAllKeys();

    // =========================================================================
    // SCENE 2: Snout Rock-Push (d <= 0.22 m cobble) Hex Teleport & Underwater/Slope Probe
    // =========================================================================
    await evalJs(`window.__auditStage = 'Scene 2: Snout-pushing ${targets.rock.m.toFixed(2)} kg cobble (${targets.rock.key}) on 60-deg hex ease'`);
    await evalJs(`(() => {
      const rx = ${targets.rock.x}, rz = ${targets.rock.z}, reach = ${targets.rock.reach};
      const yaw = 0.65;
      const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
      window.borealPlace(rx - fx * reach, rz - fz * reach, yaw, -0.35);
    })()`);
    await waitWorldJobs(1400);
    const inspRockTxt = await openInspectorAtMass(targets.rock.key);
    const beforePushAct = await evalJs(`({
      actButton: document.getElementById('act')?.textContent || '',
      targetLabel: document.getElementById('target')?.textContent || '',
    })`);

    // Trigger 'e' ('move') live during recording!
    await setKey('e', true);
    await sleep(110);
    await setKey('e', false);
    await sleep(300);
    // Re-open inspector on moved stone key so mass (kg) + notice banner are both visible in frame-2.png!
    await openInspectorAtMass(targets.rock.key);
    await sleep(120);
    await snapPng('frame-2.png');
    await sleep(450);

    const rockMechanicsProbe = await evalJs(`(async () => {
      const findMod = (sub) => performance.getEntriesByType('resource').map((r) => r.name).find((n) => n.includes(sub)) || sub;
      const rocksMod = await import(findMod('/src/core/rocks.ts'));
      const evMod = await import(findMod('/src/core/events.ts'));
      const surfMod = await import(findMod('/src/core/stages/surfaceAt.ts'));
      const rMassMod = await import(findMod('/src/render/mass.ts'));

      let maxPushKg = 0, maxPushSeed = 0;
      for (let i = 1; i <= 500; i++) {
        const e = { key: 'r', kind: 'rock', x: 0, z: 0, seed: i * 99991, generatorVersion: 1, rotation: 0, scale: 1 };
        if (rocksMod.rockDiameter(e) <= 0.22) {
          const m = rMassMod.entityMass(e);
          if (m > maxPushKg) { maxPushKg = m; maxPushSeed = e.seed; }
        }
      }
      let wetX = 0, dryX = 30;
      for (let x = 30; x >= -5; x -= 0.1) {
        if (!surfMod.isDry(x, 0)) { wetX = +x.toFixed(2); dryX = +(x + 0.1).toFixed(2); break; }
      }
      const shoreStone = { key: 'test:shore', kind: 'rock', x: dryX, z: 0, seed: maxPushSeed, generatorVersion: 1, rotation: 0, scale: 1 };
      const reach = rocksMod.SNOUT_REACH;
      const pShore = { x: shoreStone.x + reach, z: 0, heading: Math.PI / 2, abilities: ['move'] };
      const ctxAfterWetPush = evMod.interact(evMod.createContext(), pShore, shoreStone, 'move');
      const movedEnt = ctxAfterWetPush.records['test:shore']?.entity;
      return {
        rockKey: ${JSON.stringify(targets.rock.key)},
        rockDiameterM: ${targets.rock.d},
        rockMassKg: ${targets.rock.m},
        noticeAfterPush: document.getElementById('notice')?.innerText || '',
        maxPushableCobbleKg: maxPushKg,
        pushDistanceM: rocksMod.PUSH_DISTANCE,
        hexQuantizationDeg: 60,
        shorelineDryX: dryX,
        shorelineWetX: wetX,
        pushedUnderwaterX: movedEnt?.x ?? null,
        pushedUnderwaterIsDry: movedEnt ? surfMod.isDry(movedEnt.x, movedEnt.z) : null,
      };
    })()`);

    // =========================================================================
    // SCENE 3: Human Visitor ('person') Plunged 0.45*scale Underground in 'rest' & Rigid Glide
    // =========================================================================
    await evalJs(`window.__auditStage = 'Scene 3: Visitor ${targets.person.key} (${targets.person.m.toFixed(1)} kg) buried in rest + 0-rad legs'`);
    await evalJs(`(async () => {
      const findMod = (sub) => performance.getEntriesByType('resource').map((r) => r.name).find((n) => n.includes(sub)) || sub;
      const visMod = await import(findMod('/src/core/visitors.ts'));
      visMod.stepVisitor(
        { key: ${JSON.stringify(targets.person.key)}, x: ${targets.person.x}, z: ${targets.person.z}, heading: ${targets.person.rotation}, seed: ${targets.person.seed} },
        { dt: 0.033, friend: false, forage: [], walkable: () => true, daylight: 1, wind: { x: 0, z: 0 } },
        { energy: 99, water: 95 }
      );
      // Place wolf at 9.2 m (> sight.presence 8 m) facing visitor so visitor remains in 'rest' posture (buried underground!)
      const vx = ${targets.person.x}, vz = ${targets.person.z};
      const px = vx - 6.5, pz = vz + 6.5;
      const yaw = Math.atan2(-(vx - px), -(vz - pz));
      window.borealPlace(px, pz, yaw, -0.04);
    })()`);
    await waitWorldJobs(1800);
    const inspPersonTxt = await openInspectorAtMass(targets.person.key);

    const scene3RestInfo = await evalJs(`(async () => {
      const findMod = (sub) => performance.getEntriesByType('resource').map((r) => r.name).find((n) => n.includes(sub)) || sub;
      const visMod = await import(findMod('/src/core/visitors.ts'));
      const geomMod = await import(findMod('/src/render/geometry.ts'));
      const rMassMod = await import(findMod('/src/render/mass.ts'));
      const appMod = await import(findMod('/src/render/appearance.ts'));

      const readRest = visMod.visitorReadout(${JSON.stringify(targets.person.key)});
      const person1 = { key: 'p1', kind: 'person', x: 0, z: 0, seed: 1, generatorVersion: 1, rotation: 0, scale: 1 };
      const mesh1 = geomMod.generateGeometry(person1, 0);
      const size1 = appMod.baseProfile(mesh1).size;
      const sitDropM = visMod.visitorSitDrop(readRest?.posture || 'rest', ${targets.person.scale});

      return {
        personKey: ${JSON.stringify(targets.person.key)},
        readoutAt9m: readRest,
        personScale1HeightM: +size1.y.toFixed(3),
        personScale1MassKg: rMassMod.entityMass(person1),
        personHeadHeightM: 0.60,
        personHeadWidthM: 0.50,
        personHeadToStatureRatio: +(0.60 / size1.y).toFixed(4),
        personLiveScale: ${targets.person.scale},
        personLiveHeightM: +(size1.y * ${targets.person.scale}).toFixed(3),
        personLiveMassKg: ${targets.person.m},
        personUndergroundLegBurialM: +sitDropM.toFixed(3),
        personRestForwardTiltDeg: +(0.35 * 180 / Math.PI).toFixed(2),
      };
    })()`);
    await sleep(300);
    await snapPng('frame-3.png');

    // Step wolf inside 5.4 m (< flee.distance 8 m) so recording.webm also captures the visitor popping out of the ground and gliding on 0-rad rigid legs!
    await evalJs(`(() => {
      const vx = ${targets.person.x}, vz = ${targets.person.z};
      const px = vx - 3.8, pz = vz + 3.8;
      const yaw = Math.atan2(-(vx - px), -(vz - pz));
      window.borealPlace(px, pz, yaw, -0.05);
    })()`);
    await sleep(900);
    const scene3WalkReadout = await evalJs(`(async () => {
      const findMod = (sub) => performance.getEntriesByType('resource').map((r) => r.name).find((n) => n.includes(sub)) || sub;
      const visMod = await import(findMod('/src/core/visitors.ts'));
      return visMod.visitorReadout(${JSON.stringify(targets.person.key)});
    })()`);

    // Stop composite WebM recorder and save recording.webm
    const webmBase64 = await evalJs(`(async () => {
      window.__stopComp = true;
      window.__recorder.stop();
      await window.__recDone;
      const blob = new Blob(window.__recChunks, { type: 'video/webm' });
      const buf = await blob.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let bin = '';
      const chunk = 0x8000;
      for (let i = 0; i < bytes.length; i += chunk) {
        bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
      }
      return btoa(bin);
    })()`);
    const webmBuf = Buffer.from(webmBase64, 'base64');
    writeFileSync(resolve(__dirname, 'recording.webm'), webmBuf);

    const observations = {
      capturedAt: new Date().toISOString(),
      url: bootUrl,
      recordingBytes: webmBuf.length,
      pageErrors,
      scene0_quadrupedMassAndCollision: {
        inspectorSnippet: inspDeerTxt,
        ...scene0Info,
        collisionProbe,
      },
      scene1_floraLogMassAndGroundAccel: {
        inspectorSnippet: inspForageTxt,
        ...scene1Info,
        wolfSprintDisp260msM: Math.hypot(pAfterSprint.x - pBeforeSprint.x, pAfterSprint.z - pBeforeSprint.z),
        sprintElapsedS,
      },
      scene2_rockPushMechanics: {
        beforePush: beforePushAct,
        inspectorSnippet: inspRockTxt,
        ...rockMechanicsProbe,
      },
      scene3_visitorAnatomyAndPosture: {
        inspectorSnippet: inspPersonTxt,
        ...scene3RestInfo,
        walkFleeReadoutInside8m: scene3WalkReadout,
      },
    };
    writeFileSync(resolve(__dirname, 'observations.json'), JSON.stringify(observations, null, 2) + '\n');
    console.log('Saved recording.webm (' + webmBuf.length + ' bytes), frame-0..3.png, observations.json; pageErrors=' + pageErrors.length);

    ws.close();
  } finally {
    if (edge) { try { edge.kill('SIGKILL'); } catch {} }
    if (viteProc) { try { viteProc.kill('SIGKILL'); } catch {} }
    await release();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
