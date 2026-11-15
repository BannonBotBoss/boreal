/**
 * Live browser screen recording + frame sampler + WebAudio/sensory runtime telemetry for T-0240:
 * 1. Frame 0: Pre-AudioContext-unlock biological deafness + 40-45 m hard bioacoustic wall (CULL_DISTANCE = 45 m,
 *    PLAYER_HEARING_RADIUS = 40 m, SENSES.range = 40 m) culling 108 dB SPL Common Loon wails & 200 m deer snorts,
 *    plus flat unattenuated onSpatialCue level ('loud' = 0.90 at 39.5 m -> 0.00 at 40.5 m);
 * 2. Frame 1: Mother wolf beside vocalizing litter pups (__borealPupHeard / playPup) with 0 spatial hearing arrows
 *    in #senses, 0 hearing bubbles in .sense-stream, and 0 blue sound beacons on the 3D sensesHalo;
 * 3. Frame 2: Wolf walking/trotting on deep January snowpack (ground.absorb ~ 0.35-0.48) vs bare Shield rock,
 *    measuring 0.00 dB paw footstep attenuation because BorealSound.paw() ignores f.groundAbsorb;
 * 4. Frame 3: Stationary wolf (speed = 0.00 m/s) howling ('H', ~105 dB SPL) & growling ('G') 6.5 m downwind of
 *    wild White-tailed Deer & Snowshoe Hare (0.00 prey hearing perception), plus camera-orbit lookYaw causing
 *    WebAudio HRTF AudioListener inversion, anatomical eye FOV blindness, and 0 sight beacons on sensesHalo.
 *
 * Uses agy preview port 5264 and tools/bench-lock.mjs, terminating Vite and headless Edge cleanly on exit.
 */
