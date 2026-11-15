/**
 * Live browser screen recording + PNG frame sampler + controls/UI/gamepad/haptics runtime telemetry for T-0241:
 * 1. Frame 0: Normal embodied play (debug inspector closed) showing always-on numeric health/reserve readouts in #status
 *    (violating Rule 18 #102 & #118), #data-panel-btn (z-index: 70) colliding over top-left <header>, keyboard W+D
 *    steer+throttle normalization cutting forward turning speed by 29.3%, and per-axis square stick deadzone (20.7 deg snap cross);
 * 2. Frame 1: Third-person lookYaw mouse/stick "orbit" panning camera.lookAt away from fixed camera.position so the embodied
 *    wolf disappears completely outside the frustum at 60 deg, snapping back to 0 deg on pointer release, 1.0 rad/s slow RS look,
 *    and connected W3C Gamepad footer showing "— eat held · — release · ... · Controls: — -> Controls" (pad: [] stranding held prey);
 * 3. Frame 2: Menu -> Controls (src/ui/controls.ts) showing illegible dark-grey #4b5e54 key/pad labels on #0d1712 (2.56:1 WCAG
 *    contrast < 4.5:1), illegible #eee7d2-on-#f6d2b8 clash highlight (1.14:1 contrast), and ungrouped 68-row dump;
 * 4. Frame 3: Gamepad settings (src/ui/gamepadSettings.ts) showing 7/8 Context tabs omitting 'axis' (hiding all 12 axis* actions)
 *    and #data-panel-btn (z-index: 70) bleeding on top of Gamepad settings, Start menu, Photo mode, and Globe views.
 *
 * Uses agy preview port 5265 and tools/bench-lock.mjs, terminating Vite and headless Edge cleanly on exit.
 */
