/**
 * Live browser screen recording + frame sampler + runtime telemetry for T-0232:
 * Wolf litter ontogeny, winter whelping phenology, staged-lake underwater pups & fox,
 * #109 Behavioral (20x) & Rewind (-10x) pup clock/visibility violations, and #309
 * perpetual 8.43 s Red Fox maternal-defense player-control hijack loop.
 *
 * Uses agy preview port 5258 and tools/bench-lock.mjs, terminating Vite and headless Edge cleanly on exit.
 */
import { spawn, execSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { acquire, track, release } from '../../../tools/bench-lock.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
mkdirSync(__dirname, { recursive: true });

const PORT = 5258;
const BASE_URL = process.env.BOREAL_URL || `http://127.0.0.1:${PORT}`;
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const CDP_PORT = 9370;
const WORK_ROOT = resolve(__dirname, '../../../work');
const PROFILE = resolve(WORK_ROOT, 'edge-litter-fox-drive-profile');
const LOCK_NAME = 'agy: T-0232-litter-fox-drive-audit';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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
        await srv.transformRequest('/src/animals/pups.ts');
        await srv.transformRequest('/src/core/litter.ts');
        await srv.transformRequest('/src/core/drives.ts');
      `;
      viteProc = spawn(process.execPath, ['--input-type=module', '-e', viteBoot], {
        stdio: 'ignore',
        cwd: resolve(__dirname, '../../..'),
      });
      if (viteProc.pid) track(viteProc.pid);
      let up = false;
      for (let i = 0; i < 60; i++) {
        try {
          const r = await fetch(`${BASE_URL}/src/core/litter.ts`);
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
      if (res?.exceptionDetails) throw new Error(`Eval error: ${res.exceptionDetails.text} ${res.exceptionDetails.exception?.description || ''}`);
      return res?.result?.value;
    };
    const snapPng = async (outFile) => {
      const res = await Promise.race([
        send('Page.captureScreenshot', { format: 'png' }),
        sleep(15000).then(() => { throw new Error('captureScreenshot timeout'); }),
      ]);
      writeFileSync(resolve(__dirname, outFile), Buffer.from(res.data, 'base64'));
    };

    const waitReady = async () => {
      let ready = false;
      for (let i = 0; i < 80; i++) {
        await sleep(500);
        ready = await evalJs(`Boolean(document.readyState === 'complete' && !document.getElementById('loading') && document.getElementById('status')?.innerText?.length > 10)`);
        if (ready) break;
      }
      if (!ready) throw new Error(`Game did not finish loading: ${JSON.stringify(pageErrors)}`);
    };

    await send('Page.enable');
    await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });

    const observations = [];

    // =========================================================================
    // FRAME 0: Mid-January (-19 °C, Snow 34.4 cm) at upland shoreline (-1188, -964, 1.9635):
    // 4-week woolly neonates in mid-winter + Red Fox spawned 1.37 m underwater + forced maternal lake charge!
    // =========================================================================
    const urlShoreJan = `${BASE_URL}/?nomenu&noprobe&view=ground&stages=1&date=2026-01-15&hour=12&at=-1188,-964,1.9635&rec`;
    await send('Page.navigate', { url: urlShoreJan });
    await waitReady();
    // Reset drives right at the dry shoreline start so we capture the exact 2.3 s -> 3.1 s forced charge into the lake!
    const probe0 = await evalJs(`(async () => {
      const findMod = (sub) => {
        const entries = performance.getEntriesByType('resource').map((r) => r.name);
        return entries.find((n) => n.includes(sub)) || sub;
      };
      const drivesMod = await import(findMod('/src/core/drives.ts'));
      const surfMod = await import(findMod('/src/core/stages/surfaceAt.ts'));
      drivesMod.resetDrives();
      // Wait 3.05 s of live gameplay (no user input!) so protect commits and marches mother + pups into lake
      await new Promise((r) => setTimeout(r, 3050));
      const p = window.__boreal.player();
      const drv = window.__borealDrive;
      const pups = window.__borealPups || [];
      const sm = surfMod.surfaceAt(p.x, p.z, 1400);
      const sf = drv ? surfMod.surfaceAt(drv.foxX, drv.foxZ, 1400) : null;
      const pupDepths = pups.map((pup) => {
        const sp = surfMod.surfaceAt(pup.x, pup.z, 1400);
        const w = sp.lake?.surface ?? sp.river?.surface ?? null;
        const py = Math.max(sp.height, -0.2);
        return {
          slot: pup.slot,
          ageYears: Number(pup.ageYears.toFixed(4)),
          stage: pup.stage,
          act: pup.act,
          pupY: Number(py.toFixed(3)),
          waterY: w !== null ? Number(w.toFixed(3)) : null,
          submergedDepthM: w !== null ? Number(Math.max(0, w - py).toFixed(3)) : 0,
        };
      });
      const wf = sf ? (sf.lake?.surface ?? sf.river?.surface ?? null) : null;
      return {
        frame: 0,
        label: 'january_winter_neonates_and_forced_maternal_lake_charge_submerging_pups_and_fox',
        statusSnapshot: document.getElementById('status')?.innerText || '',
        motherPoseAfterUnprovokedCharge: {
          x: Number(p.x.toFixed(2)),
          z: Number(p.z.toFixed(2)),
          groundY: Number(sm.height.toFixed(3)),
          waterY: sm.lake?.surface ? Number(sm.lake.surface.toFixed(3)) : null,
          waterDepthM: sm.lake?.surface ? Number(Math.max(0, sm.lake.surface - sm.height).toFixed(3)) : 0,
        },
        driveState: drv ? {
          mode: drv.mode,
          protect: Number(drv.protect.toFixed(3)),
          committed: drv.committed,
          holdHijackingPlayerControls: drv.hold,
          foxX: Number(drv.foxX.toFixed(2)),
          foxZ: Number(drv.foxZ.toFixed(2)),
          foxWaterDepthM: wf !== null && sf ? Number(Math.max(0, wf - sf.height).toFixed(3)) : 0,
          effortPup: drv.effortPup,
        } : null,
        pups: pupDepths,
      };
    })()`);
    observations.push(probe0);
    await snapPng('frame-0.png');

    // =========================================================================
    // FRAME 1: Same-afternoon +4 hours (14,400 s) hyper-growth into 1.21x oversized woolly clones
    // larger than their own adult mother while fox prey effort stays 0.250 (2.5 kg neonate)!
    // =========================================================================
    const urlClearing = `${BASE_URL}/?nomenu&noprobe&view=ground&stages=1&date=2026-01-15&hour=12&at=30,0,0&rec`;
    await send('Page.navigate', { url: urlClearing });
    await waitReady();
    const probe1 = await evalJs(`(async () => {
      const findMod = (sub) => {
        const entries = performance.getEntriesByType('resource').map((r) => r.name);
        return entries.find((n) => n.includes(sub)) || sub;
      };
      const clockMod = await import(findMod('/src/core/worldClock.ts'));
      const litterMod = await import(findMod('/src/core/litter.ts'));
      const w0 = clockMod.worldSec();
      const pupsBefore = (window.__borealPups || []).map((p) => ({ slot: p.slot, ageYears: Number(p.ageYears.toFixed(4)), stage: p.stage }));
      // Advance world clock at 3,600x (1 hour / sec) for 4.2 real seconds (~15,120 worldSec = ~4.2 hours, 12:00 -> 16:12),
      // then return to 1x real-time on the same afternoon!
      clockMod.setClockRate(3600);
      await new Promise((r) => setTimeout(r, 4200));
      clockMod.setClockRate(1);
      await new Promise((r) => setTimeout(r, 400));
      const w1 = clockMod.worldSec();
      const pupsAfter = (window.__borealPups || []).map((p) => {
        const grown = litterMod.pupScale(p.ageYears);
        const bulk = 0.88 + ((p.slot * 3 + 1) % 5) * 0.05;
        return {
          slot: p.slot,
          ageYears: Number(p.ageYears.toFixed(4)),
          stage: p.stage,
          scaleXYZ: [
            Number((grown * 1.1 * bulk).toFixed(4)),
            Number((grown * bulk).toFixed(4)),
            Number((grown * 1.12 * bulk).toFixed(4)),
          ],
        };
      });
      const drv = window.__borealDrive;
      return {
        frame: 1,
        label: 'four_hour_same_afternoon_hypergrowth_to_1_21x_oversized_woolly_clones',
        elapsedWorldSec: Number((w1 - w0).toFixed(1)),
        pupsBefore,
        pupsAfter,
        maxLengthScaleVsMother: Math.max(...pupsAfter.map((p) => p.scaleXYZ[2])),
        foxEffortOnGrownOffspring: drv ? drv.effortPup : null,
        statusSnapshot: document.getElementById('status')?.innerText || '',
      };
    })()`);
    observations.push(probe1);
    await snapPng('frame-1.png');

    // =========================================================================
    // FRAME 2 + RECORDING.WEBM: Late-May sunlit clearing (2026-05-28 12:00):
    // Part A (~2.7 s at 1x): Red Fox at 11 m triggers unprovoked maternal charge hijack (hold = true)!
    // Part B (~2.1 s at 20x Behavioral scale + -10x Rewind check): Wild animals fold (simDt = 0),
    // yet the 5 pups stay 100% visible and keep walking/jumping/tumbling at 1x wall-clock speed!
    // =========================================================================
    const urlSpring = `${BASE_URL}/?nomenu&noprobe&view=ground&stages=1&date=2026-05-28&hour=12&at=30,0,0&rec`;
    await send('Page.navigate', { url: urlSpring });
    await waitReady();

    await evalJs(`(async () => {
      const findMod = (sub) => {
        const entries = performance.getEntriesByType('resource').map((r) => r.name);
        return entries.find((n) => n.includes(sub)) || sub;
      };
      const drivesMod = await import(findMod('/src/core/drives.ts'));
      drivesMod.resetDrives();

      const comp = document.createElement('canvas');
      comp.width = 1280;
      comp.height = 720;
      const ctx = comp.getContext('2d');
      const glCanvas = document.querySelector('canvas');
      window.__stopComp = false;
      const drawComp = () => {
        if (!window.__stopComp) {
          ctx.drawImage(glCanvas, 0, 0, 1280, 720);
          const drv = window.__borealDrive;
          ctx.fillStyle = 'rgba(12, 18, 22, 0.82)';
          ctx.fillRect(12, 12, 470, 92);
          ctx.fillStyle = '#e8f0ec';
          ctx.font = '13px monospace';
          if (drv) {
            ctx.fillText(\`Drives: mode=\${drv.mode}  protect=\${drv.protect.toFixed(2)}  committed=\${drv.committed}  hold=\${drv.hold}\`, 22, 34);
            const fd = Math.hypot(drv.foxX - drv.mamaX, drv.foxZ - drv.mamaZ);
            ctx.fillText(\`Fox dist=\${fd.toFixed(2)}m  hunger=\${drv.hunger.toFixed(2)}  effortPup=\${drv.effortPup.toFixed(2)}\`, 22, 54);
          }
          const st = (document.getElementById('status')?.innerText || '').split('\\n')[0] || '';
          ctx.fillText(st.slice(0, 62), 22, 76);
          const pups = window.__borealPups || [];
          if (pups[0]) {
            ctx.fillText(\`Pup0 age=\${pups[0].ageYears.toFixed(3)}yr (\${pups[0].stage}) act=\${pups[0].act} pos=(\${pups[0].x.toFixed(2)}, \${pups[0].z.toFixed(2)})\`, 22, 94);
          }
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

    // Record 2.75 s at 1x so protect hits 0.50 and hijacks player controls (hold = true)
    await sleep(2750);

    // Switch #109 dial to 20x Behavioral scale (simDt = 0, bodyShare = 0) and measure pup movement over 600 ms,
    // then also measure -10x Rewind pup movement over 400 ms!
    const probe2 = await evalJs(`(async () => {
      const findMod = (sub) => {
        const entries = performance.getEntriesByType('resource').map((r) => r.name);
        return entries.find((n) => n.includes(sub)) || sub;
      };
      const clockMod = await import(findMod('/src/core/worldClock.ts'));
      const coarseMod = await import(findMod('/src/core/coarse.ts'));
      const drvDuringCharge = { ...(window.__borealDrive || {}) };

      // 1. Test Behavioral 20x scale:
      clockMod.setClockRate(20);
      await new Promise((r) => setTimeout(r, 150));
      const obs20 = clockMod.observation();
      const simDtSample20 = clockMod.simWorldSec(20 * (1 / 60), obs20);
      const expectedBodyShare20 = coarseMod.animalShares(1.0, obs20).body;
      const p20Start = (window.__borealPups || []).map((p) => ({ x: p.x, z: p.z, yaw: p.yaw, act: p.act }));
      await new Promise((r) => setTimeout(r, 650));
      const p20End = (window.__borealPups || []).map((p) => ({ x: p.x, z: p.z, yaw: p.yaw, act: p.act }));
      const pupMotionWhileSimDtZeroAt20x = p20End.map((p, i) => ({
        slot: i,
        deltaPosM: Number(Math.hypot(p.x - p20Start[i].x, p.z - p20Start[i].z).toFixed(4)),
        deltaYawRad: Number(Math.abs(p.yaw - p20Start[i].yaw).toFixed(4)),
      }));

      return {
        frame: 2,
        label: 'behavioral_20x_scale_pups_unfolded_and_moving_while_simdt_zero_plus_charge_hijack',
        driveDuringHijack: {
          mode: drvDuringCharge.mode,
          protect: Number((drvDuringCharge.protect ?? 0).toFixed(3)),
          committed: drvDuringCharge.committed,
          hold: drvDuringCharge.hold,
        },
        clockRateAt20x: clockMod.clockRate(),
        observationAt20x: obs20,
        simWorldSecAt20x: simDtSample20,
        expectedCoarseBodyShareAt20x: expectedBodyShare20,
        pupMotionOver650msAt20xWhileSimDtZero: pupMotionWhileSimDtZeroAt20x,
        statusSnapshotAt20x: document.getElementById('status')?.innerText || '',
      };
    })()`);
    await snapPng('frame-2.png');

    // Also measure -10x Rewind pup motion for 450 ms before stopping recording
    const rewindProbe = await evalJs(`(async () => {
      const findMod = (sub) => {
        const entries = performance.getEntriesByType('resource').map((r) => r.name);
        return entries.find((n) => n.includes(sub)) || sub;
      };
      const clockMod = await import(findMod('/src/core/worldClock.ts'));
      clockMod.setClockRate(-10);
      await new Promise((r) => setTimeout(r, 100));
      const rStart = (window.__borealPups || []).map((p) => ({ x: p.x, z: p.z, yaw: p.yaw }));
      await new Promise((r) => setTimeout(r, 450));
      const rEnd = (window.__borealPups || []).map((p) => ({ x: p.x, z: p.z, yaw: p.yaw }));
      return {
        clockRateRewind: clockMod.clockRate(),
        simWorldSecOnRewind: clockMod.simWorldSec(-10 * (1 / 60), clockMod.observation()),
        pupMotionOver450msDuringRewind: rEnd.map((p, i) => ({
          slot: i,
          deltaPosM: Number(Math.hypot(p.x - rStart[i].x, p.z - rStart[i].z).toFixed(4)),
          deltaYawRad: Number(Math.abs(p.yaw - rStart[i].yaw).toFixed(4)),
        })),
      };
    })()`);
    probe2.rewindCheck = rewindProbe;
    observations.push(probe2);

    await sleep(400);
    const webmB64 = await evalJs(`new Promise((resolve) => {
      window.__stopComp = true;
      const rec = window.__rec;
      rec.onstop = () => {
        const blob = new Blob(window.__recChunks, { type: 'video/webm' });
        const reader = new FileReader();
        reader.onloadend = () => resolve(String(reader.result).split(',')[1] || '');
        reader.readAsDataURL(blob);
      };
      rec.stop();
    })`);
    writeFileSync(resolve(__dirname, 'recording.webm'), Buffer.from(webmB64, 'base64'));

    const outJson = {
      capturedAt: new Date().toISOString(),
      baseUrl: BASE_URL,
      observations,
      pageErrors,
    };
    writeFileSync(resolve(__dirname, 'observations.json'), JSON.stringify(outJson, null, 2) + '\n', 'utf8');
    console.log(JSON.stringify(outJson, null, 2));
    ws.close();
  } finally {
    if (edge?.pid) {
      try { execSync(`taskkill /PID ${edge.pid} /T /F`, { stdio: 'ignore' }); } catch {}
    }
    if (viteProc?.pid) {
      try { execSync(`taskkill /PID ${viteProc.pid} /T /F`, { stdio: 'ignore' }); } catch {}
    }
    release(LOCK_NAME);
    rmSync(WORK_ROOT, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