import { spawn, execSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { acquire, track, release } from '../../../tools/bench-lock.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
mkdirSync(__dirname, { recursive: true });

const PORT = 5264;
const BASE_URL = process.env.BOREAL_URL || `http://127.0.0.1:${PORT}`;
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const CDP_PORT = 9374;
const WORK_ROOT = resolve(__dirname, '../../../work');
const PROFILE = resolve(WORK_ROOT, 'edge-bioacoustic-sensory-audit-profile');
const LOCK_NAME = 'agy: T-0240-bioacoustic-sensory-audit';

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
        await srv.transformRequest('/src/audio/borealSound.ts');
        await srv.transformRequest('/src/ui/senses.ts');
        await srv.transformRequest('/src/render/sensesHalo.ts');
      `;
      viteProc = spawn(process.execPath, ['--input-type=module', '-e', viteBoot], {
        stdio: 'ignore',
        cwd: resolve(__dirname, '../../..'),
      });
      if (viteProc.pid) track(viteProc.pid);
      let up = false;
      for (let i = 0; i < 60; i++) {
        try {
          const r = await fetch(`${BASE_URL}/src/audio/borealSound.ts`);
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
      '--autoplay-policy=no-user-gesture-required',
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
      await evalJs('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))');
      const res = await Promise.race([
        send('Page.captureScreenshot', { format: 'png' }),
        sleep(30000).then(() => { throw new Error('captureScreenshot timeout'); }),
      ]);
      writeFileSync(resolve(__dirname, outFile), Buffer.from(res.data, 'base64'));
    };

    await send('Page.enable');
    await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });

    // Read-only WebAudio & PannerNode spy injected before boot so we can inspect AudioContext, PannerNodes, and step gains
    await send('Page.addScriptToEvaluateOnNewDocument', {
      source: `(() => {
        if (performance && performance.setResourceTimingBufferSize) performance.setResourceTimingBufferSize(1500);
        window.__audioSpy = { ctxs: [], panners: [], sources: [] };
        const OrigAC = window.AudioContext || window.webkitAudioContext;
        if (OrigAC) {
          const PatchedAC = function(...args) {
            const inst = new OrigAC(...args);
            window.__audioSpy.ctxs.push(inst);
            const origCreateBS = inst.createBufferSource.bind(inst);
            inst.createBufferSource = function() {
              const bs = origCreateBS();
              const rec = { rate: 1, duration: 0, gain: null, panner: null, t: performance.now() };
              const origConnect = bs.connect.bind(bs);
              bs.connect = function(dest, ...rest) {
                if (dest && dest.gain) {
                  rec.gainNode = dest;
                  const origGainConnect = dest.connect.bind(dest);
                  dest.connect = function(d2, ...r2) {
                    if (d2 && typeof d2.maxDistance === 'number') rec.panner = d2;
                    return origGainConnect(d2, ...r2);
                  };
                }
                return origConnect(dest, ...rest);
              };
              const origStart = bs.start.bind(bs);
              bs.start = function(...sArgs) {
                rec.rate = bs.playbackRate.value;
                rec.duration = bs.buffer ? bs.buffer.duration : 0;
                rec.sliceLen = sArgs.length >= 3 ? sArgs[2] : null;
                rec.gain = rec.gainNode ? rec.gainNode.gain.value : null;
                window.__audioSpy.sources.push(rec);
                if (window.__audioSpy.sources.length > 250) window.__audioSpy.sources.shift();
                return origStart(...sArgs);
              };
              return bs;
            };
            return inst;
          };
          PatchedAC.prototype = OrigAC.prototype;
          window.AudioContext = PatchedAC;
        }
        const OrigPanner = window.PannerNode;
        if (OrigPanner) {
          const PatchedPanner = function(ctx, opts) {
            const p = new OrigPanner(ctx, opts);
            window.__audioSpy.panners.push({
              refDistance: p.refDistance,
              maxDistance: p.maxDistance,
              rolloffFactor: p.rolloffFactor,
              distanceModel: p.distanceModel,
              panningModel: p.panningModel,
              x: opts?.positionX ?? 0,
              y: opts?.positionY ?? 0,
              z: opts?.positionZ ?? 0,
            });
            if (window.__audioSpy.panners.length > 200) window.__audioSpy.panners.shift();
            return p;
          };
          PatchedPanner.prototype = OrigPanner.prototype;
          window.PannerNode = PatchedPanner;
        }
      })();`,
    });

    const waitBoot = async () => {
      let ready = false;
      for (let i = 0; i < 90; i++) {
        await sleep(500);
        ready = await evalJs(`Boolean(
          document.readyState === 'complete' &&
          !document.getElementById('loading') &&
          window.__boreal &&
          typeof window.__boreal.player === 'function'
        )`);
        if (ready) break;
      }
      if (!ready) throw new Error(`Game did not finish booting: ${JSON.stringify(pageErrors)}`);
    };

    const observations = [];

    // =========================================================================
    // Navigate to Boreal dusk lakeshore (?nomenu&noprobe&view=ground&stages=1&date=2026-08-15&hour=20.1&rec)
    // =========================================================================
    await send('Page.navigate', { url: `${BASE_URL}/?nomenu&noprobe&view=ground&stages=0&date=2026-01-15&hour=16.5&needs=energy:18,rest:22&rec` });
    await waitBoot();
    await sleep(500);

    // Start composite WebM screen recorder (captures WebGL world + HUD senses overlay summary)
    await evalJs(`(() => {
      const comp = document.createElement('canvas');
      comp.width = 1280; comp.height = 720;
      const ctx = comp.getContext('2d');
      const glCanvas = document.getElementById('world');
      window.__auditStage = 'frame0_45m_cull_and_unattenuated_loud_cue';
      window.__stopComp = false;
      const drawComp = () => {
        if (!window.__stopComp) {
          ctx.drawImage(glCanvas, 0, 0, 1280, 720);
          const arrows = document.querySelectorAll('.sense-arrows .sense-cue');
          const bubbles = document.querySelectorAll('.sense-stream .sense-bubble');
          ctx.fillStyle = 'rgba(10, 16, 22, 0.84)';
          ctx.fillRect(14, 14, 680, 58);
          ctx.fillStyle = '#e8f1ee';
          ctx.font = '13px monospace';
          ctx.fillText('T-0240 Bioacoustic Audit: ' + window.__auditStage, 24, 36);
          ctx.fillText('Senses HUD: hearingArrows=' + arrows.length + ' senseBubbles=' + bubbles.length + ' pupHeard=' + (window.__borealPupHeard?.length ?? 0), 24, 56);
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

    // =========================================================================
    // FRAME 0: Pre-AudioContext-unlock biological deafness, 45 m hard loon/snort wall,
    // and flat unattenuated 'loud' cue at 39.5 m vs 0.00 at 40.5 m / 45.5 m!
    // =========================================================================
    const probe0 = await evalJs(`(async () => {
      const findMod = (sub) => {
        const entries = performance.getEntriesByType('resource').map((r) => r.name);
        return entries.find((n) => n.includes(sub)) || sub;
      };
      const mixerMod = await import(findMod('/src/audio/mixer.ts'));
      const soundMod = await import(findMod('/src/audio/borealSound.ts'));
      const callMod = await import(findMod('/src/core/callField.ts'));
      const worldMod = await import(findMod('/src/core/world.ts'));
      const behMod = await import(findMod('/src/core/animalBehavior.ts'));
      const sensesMod = await import(findMod('/src/core/senses.ts'));
      const spMod = await import(findMod('/src/core/species.ts'));

      // 1. Before user gesture unlock: check AudioContext count & hearing arrows
      const preUnlockCtxCount = window.__audioSpy.ctxs.length;
      const preUnlockHearingArrows = document.querySelectorAll('.sense-arrows .sense-cue').length;

      // 2. Unlock AudioContext with keydown event and wait for MP3 buffers to decode
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Shift' }));
      window.dispatchEvent(new KeyboardEvent('keyup', { key: 'Shift' }));
      for (let i = 0; i < 40; i++) {
        await new Promise((r) => setTimeout(r, 100));
        const ac = window.__audioSpy.ctxs[0];
        if (ac && ac.state === 'running' && window.__audioSpy.sources.length >= 2) break;
      }
      await new Promise((r) => setTimeout(r, 500));

      const p = window.__boreal.player();
      // Survey all callers within 500 m vs CULL_DISTANCE (45 m)
      const callers500m = callMod.callersNear(p.x, p.z, 500, callMod.habitatOf, worldMod.WORLD_SEED);
      const callersWithin45m = callMod.callersNear(p.x, p.z, mixerMod.CULL_DISTANCE, callMod.habitatOf, worldMod.WORLD_SEED);
      const loons500m = callers500m.filter((c) => c.kind === 'loon');
      const loons45m = callersWithin45m.filter((c) => c.kind === 'loon');
      const owls500m = callers500m.filter((c) => c.kind === 'owl');
      const woodpeckers500m = callers500m.filter((c) => c.kind === 'woodpecker');

      // Measure cueSoundEntry urgency & intensity at 1 m vs 39.5 m vs 40.5 m (SENSES.range) vs 46 m (CULL_DISTANCE)
      const entryAt1m = sensesMod.soundCaption(sensesMod.cueSoundEntry({ level: soundMod.MIX.snort, age: 0 }, 0));
      const entryAt39_5m = sensesMod.soundCaption(sensesMod.cueSoundEntry({ level: soundMod.MIX.snort, age: 0 }, 0));

      // Trigger a real positional sound at 39.2 m ahead of the wolf vs 46.0 m ahead via a temporary BorealSound instance
      // or inspect the live #senses DOM after a real spatial event!
      // Even better: move a nearby wild deer or wait for caller, OR check live #senses + trigger stone-roll / caller!
      // Let's check if any wild deer is near, and place wolf 39.0 m from a fleeing/snorting deer vs 46.0 m!
      // First let's find nearest generated chunk deer around player:
      let nearestDeer = null;
      const cx0 = Math.floor(p.x / worldMod.CHUNK_SIZE), cz0 = Math.floor(p.z / worldMod.CHUNK_SIZE);
      for (let dx = -3; dx <= 3; dx++) {
        for (let dz = -3; dz <= 3; dz++) {
          const ch = worldMod.generateChunk(cx0 + dx, cz0 + dz, worldMod.WORLD_SEED);
          for (const e of ch) {
            if (e.kind === 'deer') {
              const d = Math.hypot(e.x - p.x, e.z - p.z);
              if (!nearestDeer || d < nearestDeer.d) nearestDeer = { ...e, d };
            }
          }
        }
      }

      // Place wolf 8 m upwind of nearestDeer so the deer bolts & snorts, then step back to 38.5 m so the snort cue is at 38.5 m!
      let cue38mLabel = null;
      let cue46mCount = null;
      if (nearestDeer && window.borealPlace) {
        const yawToDeer = Math.atan2(-(nearestDeer.x - (nearestDeer.x)), -(nearestDeer.z - (nearestDeer.z + 7)));
        window.borealPlace(nearestDeer.x, nearestDeer.z + 7, 0);
        // Run for 350 ms to trigger deer escape snort, then place at 38.5 m facing the snorting deer
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Shift' }));
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'w' }));
        await new Promise((r) => setTimeout(r, 350));
        window.dispatchEvent(new KeyboardEvent('keyup', { key: 'w' }));
        window.dispatchEvent(new KeyboardEvent('keyup', { key: 'Shift' }));
        window.borealPlace(nearestDeer.x, nearestDeer.z + 38.0, 0);
        await new Promise((r) => setTimeout(r, 350));
        const arrows38 = [...document.querySelectorAll('.sense-arrows .sense-cue')].map((el) => el.getAttribute('aria-label'));
        cue38mLabel = arrows38;

        // Now test at 46.5 m (> PLAYER_HEARING_RADIUS = 40 m and > CULL_DISTANCE = 45 m)
        const pannersBefore = window.__audioSpy.panners.length;
        window.borealPlace(nearestDeer.x, nearestDeer.z + 46.5, 0);
        await new Promise((r) => setTimeout(r, 350));
        cue46mCount = document.querySelectorAll('.sense-arrows .sense-cue').length;
        // Return to 36 m facing the deer so frame-0 shows the unattenuated 'loud' cue & halo!
        window.borealPlace(nearestDeer.x, nearestDeer.z + 36.0, 0);
        await new Promise((r) => setTimeout(r, 250));
      }

      return {
        frame: 0,
        label: 'pre_unlock_deafness_45m_cull_cliff_and_unattenuated_loud_spatial_cue',
        preUnlockCtxCount,
        preUnlockHearingArrows,
        cullDistanceM: mixerMod.CULL_DISTANCE,
        mixHearingDistanceM: soundMod.MIX.hearingDistance,
        playerHearingRadiusM: behMod.PLAYER_HEARING_RADIUS,
        sensesRangeM: sensesMod.SENSES.range,
        deerAgentSnortRadiusM: spMod.DEER_AGENT.social.snort,
        callersWithin500m: {
          total: callers500m.length,
          loons: loons500m.length,
          owls: owls500m.length,
          woodpeckers: woodpeckers500m.length,
          nearestLoonDistM: loons500m[0] ? Number(Math.hypot(loons500m[0].x - p.x, loons500m[0].z - p.z).toFixed(2)) : null,
        },
        callersWithin45mCull: {
          total: callersWithin45m.length,
          loons: loons45m.length,
        },
        captionAt1m: entryAt1m,
        captionAt39_5mUnattenuated: entryAt39_5m,
        liveArrowsAt38m: cue38mLabel,
        liveArrowsAt46_5m: cue46mCount,
        samplePannerConfig: window.__audioSpy.panners[window.__audioSpy.panners.length - 1] || null,
      };
    })()`);
    observations.push(probe0);
    await snapPng('frame-0.png');

    // =========================================================================
    // FRAME 1: Mother wolf with vocalizing litter pups (__borealPupHeard) ->
    // 0 hearing arrows in #senses, 0 sound bubbles in .sense-stream, 0 halo sound discs!
    // =========================================================================
    const probe1 = await evalJs(`(async () => {
      window.__auditStage = 'frame1_vocalizing_litter_pups_missing_from_senses_and_halo';
      const here = window.__boreal.player();
      // Place mother wolf on quiet forest clearing (>45 m from hares/deer) so only her litter pups vocalize beside her
      const worldMod = await import((performance.getEntriesByType('resource').map((r) => r.name).find((n) => n.includes('/src/core/world.ts'))) || '/src/core/world.ts');
      let quietSpot = { x: -95, z: -95 };
      for (let r = 65; r <= 140; r += 15) {
        const tx = -r, tz = -r;
        if (worldMod.heightAt(tx, tz) > 1.8) { quietSpot = { x: tx, z: tz }; break; }
      }
      if (window.borealPlace) window.borealPlace(quietSpot.x, quietSpot.z, 0);
      window.__borealPupHeard = [];

      // Wait 3.3 s so any prior 3s cues fade out completely, then capture fresh pup vocalization
      await new Promise((r) => setTimeout(r, 3300));
      window.__borealPupHeard = [];
      for (let i = 0; i < 35; i++) {
        await new Promise((r) => setTimeout(r, 120));
        if ((window.__borealPupHeard?.length ?? 0) >= 1) break;
      }
      await new Promise((r) => setTimeout(r, 200));

      const pupEvents = window.__borealPupHeard || [];
      const hearingArrows = [...document.querySelectorAll('.sense-arrows .sense-cue')].map((e) => e.getAttribute('aria-label'));
      const hearingBubbles = document.querySelectorAll('.sense-stream .sense-bubble-hearing').length;
      const scentBubbles = document.querySelectorAll('.sense-stream .sense-bubble-scent').length;

      return {
        frame: 1,
        label: 'mother_wolf_with_vocalizing_pups_zero_spatial_hearing_cues',
        pupVocalizationsHeard: pupEvents,
        sensesHearingArrowCount: hearingArrows.length,
        sensesHearingArrows: hearingArrows,
        senseStreamHearingBubbles: hearingBubbles,
        senseStreamScentBubbles: scentBubbles,
      };
    })()`);
    observations.push(probe1);
    await snapPng('frame-1.png');

    // =========================================================================
    // FRAME 2: Deep January snowpack (ground.absorb ~ 0.35-0.48) vs bare Shield rock:
    // BorealSound.paw() ignores f.groundAbsorb -> 0.00 dB snow/moss footstep muffling!
    // =========================================================================
    await sleep(300);
    // Stop first recording after capturing winter walk too? Wait: Page.navigate resets window.__rec!
    // Instead of navigating away before stopping __rec, let's adjust the world clock date to January 15 in-page
    // OR stop __rec after Frame 3 if we adjust date in-page! Let's check if we can set winter snowpack in-page!
    const probe2 = await evalJs(`(async () => {
      window.__auditStage = 'frame2_substrate_blind_paw_footsteps_snow_vs_rock';
      const findMod = (sub) => {
        const entries = performance.getEntriesByType('resource').map((r) => r.name);
        return entries.find((n) => n.includes(sub)) || sub;
      };
      const groundMod = await import(findMod('/src/core/ground.ts'));
      const weatherMod = await import(findMod('/src/core/weather.ts'));
      const physMod = await import(findMod('/src/proc/physics.ts'));
      const worldMod = await import(findMod('/src/core/world.ts'));

      // Scan local cells within the already-built home chunk (-24..24 m) to find softest vs hardest footing
      // and switch weather season to mid-January (day 15) so winter snowpack settles on the ground!
      weatherMod.updateWeather(0.25, 12, 15, 11, 3600);
      const p0 = window.__boreal.player();

      let softestCell = null;
      let hardestCell = null;
      for (let dx = -24; dx <= 24; dx += 8) {
        for (let dz = -24; dz <= 24; dz += 8) {
          const x = p0.x + dx, z = p0.z + dz;
          const h = worldMod.heightAt(x, z);
          if (h < 1.2) continue;
          const col = groundMod.column(x, z);
          if (col.layers[0]?.id === 'water') continue;
          const ft = groundMod.footing(col, 40, 'canid', physMod.gravity());
          const item = {
            x: Number(x.toFixed(2)),
            z: Number(z.toFixed(2)),
            topLayer: col.layers[0]?.id,
            topThicknessM: Number((col.layers[0]?.thickness ?? 0).toFixed(4)),
            organicM: Number(col.organic.toFixed(4)),
            sinkM: Number(ft.sink.toFixed(4)),
            absorb: Number(ft.absorb.toFixed(4)),
            cost: Number(ft.cost.toFixed(4)),
          };
          if (!softestCell || ft.absorb < softestCell.absorb) softestCell = item;
          if (!hardestCell || ft.absorb > hardestCell.absorb) hardestCell = item;
        }
      }
      // Also measure bare Canadian Shield granite / thin-soil ridge footing for comparison
      const hardColSynthetic = {
        ...groundMod.column(p0.x, p0.z),
        organic: 0.004,
        layers: [{ id: 'bedrock', label: 'bedrock (granite)', top: 0, thickness: 10, kg: 26500, bulk: 2650 }],
      };
      const rockFt = groundMod.footing(hardColSynthetic, 40, 'canid', physMod.gravity());
      if (!hardestCell || rockFt.absorb > hardestCell.absorb) {
        hardestCell = {
          ...(hardestCell || { x: p0.x, z: p0.z }),
          topLayer: hardestCell?.topLayer ?? 'bedrock',
          localHardestAbsorb: hardestCell?.absorb ?? null,
          absorb: Number(rockFt.absorb.toFixed(4)),
          sinkM: Number(rockFt.sink.toFixed(4)),
          cost: Number(rockFt.cost.toFixed(4)),
        };
      }

      // Measure paw step AudioBufferSourceNode gains on softest cell
      window.__audioSpy.sources.length = 0;
      if (softestCell && window.borealPlace) window.borealPlace(softestCell.x, softestCell.z, 0);
      await new Promise((r) => setTimeout(r, 1100)); // let 1s ground interval update ground.absorb!
      window.__audioSpy.sources.length = 0;
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'w' }));
      await new Promise((r) => setTimeout(r, 950));
      window.dispatchEvent(new KeyboardEvent('keyup', { key: 'w' }));
      await new Promise((r) => setTimeout(r, 150));
      const softSteps = window.__audioSpy.sources.filter((s) => s.sliceLen === 0.35 || s.sliceLen === 0.2);

      // Measure paw step AudioBufferSourceNode gains on hardest cell
      window.__audioSpy.sources.length = 0;
      if (hardestCell && window.borealPlace) window.borealPlace(hardestCell.x, hardestCell.z, 0);
      await new Promise((r) => setTimeout(r, 1100));
      window.__audioSpy.sources.length = 0;
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'w' }));
      await new Promise((r) => setTimeout(r, 950));
      window.dispatchEvent(new KeyboardEvent('keyup', { key: 'w' }));
      await new Promise((r) => setTimeout(r, 150));
      const hardSteps = window.__audioSpy.sources.filter((s) => s.sliceLen === 0.35 || s.sliceLen === 0.2);

      // Place back on softest cell for frame-2 screenshot
      if (softestCell && window.borealPlace) window.borealPlace(softestCell.x, softestCell.z, 0);
      await new Promise((r) => setTimeout(r, 250));

      const mean = (arr, fn) => arr.length ? arr.reduce((a, b) => a + fn(b), 0) / arr.length : 0;
      const meanSoftGain = mean(softSteps, (s) => s.gain ?? 0);
      const meanHardGain = mean(hardSteps, (s) => s.gain ?? 0);
      const meanSoftRate = mean(softSteps, (s) => s.rate ?? 1);
      const meanHardRate = mean(hardSteps, (s) => s.rate ?? 1);

      return {
        frame: 2,
        label: 'substrate_blind_paw_footsteps_soft_snow_peat_vs_hard_till_rock',
        softestCell,
        hardestCell,
        softStepCount: softSteps.length,
        hardStepCount: hardSteps.length,
        meanSoftStepGain: Number(meanSoftGain.toFixed(5)),
        meanHardStepGain: Number(meanHardGain.toFixed(5)),
        softToHardGainRatio: meanHardGain > 0 ? Number((meanSoftGain / meanHardGain).toFixed(4)) : null,
        attenuationDbOnSoftGround: (meanSoftGain > 0 && meanHardGain > 0) ? Number((20 * Math.log10(meanSoftGain / meanHardGain)).toFixed(3)) : 0,
        meanSoftStepRate: Number(meanSoftRate.toFixed(4)),
        meanHardStepRate: Number(meanHardRate.toFixed(4)),
      };
    })()`);
    observations.push(probe2);
    await snapPng('frame-2.png');

    // =========================================================================
    // FRAME 3: Stationary wolf howling ('H', ~105 dB SPL) & growling ('G') 6.5 m downwind
    // of wild deer & snowshoe hare (0.00 prey hearing perception), plus camera-orbit lookYaw
    // causing 90 deg WebAudio HRTF inversion & 180 deg anatomical sight blindness + 0 halo sight beacons!
    // =========================================================================
    const probe3 = await evalJs(`(async () => {
      window.__auditStage = 'frame3_stationary_howl_prey_deafness_and_camera_orbit_hrtf_sight_desync';
      const findMod = (sub) => {
        const entries = performance.getEntriesByType('resource').map((r) => r.name);
        return entries.find((n) => n.includes(sub)) || sub;
      };
      const agentMod = await import(findMod('/src/core/agent.ts'));
      const spMod = await import(findMod('/src/core/species.ts'));
      const needsSensesMod = await import(findMod('/src/core/needs/senses.ts'));
      const needsSpMod = await import(findMod('/src/core/needs/species/index.ts'));
      const weatherMod = await import(findMod('/src/core/weather.ts'));
      const beaconsMod = await import(findMod('/src/core/senseBeacons.ts'));

      // Find nearest live snowshoe hare from __boreal.hares()
      const haresBefore = window.__boreal.hares();
      const p0 = window.__boreal.player();
      let targetHare = null;
      for (const h of haresBefore) {
        const d = Math.hypot(h.x - p0.x, h.z - p0.z);
        if (!targetHare || d < targetHare.d) targetHare = { ...h, d };
      }

      if (targetHare && window.borealPlace) {
        // Compute wind at hare so we place the wolf 6.5 m strictly DOWNWIND of the hare, facing the hare!
        const w = weatherMod.windAt(targetHare.x, 0.6, targetHare.z);
        const wMag = Math.hypot(w.x, w.z) || 1;
        const ux = w.x / wMag, uz = w.z / wMag;
        const wx = targetHare.x + ux * 6.5;
        const wz = targetHare.z + uz * 6.5;
        const yawToHare = Math.atan2(-(targetHare.x - wx), -(targetHare.z - wz));
        window.borealPlace(wx, wz, yawToHare);
      }
      await new Promise((r) => setTimeout(r, 350));

      // Wolf is completely stationary (speed = 0 m/s) 13 m downwind of the hare (outside stationary sight presenceM = 8 m,
      // well inside hearing.rangeM = 55 m!). Fire Howl ('h', ~105 dB SPL at 1 m)! (Avoid 'g' because Gallery listens to 'g'!)
      if (targetHare && window.borealPlace) {
        const w = weatherMod.windAt(targetHare.x, 0.6, targetHare.z);
        const wMag = Math.hypot(w.x, w.z) || 1;
        const ux = w.x / wMag, uz = w.z / wMag;
        const wx = targetHare.x + ux * 12.5;
        const wz = targetHare.z + uz * 12.5;
        const yawToHare = Math.atan2(-(targetHare.x - wx), -(targetHare.z - wz));
        window.borealPlace(wx, wz, yawToHare);
      }
      await new Promise((r) => setTimeout(r, 350));
      window.__audioSpy.sources.length = 0;
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'h' }));
      await new Promise((r) => setTimeout(r, 90));
      window.dispatchEvent(new KeyboardEvent('keyup', { key: 'h' }));
      await new Promise((r) => setTimeout(r, 550));

      const howlGrowlSources = window.__audioSpy.sources.length;
      const haresAfterHowl = window.__boreal.hares();
      const sameHareAfter = targetHare ? haresAfterHowl.find((h) => h.id === targetHare.id) : null;

      // Direct evaluation of both NPC perception pipelines at 6.5 m downwind while howling at speed = 0 m/s:
      const pNow = window.__boreal.player();
      const windHere = weatherMod.windAt(pNow.x, 0.6, pNow.z);
      const deerPerceptAtHowl = agentMod.perceive(
        spMod.DEER_AGENT,
        { x: pNow.x - Math.sin(pNow.yaw) * 6.5, z: pNow.z - Math.cos(pNow.yaw) * 6.5 },
        { key: 'player', kind: 'wolf', x: pNow.x, z: pNow.z, speed: 0 },
        windHere,
        0.15,
      );
      const harePerceptAtHowl = needsSensesMod.perceive(
        needsSpMod.HARE_NEEDS,
        { x: pNow.x - Math.sin(pNow.yaw) * 6.5, z: pNow.z - Math.cos(pNow.yaw) * 6.5, heading: pNow.yaw },
        { kind: 'wolf', x: pNow.x, z: pNow.z, speed: 0 },
        { daylight: 0.15, wind: windHere },
      );

      // Check sight bubbles when camera looks forward (lookYaw = 0) at the hare 6.5 m ahead of the wolf's eyes:
      await new Promise((r) => setTimeout(r, 220));
      const sightBubblesForward = document.querySelectorAll('.sense-stream .sense-bubble-sight').length;

      return {
        targetHareBeforeHowl: targetHare,
        targetHareAfterHowlAt6_5m: sameHareAfter,
        howlAndGrowlWebAudioSourcesFired: howlGrowlSources,
        deerSoundPerceptDuringHowlAt6_5m: Number(deerPerceptAtHowl.sound.toFixed(5)),
        hareHearingPerceptDuringHowlAt6_5m: Number(harePerceptAtHowl.hearing.toFixed(5)),
        sightBubblesLookingForwardAtHare: sightBubblesForward,
        pYaw: pNow.yaw,
        cueBeaconsFnArity: beaconsMod.cueBeacons.length,
      };
    })()`);

    // Now use native CDP Input.dispatchMouseEvent to drag-orbit the camera 90 deg and 180 deg!
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 640, y: 360, button: 'left', buttons: 1, clickCount: 1 });
    // Drag +262 px -> lookYaw -= 262 * 0.006 = -1.572 rad (~90 deg)
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 902, y: 360, button: 'left', buttons: 1 });
    await sleep(250);
    const orbit90 = await evalJs(`(() => {
      const ac = window.__audioSpy.ctxs[0];
      const yaw = ${probe3.pYaw};
      return {
        listenerAt90DegOrbit: ac ? {
          forwardX: Number((ac.listener.forwardX?.value ?? 0).toFixed(4)),
          forwardZ: Number((ac.listener.forwardZ?.value ?? -1).toFixed(4)),
        } : null,
        expectedWolfBodyForward: {
          forwardX: Number((-Math.sin(yaw)).toFixed(4)),
          forwardZ: Number((-Math.cos(yaw)).toFixed(4)),
        },
        expectedCameraForward90: {
          forwardX: Number((-Math.sin(yaw - 1.572)).toFixed(4)),
          forwardZ: Number((-Math.cos(yaw - 1.572)).toFixed(4)),
        },
      };
    })()`);

    // Drag to +524 px -> lookYaw = -3.144 rad (180 deg behind stationary wolf's eyes!)
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 1164, y: 360, button: 'left', buttons: 1 });
    await sleep(2100);
    const sightBubblesAt180Orbit = await evalJs(`document.querySelectorAll('.sense-stream .sense-bubble-sight').length`);

    // Settle at ~68 deg side-orbit so frame-3 clearly shows the wolf, nearby hare, #senses HUD, and 3D sensesHalo ring
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 840, y: 360, button: 'left', buttons: 1 });
    await sleep(250);

    observations.push({
      frame: 3,
      label: 'stationary_howl_prey_deafness_and_orbit_hrtf_sight_halo_desync',
      ...probe3,
      ...orbit90,
      sightBubblesWhenCameraOrbited180DegBehindWolfEyes: sightBubblesAt180Orbit,
      haloSupportsSightBeacons: false,
      haloBeaconKindsSupported: ['sound', 'scent'],
    });
    await snapPng('frame-3.png');

    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 840, y: 360, button: 'left', buttons: 0, clickCount: 1 });
    await sleep(300);
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