import { spawn, execSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { acquire, track, release } from '../../../tools/bench-lock.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
mkdirSync(__dirname, { recursive: true });

const PORT = 5265;
const BASE_URL = process.env.BOREAL_URL || `http://127.0.0.1:${PORT}`;
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const CDP_PORT = 9375;
const WORK_ROOT = resolve(__dirname, '../../../work-t0241');
const PROFILE = resolve(WORK_ROOT, 'edge-controls-embodied-ui-audit-profile');
const LOCK_NAME = 'agy: T-0241-controls-embodied-ui-audit';

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
        await srv.transformRequest('/src/core/bindings.ts');
        await srv.transformRequest('/src/ui/controls.ts');
        await srv.transformRequest('/src/ui/gamepadSettings.ts');
      `;
      viteProc = spawn(process.execPath, ['--input-type=module', '-e', viteBoot], {
        stdio: 'ignore',
        cwd: resolve(__dirname, '../../..'),
      });
      if (viteProc.pid) track(viteProc.pid);
      let up = false;
      for (let i = 0; i < 60; i++) {
        try {
          const r = await fetch(`${BASE_URL}/src/core/bindings.ts`);
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

    // Inject virtual W3C standard gamepad hook + haptic playEffect spy before boot
    await send('Page.addScriptToEvaluateOnNewDocument', {
      source: `(() => {
        if (performance && performance.setResourceTimingBufferSize) performance.setResourceTimingBufferSize(1500);
        window.__padSpy = { enabled: false, axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })), rumbles: [] };
        const origGetGamepads = navigator.getGamepads ? navigator.getGamepads.bind(navigator) : () => [];
        navigator.getGamepads = function() {
          if (!window.__padSpy.enabled) return origGetGamepads();
          return [{
            id: 'Xbox Wireless Controller (STANDARD GAMEPAD)',
            index: 0,
            connected: true,
            mapping: 'standard',
            timestamp: performance.now(),
            axes: window.__padSpy.axes.slice(),
            buttons: window.__padSpy.buttons.map((b) => ({ pressed: b.pressed, touched: b.touched, value: b.value })),
            vibrationActuator: {
              type: 'dual-rumble',
              playEffect(type, params) {
                window.__padSpy.rumbles.push({ type, ...params, t: performance.now() });
                return Promise.resolve('complete');
              },
            },
          }, null, null, null];
        };
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

    // Boot into summer midday ground view (?nomenu&noprobe&view=ground&stages=0&date=2026-06-21&hour=11.5&rec)
    await send('Page.navigate', { url: `${BASE_URL}/?nomenu&noprobe&view=ground&stages=0&date=2026-06-21&hour=11.5&rec` });
    await waitBoot();
    await sleep(600);

    // Start composite WebM screen recorder (20 fps)
    await evalJs(`(() => {
      const comp = document.createElement('canvas');
      comp.width = 1280; comp.height = 720;
      const ctx = comp.getContext('2d');
      const glCanvas = document.getElementById('world');
      window.__auditStage = 'frame0_embodied_hud_health_bars_and_steer_throttle_drop';
      window.__stopComp = false;
      const drawComp = () => {
        if (!window.__stopComp) {
          ctx.drawImage(glCanvas, 0, 0, 1280, 720);
          const statusTxt = (document.getElementById('status')?.innerText || '').split('\\n')[0] || '';
          const btnVisible = (() => {
            const b = document.getElementById('data-panel-btn');
            if (!b) return false;
            const cs = getComputedStyle(b);
            return cs.display !== 'none' && cs.visibility !== 'hidden' && Number(cs.opacity) > 0;
          })();
          ctx.fillStyle = 'rgba(10, 18, 14, 0.84)';
          ctx.fillRect(14, 14, 780, 58);
          ctx.fillStyle = '#eee7d2';
          ctx.font = '13px monospace';
          ctx.fillText('T-0241 Controls & Embodied UI Audit: ' + window.__auditStage, 24, 36);
          ctx.fillText('HUD[0]=' + statusTxt.slice(0, 72) + ' | dataBtn=' + btnVisible, 24, 56);
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
    // FRAME 0: Embodied HUD numeric health bars (#status), #data-panel-btn overlap,
    // and live W vs W+D forward speed drop (-29.3%) + axial stick deadzone snap cross
    // =========================================================================
    await snapPng('frame-0.png');

    const probe0 = await evalJs(`(async () => {
      const findMod = (sub) => {
        const entries = performance.getEntriesByType('resource').map((r) => r.name);
        return entries.find((n) => n.includes(sub)) || sub;
      };
      const bindMod = await import(findMod('/src/core/bindings.ts'));

      const statusText = document.getElementById('status')?.innerText || '';
      const inspectorHidden = document.getElementById('inspector')?.hidden ?? true;
      const dataBtn = document.getElementById('data-panel-btn');
      const headerEl = document.querySelector('header');
      const dataBtnRect = dataBtn ? dataBtn.getBoundingClientRect().toJSON() : null;
      const headerRect = headerEl ? headerEl.getBoundingClientRect().toJSON() : null;
      const dataBtnZIndex = dataBtn ? Number(getComputedStyle(dataBtn).zIndex || 0) : 0;
      const camPanel = document.getElementById('camera-panel');
      const helpBtn = document.getElementById('help');
      const camPanelRect = camPanel ? camPanel.getBoundingClientRect().toJSON() : null;
      const helpBtnRect = helpBtn ? helpBtn.getBoundingClientRect().toJSON() : null;
      const camPanelOverlapsHelpBtn = Boolean(
        camPanelRect && helpBtnRect &&
        camPanelRect.left < helpBtnRect.right && camPanelRect.right > helpBtnRect.left &&
        camPanelRect.top < helpBtnRect.bottom && camPanelRect.bottom > helpBtnRect.top
      );
      // Test pressing 'c' (bound to Stealth in bindings.ts:39): cameraPanel.ts:25 hijacks 'c' and opens the camera exposure sliders!
      const camBodyBeforeC = camPanel ? camPanel.children[1]?.hidden : true;
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'c', bubbles: true }));
      window.dispatchEvent(new KeyboardEvent('keyup', { key: 'c', bubbles: true }));
      const camBodyAfterStealthKeyC = camPanel ? camPanel.children[1]?.hidden : true;
      if (camBodyBeforeC && !camBodyAfterStealthKeyC) {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'c', bubbles: true }));
        window.dispatchEvent(new KeyboardEvent('keyup', { key: 'c', bubbles: true }));
      }

      // Measure straight forward speed (W held 1.6 s) vs turning forward speed (W+D held 1.6 s) on flat terrain
      if (window.borealPlace) window.borealPlace(0, 0, 0);
      await new Promise((r) => setTimeout(r, 150));
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'w' }));
      await new Promise((r) => setTimeout(r, 1100));
      const p0 = window.__boreal.player();
      const t0 = performance.now();
      await new Promise((r) => setTimeout(r, 500));
      const p1 = window.__boreal.player();
      const t1 = performance.now();
      window.dispatchEvent(new KeyboardEvent('keyup', { key: 'w' }));
      const straightSpeedMps = Math.hypot(p1.x - p0.x, p1.z - p0.z) / ((t1 - t0) / 1000);

      await new Promise((r) => setTimeout(r, 600));
      if (window.borealPlace) window.borealPlace(0, 0, 0);
      await new Promise((r) => setTimeout(r, 150));
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'w' }));
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'd' }));
      await new Promise((r) => setTimeout(r, 1100));
      // Measure arc speed (sum of small 50ms chord steps so path curvature does not bias speed!)
      let turnArcDist = 0;
      let prev = window.__boreal.player();
      const tTurn0 = performance.now();
      for (let i = 0; i < 10; i++) {
        await new Promise((r) => setTimeout(r, 50));
        const cur = window.__boreal.player();
        turnArcDist += Math.hypot(cur.x - prev.x, cur.z - prev.z);
        prev = cur;
      }
      const tTurn1 = performance.now();
      window.dispatchEvent(new KeyboardEvent('keyup', { key: 'w' }));
      window.dispatchEvent(new KeyboardEvent('keyup', { key: 'd' }));
      const turningSpeedMps = turnArcDist / ((tTurn1 - tTurn0) / 1000);

      // Thumbstick axial vs radial deadzone probe at 10 deg off-forward and 45 deg diagonal:
      const rad10 = 10 * Math.PI / 180;
      const v10 = bindMod.atomValues([], { buttons: [], axes: [Math.sin(rad10), -Math.cos(rad10), 0, 0] });
      const rad45 = 45 * Math.PI / 180;
      const v45 = bindMod.atomValues([], { buttons: [], axes: [Math.sin(rad45), -Math.cos(rad45), 0, 0] });

      return {
        inspectorHidden,
        statusText,
        hasNumericHealthReadoutsInEmbodiedPlay: /Stamina\\s+\\d+\\/100.*Energy\\s+\\d+\\/100.*Water\\s+\\d+%.*Rest\\s+\\d+%/.test(statusText),
        dataBtnRect,
        headerRect,
        dataBtnZIndex,
        camPanelRect,
        helpBtnRect,
        camPanelOverlapsHelpBtn,
        stealthKeyCHijacksCameraDrawer: Boolean(camBodyBeforeC === true && camBodyAfterStealthKeyC === false),
        straightSpeedMps: Number(straightSpeedMps.toFixed(4)),
        turningSpeedMps: Number(turningSpeedMps.toFixed(4)),
        turnToStraightSpeedRatio: Number((turningSpeedMps / Math.max(1e-6, straightSpeedMps)).toFixed(4)),
        stickAt10DegSteerRight: Number((v10.get('ls.right') ?? 0).toFixed(4)),
        stickAt10DegMoveForward: Number((v10.get('ls.up') ?? 0).toFixed(4)),
        stickAt45DegSteerRight: Number((v45.get('ls.right') ?? 0).toFixed(4)),
        stickAt45DegMoveForward: Number((v45.get('ls.up') ?? 0).toFixed(4)),
      };
    })()`);
    observations.push({ frame: 0, label: 'embodied_hud_health_bars_data_btn_and_steer_throttle_drop', ...probe0 });

    // =========================================================================
    // FRAME 1: Third-person lookYaw camera pan off-subject (60 deg), snapback on release,
    // 1.0 rad/s slow Right-Stick look, and connected W3C Gamepad missing eatPrey/releasePrey/pause
    // =========================================================================
    await evalJs(`(() => {
      window.__auditStage = 'frame1_camera_pan_off_wolf_and_missing_pad_bindings';
      window.__padSpy.enabled = true;
      if (window.borealPlace) window.borealPlace(-98, -100, -0.35);
      return true;
    })()`);
    await sleep(300);

    // Drag +175 px horizontally -> lookYaw = -175 * 0.006 = -1.05 rad (~60.2 deg)
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 640, y: 360, button: 'left', buttons: 1, clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 815, y: 360, button: 'left', buttons: 1 });
    await sleep(250);
    await snapPng('frame-1.png');

    const probe1Held = await evalJs(`(async () => {
      const findMod = (sub) => {
        const entries = performance.getEntriesByType('resource').map((r) => r.name);
        return entries.find((n) => n.includes(sub)) || sub;
      };
      const threeMod = await import(findMod('three'));
      const mathMod = await import(findMod('/src/render/math.ts'));
      const bindMod = await import(findMod('/src/core/bindings.ts'));
      const p = window.__boreal.player();

      // Reconstruct exact PerspectiveCamera (48 deg vFOV, 16:9) used by main.ts & positionCamera at lookYaw = -1.05 rad
      const cam = new threeMod.PerspectiveCamera(48, 1280 / 720, 0.1, 1000);
      mathMod.positionCamera(cam, p.x, p.z, mathMod.RIDER_HEIGHT, p.yaw, mathMod.DEFAULT_PITCH, -1.05);
      cam.updateProjectionMatrix();
      const wolfTorso = new threeMod.Vector3(p.x, cam.position.y - mathMod.RIDER_HEIGHT + 0.55, p.z);
      const ndcAt60Deg = wolfTorso.clone().project(cam);
      const wolfInFrustumAt60Deg = Math.abs(ndcAt60Deg.x) <= 1 && Math.abs(ndcAt60Deg.y) <= 1 && ndcAt60Deg.z >= -1 && ndcAt60Deg.z <= 1;

      const deviceFooterOnPad = document.getElementById('device')?.textContent || '';
      const d = bindMod.defaults();
      const emptyPadPlayOrAnyActions = bindMod.ACTIONS
        .filter((a) => (a.context === 'play' || a.context === 'any') && d[a.id].pad.length === 0)
        .map((a) => a.id);

      return {
        wolfNdcAt60DegOrbit: { x: Number(ndcAt60Deg.x.toFixed(4)), y: Number(ndcAt60Deg.y.toFixed(4)), z: Number(ndcAt60Deg.z.toFixed(4)) },
        wolfInFrustumAt60Deg,
        deviceFooterOnPad,
        emptyPadPlayOrAnyActions,
      };
    })()`);

    // Release mouse button: main.ts:608 immediately decays lookYaw *= Math.exp(-5 * dt) back to 0!
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 815, y: 360, button: 'left', buttons: 0, clickCount: 1 });
    await sleep(650);
    const probe1AfterRelease = await evalJs(`(() => {
      window.__padSpy.enabled = false;
      return {
        snapbackDecayFactorAfter0_65s: Number(Math.exp(-5 * 0.65).toFixed(4)),
      };
    })()`);
    observations.push({ frame: 1, label: 'camera_pan_off_subject_snapback_and_stranded_pad_prey', ...probe1Held, ...probe1AfterRelease });

    // =========================================================================
    // FRAME 2: Menu -> Controls (ui/controls.ts) illegible #4b5e54 contrast (2.56:1),
    // #eee7d2-on-#f6d2b8 clash contrast (1.14:1), and ungrouped 68-row dump
    // =========================================================================
    const probe2 = await evalJs(`(async () => {
      window.__auditStage = 'frame2_controls_screen_illegible_contrast_and_clash';
      document.getElementById('help')?.click();
      await new Promise((r) => setTimeout(r, 250));

      // Trigger one binding clash (assign 'h' to growl via the UI capture flow so .ctl-row.clash renders naturally!)
      const growlRow = document.querySelector('.ctl-row[data-id="growl"]');
      if (growlRow) {
        growlRow.click();
        await new Promise((r) => setTimeout(r, 60));
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'h', bubbles: true }));
        await new Promise((r) => setTimeout(r, 60));
        window.dispatchEvent(new KeyboardEvent('keyup', { key: 'h', bubbles: true }));
        await new Promise((r) => setTimeout(r, 80));
      }

      const keyCell = document.querySelector('.ctl-row:not(.clash) .k');
      const headEl = document.querySelector('.ctl-head');
      const clashRow = document.querySelector('.ctl-row.clash');
      const clashLabel = clashRow?.querySelector('span');
      const rowCount = document.querySelectorAll('.ctl-list .ctl-row').length;
      const sectionHeaders = document.querySelectorAll('.ctl-list h3, .ctl-list h4, .ctl-list .ctl-section').length;
      const dataBtnOverStartMenu = (() => {
        const b = document.getElementById('data-panel-btn');
        const m = document.getElementById('start-menu');
        return {
          dataBtnZ: b ? Number(getComputedStyle(b).zIndex || 0) : 0,
          startMenuZ: m ? Number(getComputedStyle(m).zIndex || 0) : 0,
          dataBtnDisplay: b ? getComputedStyle(b).display : 'none',
        };
      })();

      return {
        rowCount,
        sectionHeaders,
        keyCellColor: keyCell ? getComputedStyle(keyCell).color : null,
        panelBgColor: headEl ? getComputedStyle(headEl).backgroundColor : null,
        clashBgColor: clashRow ? getComputedStyle(clashRow).backgroundColor : null,
        clashTextColor: clashLabel ? getComputedStyle(clashLabel).color : null,
        dataBtnOverStartMenu,
      };
    })()`);
    await sleep(150);
    await snapPng('frame-2.png');

    // Reset bindings to defaults and close Controls menu
    await evalJs(`(() => {
      const resetBtn = [...document.querySelectorAll('.ctl-tools button')].find((b) => b.textContent?.includes('Reset'));
      resetBtn?.click();
      document.getElementById('pause')?.click();
      return true;
    })()`);
    await sleep(200);
    observations.push({ frame: 2, label: 'controls_screen_illegible_contrast_and_clash_row', ...probe2 });

    // =========================================================================
    // FRAME 3: Gamepad settings (ui/gamepadSettings.ts) missing 'axis' context tab (12 actions hidden),
    // #data-panel-btn leaking over Photo mode / Globe / Gamepad settings, & haptics/dial detent probe
    // =========================================================================
    const probe3 = await evalJs(`(async () => {
      window.__auditStage = 'frame3_gamepad_settings_missing_axis_and_haptics_detent';
      const findMod = (sub) => {
        const entries = performance.getEntriesByType('resource').map((r) => r.name);
        return entries.find((n) => n.includes(sub)) || sub;
      };
      const gpsMod = await import(findMod('/src/ui/gamepadSettings.ts'));
      const bindMod = await import(findMod('/src/core/bindings.ts'));
      const hapMod = await import(findMod('/src/ui/haptics.ts'));
      const clockMod = await import(findMod('/src/core/worldClock.ts'));

      // Check Photo mode #data-panel-btn leak first:
      document.getElementById('photo-btn')?.click();
      await new Promise((r) => setTimeout(r, 150));
      const dataBtnDisplayInPhotoMode = getComputedStyle(document.getElementById('data-panel-btn')).display;
      const statusDisplayInPhotoMode = getComputedStyle(document.getElementById('status')).display;
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      window.dispatchEvent(new KeyboardEvent('keyup', { key: 'Escape' }));
      await new Promise((r) => setTimeout(r, 150));

      // Probe W3C GamepadHapticActuator unclamped strongMagnitude (> 1.0) & #109 nudgeDial +-1x detent silence:
      window.__padSpy.enabled = true;
      window.__padSpy.rumbles.length = 0;
      hapMod.haptic('land', 0, 1.85); // scale > 1.67 pushes strong = 0.6 * 1.85 = 1.11 > 1.0!
      const landRumble = window.__padSpy.rumbles[window.__padSpy.rumbles.length - 1] || null;

      window.__padSpy.rumbles.length = 0;
      clockMod.setClockRate(0);
      clockMod.nudgeDial(0.05); // crosses +1x lip (DIAL_DEADZONE = 0.01) and stops on +1x detent!
      const rumblesOnRealtimeDetentCross = window.__padSpy.rumbles.length;
      clockMod.setClockRate(1);
      window.__padSpy.enabled = false;

      // Mount Gamepad settings dialog so Frame 3 shows the 7 tabs (missing 'axis') + #data-panel-btn (z-index 70 > 60) on top!
      window.__gpsClose = gpsMod.mountGamepadSettings(document.body);
      await new Promise((r) => setTimeout(r, 250));
      const tabLabels = [...document.querySelectorAll('.gps .tabs .tab')].map((el) => el.textContent);
      const axisActionsCount = bindMod.actionsIn('axis').length;
      const gpsZIndex = Number(getComputedStyle(document.querySelector('.gps')).zIndex || 0);
      const dataBtnZIndex = Number(getComputedStyle(document.getElementById('data-panel-btn')).zIndex || 0);

      return {
        tabLabels,
        axisTabPresent: tabLabels.some((t) => /axis/i.test(t || '')),
        axisActionsHiddenCount: axisActionsCount,
        dataBtnDisplayInPhotoMode,
        statusDisplayInPhotoMode,
        gpsZIndex,
        dataBtnZIndex,
        landRumbleStrongMagnitude: landRumble ? Number(landRumble.strongMagnitude.toFixed(4)) : null,
        rumblesOnRealtimeDetentCross,
      };
    })()`);
    await sleep(200);
    await snapPng('frame-3.png');
    observations.push({ frame: 3, label: 'gamepad_settings_missing_axis_context_and_haptics_detent', ...probe3 });

    await sleep(250);
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
