/**
 * Live browser screen recording + frame sampler + runtime telemetry for T-0229
 * (embodied herbivore gameplay: ?play=hare and ?play=deer missing DEER_NEEDS template,
 * zero manual clover/browse/plant/berry feeding intake, meat-drumstick hunger thought bubbles,
 * and ungated carnivore hunt-lock / wolf vocalizations / WOLF_AGENT autonomy).
 * Uses agy preview port 5258 and tools/bench-lock.mjs, killing Vite and headless Edge cleanly on exit.
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
const CDP_PORT = 9369;
const WORK_ROOT = resolve(__dirname, '../../../work');
const PROFILE = resolve(WORK_ROOT, 'edge-embodied-herbivore-profile');
const LOCK_NAME = 'agy: T-0229-embodied-herbivore-audit';

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
        await srv.transformRequest('/src/render/playables.ts');
        await srv.transformRequest('/src/core/needs/species/index.ts');
        await srv.transformRequest('/src/render/thoughtBubbles.ts');
      `;
      viteProc = spawn(process.execPath, ['--input-type=module', '-e', viteBoot], {
        stdio: 'ignore',
        cwd: resolve(__dirname, '../../..'),
      });
      if (viteProc.pid) track(viteProc.pid);
      let up = false;
      for (let i = 0; i < 60; i++) {
        try {
          const r = await fetch(`${BASE_URL}/src/render/playables.ts`);
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
    // FRAME 0: Embodied Snowshoe Hare (?play=hare&needs=energy:8,water:45) in midsummer (day=196, hour=12)
    // =========================================================================
    const urlHare = `${BASE_URL}/?nomenu&noprobe&view=ground&stages=1&play=hare&needs=energy:8,water:45&rec&day=196&hour=12`;
    await send('Page.navigate', { url: urlHare });
    await waitReady();
    // Wait until we are ~0.55 s into a critical thought-bubble pulse (3.0 s period) so the meat-drumstick sprite is at high opacity
    await sleep(3200);

    // Test pressing E (interact / gather) on clover/forage and holding Shift (carnivore hunt-lock) as a Snowshoe Hare
    const hareProbe = await evalJs(`(async () => {
      const findMod = (sub) => {
        const entries = performance.getEntriesByType('resource').map((r) => r.name);
        return entries.find((n) => n.includes(sub)) || sub;
      };
      const fieldsMod = await import(findMod('/src/core/fields.ts'));
      const siteMod = await import(findMod('/src/core/flora/site.ts'));
      const speciesMod = await import(findMod('/src/core/needs/species/index.ts'));
      const thoughtsMod = await import(findMod('/src/core/needs/thoughts.ts'));
      const p0 = window.__boreal.player();
      const actBefore = document.getElementById('act')?.textContent || '';
      const actDisabledBefore = Boolean(document.getElementById('act')?.disabled);

      // Sample clover patches around player's current 16 m clover tile
      const tilePatches = fieldsMod.cloverPatchesInTile
        ? fieldsMod.cloverPatchesInTile(Math.floor(p0.x / 16), Math.floor(p0.z / 16), (x, z) => siteMod.siteAt(x, z))
        : [];
      const nearestClover = tilePatches
        .map((c) => ({ x: c.x, z: c.z, distM: Math.hypot(c.x - p0.x, c.z - p0.z), units: c.units ?? null }))
        .sort((a, b) => a.distM - b.distM)[0] || null;

      // Press E to attempt manual grazing/feeding as Snowshoe Hare
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE', key: 'e', bubbles: true }));
      await new Promise((r) => setTimeout(r, 120));
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyE', key: 'e', bubbles: true }));
      await new Promise((r) => setTimeout(r, 200));
      const pAfterE = window.__boreal.player();

      // Test holding ShiftLeft (carnivore hunt lock) briefly to verify prey-hunting controls are active on Snowshoe Hare
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ShiftLeft', key: 'Shift', bubbles: true }));
      await new Promise((r) => setTimeout(r, 180));
      const statusWhileHoldingLock = document.getElementById('status')?.innerText || '';
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'ShiftLeft', key: 'Shift', bubbles: true }));
      await new Promise((r) => setTimeout(r, 120));

      return {
        frame: 0,
        label: 'embodied_snowshoe_hare_starving_meat_thought_bubble_and_hunt_lock',
        sensesHudTitle: document.querySelector('#senses summary')?.textContent || '',
        playerBeforeE: p0,
        playerAfterE: pAfterE,
        manualEnergyGainFromPressingE: Number((pAfterE.energy - p0.energy).toFixed(4)),
        actButtonText: actBefore,
        actButtonDisabled: actDisabledBefore,
        nearestCloverPatch: nearestClover,
        energyThoughtIconGlyph: thoughtsMod.ICON?.energy?.glyph || null,
        hareDietKind: speciesMod.HARE_NEEDS?.diet?.kind || null,
        statusWhileHoldingShiftLock: statusWhileHoldingLock,
        statusSnapshot: document.getElementById('status')?.innerText || '',
      };
    })()`);
    // Align screenshot right after the next 3.0s critical hunger thought-bubble spawn so the meat-drumstick icon is crisp
    await evalJs(`new Promise((resolve) => {
      const start = performance.now();
      const check = () => {
        // Wait ~350 ms after a 3000 ms boundary or resolve within 2.8 s
        if (performance.now() - start > 600) resolve(true);
        else requestAnimationFrame(check);
      };
      requestAnimationFrame(check);
    })`);
    observations.push(hareProbe);
    await snapPng('frame-0.png');

    // =========================================================================
    // FRAME 1: Embodied White-tailed Deer (?play=deer&needs=energy:8,water:45) in midsummer (day=196, hour=12)
    // =========================================================================
    const urlDeer = `${BASE_URL}/?nomenu&noprobe&view=ground&stages=1&play=deer&needs=energy:8,water:45&rec&day=196&hour=12`;
    await send('Page.navigate', { url: urlDeer });
    await waitReady();
    // Wait so we land right in the bright window of the 2nd critical hunger thought bubble (~3.4 s after load)
    await sleep(3350);

    const deerProbe = await evalJs(`(async () => {
      const findMod = (sub) => {
        const entries = performance.getEntriesByType('resource').map((r) => r.name);
        return entries.find((n) => n.includes(sub)) || sub;
      };
      const speciesMod = await import(findMod('/src/core/needs/species/index.ts'));
      const tuningMod = await import(findMod('/src/core/playerTuning.ts'));
      const playablesMod = await import(findMod('/src/render/playables.ts'));
      const speciesCore = await import(findMod('/src/core/species.ts'));

      const p0 = window.__boreal.player();
      const deerPlayable = playablesMod.PLAYABLES.find((x) => x.id === 'deer');
      const registeredNeedsKeys = Object.keys(speciesMod.NEEDS_SPECIES);
      const deerNeedsEntry = speciesMod.NEEDS_SPECIES['deer'] ?? null;
      const effectiveTemplate = speciesMod.NEEDS_SPECIES['deer'] ?? speciesMod.WOLF_NEEDS;

      // Press E to attempt manual browsing/grazing as White-tailed Deer
      const actText = document.getElementById('act')?.textContent || '';
      const actDisabled = Boolean(document.getElementById('act')?.disabled);
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE', key: 'e', bubbles: true }));
      await new Promise((r) => setTimeout(r, 120));
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyE', key: 'e', bubbles: true }));
      await new Promise((r) => setTimeout(r, 150));
      const pAfterE = window.__boreal.player();

      return {
        frame: 1,
        label: 'embodied_white_tailed_deer_wolf_needs_fallback_and_meat_bubble',
        sensesHudTitle: document.querySelector('#senses summary')?.textContent || '',
        registeredNeedsSpecies: registeredNeedsKeys,
        deerNeedsDefined: deerNeedsEntry !== null,
        effectiveTemplateId: effectiveTemplate.id,
        effectiveTemplateMassKg: effectiveTemplate.body.massKg.v,
        effectiveTemplateDietKind: effectiveTemplate.diet.kind,
        effectiveTemplateFmrKjPerDay: effectiveTemplate.body.fmrKjPerDay.v,
        effectiveTemplateWaterMlPerDay: effectiveTemplate.needs.water.turnoverMlPerDay.v,
        effectiveTemplateSightFovDeg: effectiveTemplate.senses.sight.fovDeg.v,
        effectiveWalkSpeedMps: Number((tuningMod.playerSpeed('walk', effectiveTemplate) * deerPlayable.speedScale).toFixed(3)),
        effectiveRunSpeedMps: Number((tuningMod.playerSpeed('run', effectiveTemplate) * deerPlayable.speedScale).toFixed(3)),
        effectiveSprintSpeedMps: Number((tuningMod.playerSpeed('sprint', effectiveTemplate) * deerPlayable.speedScale).toFixed(3)),
        deerPlayableActions: deerPlayable.actions,
        browseHereGrams: speciesCore.BROWSE?.at(p0.x, p0.z)?.units ? Number(speciesCore.BROWSE.at(p0.x, p0.z).units.toFixed(1)) : null,
        actButtonText: actText,
        actButtonDisabled: actDisabled,
        manualEnergyGainFromPressingE: Number((pAfterE.energy - p0.energy).toFixed(4)),
        statusSnapshot: document.getElementById('status')?.innerText || '',
      };
    })()`);
    observations.push(deerProbe);
    await snapPng('frame-1.png');

    // =========================================================================
    // FRAME 2 + RECORDING.WEBM: Turn Autonomous ON while embodied as White-tailed Deer
    // (shows deer running WOLF_NEEDS 'hunt' + WOLF_AGENT autonomousWolfStep while meat bubble pulses!)
    // =========================================================================
    await evalJs(`(async () => {
      const comp = document.createElement('canvas');
      comp.width = 1280;
      comp.height = 720;
      const ctx = comp.getContext('2d');
      const glCanvas = document.querySelector('canvas');
      window.__stopComp = false;
      const drawComp = () => {
        if (!window.__stopComp) {
          ctx.drawImage(glCanvas, 0, 0, 1280, 720);
          const senses = document.getElementById('senses');
          if (senses) {
            ctx.fillStyle = 'rgba(12, 18, 22, 0.80)';
            ctx.fillRect(12, 12, 340, 110);
            ctx.fillStyle = '#e8f0ec';
            ctx.font = '12px sans-serif';
            const sl = (senses.innerText || '').split('\\n').slice(0, 6);
            sl.forEach((ln, idx) => ctx.fillText(ln.slice(0, 52), 20, 30 + idx * 16));
          }
          const st = document.getElementById('status');
          if (st) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.72)';
            ctx.fillRect(12, 646, 1020, 62);
            ctx.fillStyle = '#ffffff';
            ctx.font = '12px sans-serif';
            const lines = (st.innerText || '').split('\\n').slice(0, 3);
            lines.forEach((ln, idx) => ctx.fillText(ln.slice(0, 135), 20, 664 + idx * 17));
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

    // Record 1.2 s in manual starving deer mode, then click #autonomous to engage Autonomous mode on the deer!
    await sleep(1200);
    await evalJs(`(() => {
      const btn = document.getElementById('autonomous');
      if (btn) btn.click();
      return btn?.textContent || '';
    })()`);
    await sleep(2200);

    const obs2 = await evalJs(`(() => {
      const p = window.__boreal.player();
      return {
        frame: 2,
        label: 'embodied_white_tailed_deer_running_autonomous_wolf_agent',
        autonomousButtonText: document.getElementById('autonomous')?.textContent || '',
        playerState: p,
        sensesHudText: document.getElementById('senses')?.innerText || '',
        statusSnapshot: document.getElementById('status')?.innerText || '',
      };
    })()`);
    observations.push(obs2);
    await snapPng('frame-2.png');

    await sleep(1400);
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
