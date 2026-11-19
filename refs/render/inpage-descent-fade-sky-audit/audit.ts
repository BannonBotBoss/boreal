/**
 * Live & calibrated Rule 11 audit of the in-page globe-to-forest descent,
 * patch fade, far-layer exposure, drone fog/sky state restoration & landing handoff:
 *  1. inpage.ts:475 & 228-234 unrestored physicalSky.scale = 1e5 after embodying from drone
 *     (box faces at +-50,000 m vs ground camera.far = 700..8,000 m -> clipped sky dome)
 *  2. inpage.ts:476 hardcoded daytime blue fog RGB(0.45, 0.62, 0.9) at midnight/dusk (8 < h < 2500 m)
 *     overwriting sky.ts physically computed midnight/twilight fog (0x0d1422, ~85x dimmer)
 *  3. fade.ts:59,67 post-tonemapping & post-colorspace (#include <dithering_fragment>) mix of
 *     raw linear HDR uFarColor * uFarMix.y (up to 5.2x) into already-tonemapped sRGB gl_FragColor
 *  4. droneGrade.ts:14 half-stop math error (DRONE_STOP = 1.5 = +0.585 EV vs sqrt(2) = 1.4142)
 *     + inpage.ts:473-474 uncompensated backgroundIntensity double-exposure surge (+19.2% at 2 km, +50% at 24-1200 m)
 *  5. fade.ts:86 + inpage.ts:237-260 hideForBand uncompiled patchFade deadlock & permanent WeakMap false poisoning
 *  6. forestLanding.ts:74-81 seed-blind landingMemo cache + inpage.ts:412,444 unblended 400 m -> 1.8 m hard snap
 *
 * Usage:
 *   npx tsx refs/render/inpage-descent-fade-sky-audit/audit.ts [baseUrl]
 *
 * Expects Vite dev server on baseUrl (default http://127.0.0.1:5262).
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';
import * as THREE from 'three';
import { chromium } from 'playwright';

import { addPatchFade, fadeOptIn } from '../../../src/render/fade';
import { DRONE_STOP, droneExposureScale } from '../../../src/render/droneGrade';
import { EXPOSURE } from '../../../src/core/light';
import { INPAGE } from '../../../src/world/globe/inpage';
import { TRANSITION, nextMode, handoverBlend } from '../../../src/world/globe/transition';
import { forestLanding } from '../../../src/world/globe/forestLanding';
import { STAGES } from '../../../src/core/stages/elevation';
import { smoothstep } from '../../../src/proc/math';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');
const BASE = process.argv[2] ?? 'http://127.0.0.1:5262';
const BROWSER_PATHS = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
];
const EXECUTABLE = BROWSER_PATHS.find(p => existsSync(p));

interface CheckResult {
  id: string;
  label: string;
  measured: string;
  expected: string;
  score: number;
  knownMatchScore: number;
  knownMismatchScore: number;
  pass: boolean;
  source: string;
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const ratioScore = (a: number, b: number) => {
  if (a <= 0 || b <= 0) return a === b ? 1 : 0;
  return clamp01(Math.min(a, b) / Math.max(a, b));
};

/** ACES Filmic tone mapping (Three.js r180 RRTAndODTFit + matrices approximation via Narkowicz / Hill). */
function acesChannel(x: number): number {
  const a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14;
  return clamp01((x * (a * x + b)) / (x * (c * x + d) + e));
}
function linToSrgb(c: number): number {
  const v = clamp01(c);
  return v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055;
}

/** Decode 8-bit RGB/RGBA PNG into mean RGB of a horizontal band [y0Frac, y1Frac]. */
function pngBandMeanRgb(path: string, y0Frac: number, y1Frac: number): { r: number; g: number; b: number; luma: number; darkFrac: number } {
  const buf = readFileSync(path);
  let pos = 8;
  let width = 0, height = 0, colorType = 6;
  const idat: Buffer[] = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.subarray(pos + 4, pos + 8).toString('ascii');
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      colorType = data[9];
    } else if (type === 'IDAT') {
      idat.push(data);
    }
    pos += 12 + len;
  }
  const bpp = colorType === 6 ? 4 : 3;
  const stride = width * bpp;
  const raw = inflateSync(Buffer.concat(idat));
  const recon = Buffer.alloc(height * stride);
  const paeth = (a: number, b: number, c: number) => {
    const p = a + b - c;
    const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
  };
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const srcOff = y * (stride + 1) + 1;
    const dstOff = y * stride;
    for (let x = 0; x < stride; x++) {
      const byte = raw[srcOff + x];
      const a = x >= bpp ? recon[dstOff + x - bpp] : 0;
      const b = y > 0 ? recon[dstOff - stride + x] : 0;
      const c = y > 0 && x >= bpp ? recon[dstOff - stride + x - bpp] : 0;
      let v = byte;
      if (filter === 1) v = (byte + a) & 255;
      else if (filter === 2) v = (byte + b) & 255;
      else if (filter === 3) v = (byte + ((a + b) >> 1)) & 255;
      else if (filter === 4) v = (byte + paeth(a, b, c)) & 255;
      recon[dstOff + x] = v;
    }
  }
  const y0 = Math.max(0, Math.floor(height * y0Frac));
  const y1 = Math.min(height, Math.ceil(height * y1Frac));
  let sr = 0, sg = 0, sb = 0, dark = 0, n = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * stride + x * bpp;
      const r = recon[i], g = recon[i + 1], b = recon[i + 2];
      sr += r; sg += g; sb += b;
      const yL = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      if (yL < 15) dark++;
      n++;
    }
  }
  const r = sr / Math.max(1, n), g = sg / Math.max(1, n), b = sb / Math.max(1, n);
  return { r: +r.toFixed(1), g: +g.toFixed(1), b: +b.toFixed(1), luma: +(0.2126 * r + 0.7152 * g + 0.0722 * b).toFixed(1), darkFrac: +(dark / Math.max(1, n)).toFixed(4) };
}

async function runLiveCapture() {
  if (!EXECUTABLE) throw new Error('No Chrome/Edge executable found');
  const browser = await chromium.launch({
    executablePath: EXECUTABLE,
    headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'],
  });
  const errors: string[] = [];
  const live: Record<string, unknown> = {};
  try {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
    });
    const page = await context.newPage();
    const failedUrls: string[] = [];
    page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
    page.on('console', m => { if (m.type() === 'error') errors.push(`console.error: ${m.text()}`); });
    page.on('response', r => { if (r.status() >= 400) failedUrls.push(`${r.status()} ${r.url()}`); });

    const waitReady = async () => {
      await page.waitForFunction(() => {
        const inp = (window as unknown as { __inpage?: { view?: unknown } }).__inpage;
        return !document.getElementById('loading') && !!inp?.view;
      }, undefined, { timeout: 120_000 });
    };

    // 1. Noon in-page drone (400 m + 1200 m partial fade) -> frame-0
    await page.goto(`${BASE}/?nomenu=1&transition=inpage&inpagelow=1&noprobe=1&rec=1&hour=12&day=160&seed=1400`, { waitUntil: 'domcontentloaded' });
    await waitReady();
    await page.evaluate(async () => {
      const inp = (window as unknown as { __inpage: any }).__inpage;
      await inp.whenBooted();
      inp.placeAt(49.767, -94.489, 400);
    });
    await page.waitForTimeout(3500);
    await page.evaluate(async () => {
      for (let i = 0; i < 6; i++) await new Promise(r => requestAnimationFrame(r));
    });

    const droneDayState = await page.evaluate(() => {
      const inp = (window as unknown as { __inpage: any }).__inpage;
      const scene = inp.view.scene as THREE.Scene;
      const cam = inp.view.camera as THREE.PerspectiveCamera;
      const renderer = inp.view.photoreal.renderer as THREE.WebGLRenderer;
      const skyObj = scene.children.find((o: any) => o.userData?.physicalSky);
      const fog = scene.fog as THREE.Fog | null;
      let chunkMeshes = 0, fadedChunkMeshes = 0, unfadedChunkMeshes = 0;
      for (const o of scene.children) {
        if (o.type === 'Group' && (o.children[0]?.userData?.inspect as { type?: string } | undefined)?.type === 'terrain') {
          for (const m of o.children) {
            chunkMeshes++;
            if ((m as any).material?.userData?.patchFade) fadedChunkMeshes++;
            else unfadedChunkMeshes++;
          }
        }
      }
      return {
        mode: inp.mode,
        height: +inp.height.toFixed(2),
        fade: +inp.fade.toFixed(4),
        skyScale: skyObj ? skyObj.scale.x : null,
        skyVisible: skyObj ? skyObj.visible : null,
        camFar: +cam.far.toFixed(1),
        camNear: +cam.near.toFixed(3),
        camY: +cam.position.y.toFixed(2),
        bgIntensity: +scene.backgroundIntensity.toFixed(4),
        toneMappingExposure: +renderer.toneMappingExposure.toFixed(4),
        effectiveBgExposure: +(scene.backgroundIntensity * renderer.toneMappingExposure).toFixed(4),
        fogColor: fog ? [+fog.color.r.toFixed(4), +fog.color.g.toFixed(4), +fog.color.b.toFixed(4)] : null,
        chunkMeshes,
        fadedChunkMeshes,
        unfadedChunkMeshes,
      };
    });
    live.droneDay = droneDayState;
    const f0 = join(HERE, 'frame-0-drone-day-400m.png');
    await page.screenshot({ path: f0 });

    // Probe partial fade (h = 1200 m) to observe hideForBand & patchFade deadlock live
    const partialFadeState = await page.evaluate(async () => {
      const inp = (window as unknown as { __inpage: any }).__inpage;
      inp.setEye(1200);
      for (let i = 0; i < 6; i++) await new Promise(r => requestAnimationFrame(r));
      const scene = inp.view.scene as THREE.Scene;
      const renderer = inp.view.photoreal.renderer as THREE.WebGLRenderer;
      let totalChunkMeshes = 0, hiddenChunkMeshes = 0, patchFadeFlagged = 0;
      for (const o of scene.children) {
        if (o.type === 'Group' && (o.children[0]?.userData?.inspect as { type?: string } | undefined)?.type === 'terrain') {
          for (const m of o.children) {
            totalChunkMeshes++;
            if (!m.visible) hiddenChunkMeshes++;
            if ((m as any).material?.userData?.patchFade) patchFadeFlagged++;
          }
        }
      }
      return {
        height: +inp.height.toFixed(1),
        fade: +inp.fade.toFixed(4),
        bgIntensity: +scene.backgroundIntensity.toFixed(4),
        toneMappingExposure: +renderer.toneMappingExposure.toFixed(4),
        effectiveBgExposure: +(scene.backgroundIntensity * renderer.toneMappingExposure).toFixed(4),
        totalChunkMeshes,
        hiddenChunkMeshes,
        patchFadeFlagged,
      };
    });
    live.partialFade1200m = partialFadeState;

    // 2. True winter midnight (day=355 Dec 21, hour=0, sun ~-63 deg) drone (400 m) -> frame-1,
    //    followed by pressing G to embody on the ground -> frame-2 (clipped physicalSky exposes clearColor #c4d4c8!)
    await page.goto(`${BASE}/?nomenu=1&transition=inpage&inpagelow=1&noprobe=1&rec=1&hour=0&day=355&seed=1400`, { waitUntil: 'domcontentloaded' });
    await waitReady();
    // Start in-browser canvas MediaRecorder for recording.webm covering winter midnight drone -> G-landing
    await page.evaluate(`(() => {
      const c = document.querySelector('canvas');
      if (!c || typeof MediaRecorder === 'undefined') return;
      const chunks = [];
      const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp8') ? 'video/webm;codecs=vp8' : 'video/webm';
      const rec = new MediaRecorder(c.captureStream(10), { mimeType: mime });
      rec.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
      rec.start(250);
      window.__auditRec = {
        stop: () => new Promise(resolve => {
          rec.onstop = async () => {
            const blob = new Blob(chunks, { type: mime });
            const ab = await blob.arrayBuffer();
            const u8 = new Uint8Array(ab);
            let bin = '';
            for (let i = 0; i < u8.length; i += 8192) bin += String.fromCharCode(...u8.subarray(i, i + 8192));
            resolve(btoa(bin));
          };
          rec.stop();
        }),
      };
    })()`);
    const groundMidnightFog = await page.evaluate(async () => {
      for (let i = 0; i < 4; i++) await new Promise(r => requestAnimationFrame(r));
      const inp = (window as unknown as { __inpage: any }).__inpage;
      const fog = inp.view.scene.fog as THREE.Fog;
      return [+fog.color.r.toFixed(5), +fog.color.g.toFixed(5), +fog.color.b.toFixed(5)];
    });
    await page.evaluate(async () => {
      const inp = (window as unknown as { __inpage: any }).__inpage;
      await inp.whenBooted();
      inp.placeAt(49.767, -94.489, 400);
    });
    await page.waitForTimeout(3000);
    await page.evaluate(async () => {
      for (let i = 0; i < 6; i++) await new Promise(r => requestAnimationFrame(r));
    });
    const droneMidnightState = await page.evaluate((baseFog: number[]) => {
      const inp = (window as unknown as { __inpage: any }).__inpage;
      const scene = inp.view.scene as THREE.Scene;
      const fog = scene.fog as THREE.Fog;
      const dFog = [+fog.color.r.toFixed(5), +fog.color.g.toFixed(5), +fog.color.b.toFixed(5)];
      const baseL = 0.2126 * baseFog[0] + 0.7152 * baseFog[1] + 0.0722 * baseFog[2];
      const droneL = 0.2126 * dFog[0] + 0.7152 * dFog[1] + 0.0722 * dFog[2];
      return {
        mode: inp.mode,
        height: +inp.height.toFixed(1),
        groundMidnightFogLinear: baseFog,
        droneMidnightFogLinear: dFog,
        groundFogLuma: +baseL.toFixed(5),
        droneFogLuma: +droneL.toFixed(5),
        brightnessRatio: +(droneL / Math.max(1e-6, baseL)).toFixed(2),
      };
    }, groundMidnightFog);
    live.droneMidnight = droneMidnightState;
    const f1 = join(HERE, 'frame-1-drone-midnight-blue-fog.png');
    await page.screenshot({ path: f1 });

    // Press G from 400 m winter midnight drone to land as the wolf on the ground!
    const preLandY = await page.evaluate(() => (window as unknown as { __inpage: any }).__inpage.view.camera.position.y);
    await page.keyboard.press('g');
    await page.waitForFunction(() => (window as unknown as { __inpage: any }).__inpage.mode === 'game', undefined, { timeout: 30_000 });
    await page.evaluate(async () => {
      for (let i = 0; i < 8; i++) await new Promise(r => requestAnimationFrame(r));
    });
    // Tilt camera slightly up to inspect sky dome right after landing from drone!
    await page.mouse.move(640, 500);
    await page.mouse.down();
    await page.mouse.move(640, 220, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(800);
    await page.evaluate(async () => {
      for (let i = 0; i < 6; i++) await new Promise(r => requestAnimationFrame(r));
    });

    const postLandState = await page.evaluate((beforeY: number) => {
      const inp = (window as unknown as { __inpage: any }).__inpage;
      const scene = inp.view.scene as THREE.Scene;
      const cam = inp.view.camera as THREE.PerspectiveCamera;
      const skyObj = scene.children.find((o: any) => o.userData?.physicalSky);
      const halfExtent = skyObj ? skyObj.scale.x * 0.5 : 0;
      const p = inp.player();
      return {
        mode: inp.mode,
        preLandCamY: +beforeY.toFixed(2),
        postLandCamY: +cam.position.y.toFixed(2),
        singleSnapDropM: +(beforeY - cam.position.y).toFixed(2),
        skyScale: skyObj ? skyObj.scale.x : null,
        skyHalfExtentM: halfExtent,
        skyVisible: skyObj ? skyObj.visible : null,
        camFar: +cam.far.toFixed(1),
        skyClippedByFarPlane: halfExtent > cam.far,
        playerPos: { x: +p.x.toFixed(1), z: +p.z.toFixed(1), yaw: +p.yaw.toFixed(3) },
      };
    }, preLandY);
    live.postLand = postLandState;
    const f2 = join(HERE, 'frame-2-post-land-clipped-sky.png');
    await page.screenshot({ path: f2 });
    const webmB64 = await page.evaluate(async () => (window as any).__auditRec ? await (window as any).__auditRec.stop() : '').catch(() => '');
    if (webmB64) writeFileSync(join(HERE, 'recording.webm'), Buffer.from(webmB64, 'base64'));

    // 3. Cold-start winter midnight ground control at same spot & upward tilt -> frame-3 (sky scale = 600 < cam.far)
    const pPos = (postLandState as { playerPos: { x: number; z: number; yaw: number } }).playerPos;
    await page.goto(`${BASE}/?nomenu=1&transition=inpage&inpagelow=1&noprobe=1&rec=1&hour=0&day=355&seed=1400&at=${pPos.x},${pPos.z},${pPos.yaw}`, { waitUntil: 'domcontentloaded' });
    await waitReady();
    await page.waitForTimeout(2000);
    await page.mouse.move(640, 500);
    await page.mouse.down();
    await page.mouse.move(640, 220, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(800);
    await page.evaluate(async () => {
      for (let i = 0; i < 6; i++) await new Promise(r => requestAnimationFrame(r));
    });
    const coldStartState = await page.evaluate(() => {
      const inp = (window as unknown as { __inpage: any }).__inpage;
      const scene = inp.view.scene as THREE.Scene;
      const cam = inp.view.camera as THREE.PerspectiveCamera;
      const skyObj = scene.children.find((o: any) => o.userData?.physicalSky);
      const halfExtent = skyObj ? skyObj.scale.x * 0.5 : 0;
      return {
        mode: inp.mode,
        skyScale: skyObj ? skyObj.scale.x : null,
        skyHalfExtentM: halfExtent,
        camFar: +cam.far.toFixed(1),
        skyClippedByFarPlane: halfExtent > cam.far,
      };
    });
    live.coldStartControl = coldStartState;
    const f3 = join(HERE, 'frame-3-cold-start-sky-control.png');
    await page.screenshot({ path: f3 });
    live.failedUrls = failedUrls.slice(0, 10);

    // Pixel analysis on captured PNG frames
    live.pixelStats = {
      frame0_droneDay_upperSky: pngBandMeanRgb(f0, 0.0, 0.25),
      frame0_droneDay_midGround: pngBandMeanRgb(f0, 0.35, 0.85),
      frame1_droneMidnight_upper: pngBandMeanRgb(f1, 0.0, 0.25),
      frame1_droneMidnight_ground: pngBandMeanRgb(f1, 0.35, 0.85),
      frame2_postLand_upperSky: pngBandMeanRgb(f2, 0.0, 0.30),
      frame3_coldStart_upperSky: pngBandMeanRgb(f3, 0.0, 0.30),
    };

    await context.close();
  } finally {
    await browser.close();
  }
  live.consoleErrors = errors;
  return live;
}

function buildCalibratedChecks(live: Record<string, any>): CheckResult[] {
  const checks: CheckResult[] = [];

  // 1. physicalSky.scale restoration after landing from drone (inpage.ts:475, 228-234)
  {
    const post = live.postLand;
    const ctrl = live.coldStartControl;
    const postSkyBand = live.pixelStats.frame2_postLand_upperSky;
    const ctrlSkyBand = live.pixelStats.frame3_coldStart_upperSky;
    const scoreFn = (halfExtentM: number, camFarM: number, skyLuma: number, ctrlLuma: number) => {
      const unclipped = halfExtentM < camFarM ? 1 : 0;
      const lumaMatch = ratioScore(skyLuma, ctrlLuma);
      return +(0.5 * unclipped + 0.5 * lumaMatch).toFixed(4);
    };
    const score = scoreFn(post.skyHalfExtentM, post.camFar, postSkyBand.luma, ctrlSkyBand.luma);
    const knownMatchScore = scoreFn(ctrl.skyHalfExtentM, ctrl.camFar, ctrlSkyBand.luma, ctrlSkyBand.luma);
    const knownMismatchScore = scoreFn(50_000, 8_000, 0, ctrlSkyBand.luma);
    checks.push({
      id: 'post-landing-physical-sky-scale-clipping',
      label: 'physicalSky scale restoration & far-plane visibility after drone landing',
      measured: `post-land sky.scale=${post.skyScale} (half-extent ${post.skyHalfExtentM} m > cam.far=${post.camFar} m, clipped=${post.skyClippedByFarPlane}); upper-30% sky mean sRGB=(${postSkyBand.r},${postSkyBand.g},${postSkyBand.b}) luma=${postSkyBand.luma} darkFrac=${postSkyBand.darkFrac} vs cold-start control sky.scale=${ctrl.skyScale} (half-extent ${ctrl.skyHalfExtentM} m < cam.far=${ctrl.camFar} m) sRGB=(${ctrlSkyBand.r},${ctrlSkyBand.g},${ctrlSkyBand.b}) luma=${ctrlSkyBand.luma}`,
      expected: `sky.scale restored to 600 (half-extent 300 m < cam.far ${ctrl.camFar} m) in restoreScene(), matching cold-start Preetham sky luma (${ctrlSkyBand.luma})`,
      score,
      knownMatchScore,
      knownMismatchScore,
      pass: score >= 0.95,
      source: 'src/render/sky.ts:100 (scale=600) vs src/world/globe/inpage.ts:475 (scale=1e5), 228-234 (restoreScene omits sky.scale); Three.js r180 Sky BoxGeometry frustum culling',
    });
  }

  // 2. Midnight drone hardcoded daytime blue fog (inpage.ts:476)
  {
    const mid = live.droneMidnight;
    const scoreFn = (droneFogLuma: number, groundFogLuma: number) => {
      const relErr = Math.abs(droneFogLuma - groundFogLuma) / Math.max(groundFogLuma, 1e-4);
      return +clamp01(1 - relErr / 2).toFixed(4);
    };
    const score = scoreFn(mid.droneFogLuma, mid.groundFogLuma);
    const knownMatchScore = scoreFn(mid.groundFogLuma, mid.groundFogLuma);
    const knownMismatchScore = scoreFn(0.6041, 0.0071);
    checks.push({
      id: 'drone-midnight-hardcoded-day-fog',
      label: 'Drone-band fog colour tracks sky.ts solar/night elevation instead of hardcoded daytime blue',
      measured: `hour=00:00 at h=${mid.height} m: drone scene.fog.color linear=(${mid.droneMidnightFogLinear.join(',')}) Y=${mid.droneFogLuma} vs sky.ts ground midnight fog linear=(${mid.groundMidnightFogLinear.join(',')}) Y=${mid.groundFogLuma} (${mid.brightnessRatio}x brighter)`,
      expected: `Drone fog preserves sky.ts solar/twilight/night fog chromaticity & luminance (ratio ~1.0x at midnight, Y=${mid.groundFogLuma})`,
      score,
      knownMatchScore,
      knownMismatchScore,
      pass: score >= 0.95,
      source: 'src/render/sky.ts:122,169-174 (fogNight=0x0d1422 / twilight skyLuminance) vs src/world/globe/inpage.ts:476 (unconditional setRGB(0.45, 0.62, 0.9))',
    });
  }

  // 3. fade.ts:59,67 post-tonemapping & post-colorspace raw linear HDR far-layer mix
  {
    const stdFrag = THREE.ShaderLib.standard.fragmentShader;
    const tonemapIdx = stdFrag.indexOf('#include <tonemapping_fragment>');
    const colorspaceIdx = stdFrag.indexOf('#include <colorspace_fragment>');
    const fogIdx = stdFrag.indexOf('#include <fog_fragment>');
    const ditherIdx = stdFrag.indexOf('#include <dithering_fragment>');
    const sh = { uniforms: {}, vertexShader: '#include <project_vertex>', fragmentShader: stdFrag };
    addPatchFade(sh);
    const mixIdx = sh.fragmentShader.indexOf('textureLod(uFarColor');
    const injectedBeforeTonemap = mixIdx >= 0 && mixIdx < tonemapIdx;

    // Evaluate colour error in direct-render path (no composer, e.g. dusk/night or Low/Med/Min tier)
    // Sample midday boreal canopy linear radiance L_far = [0.14, 0.19, 0.11], scale = 2.6 / 0.5 = 5.2, exposure = 0.5
    const lFar = [0.14, 0.19, 0.11];
    const scale = INPAGE.bandGain / EXPOSURE.base; // 5.2
    const rawOut = lFar.map(c => clamp01(c * scale)); // written straight to sRGB post-tonemap!
    const trueOut = lFar.map(c => linToSrgb(acesChannel(c * scale * EXPOSURE.base)));
    // Bright sunlit snow/water glint L = 0.35: raw 0.35*5.2 = 1.82 -> clipped 1.000 vs ACES sRGB 0.858
    const rmsErr = Math.sqrt(rawOut.reduce((s, v, i) => s + (v - trueOut[i]) ** 2, 0) / 3);
    const clipErr = Math.abs(clamp01(0.35 * scale) - linToSrgb(acesChannel(0.35 * scale * EXPOSURE.base)));

    const scoreFn = (beforeTm: boolean, err: number) => +(beforeTm ? clamp01(1 - err / 0.1) : 0).toFixed(4);
    const score = scoreFn(injectedBeforeTonemap, rmsErr);
    const knownMatchScore = scoreFn(true, 0);
    const knownMismatchScore = scoreFn(false, rmsErr);
    checks.push({
      id: 'fade-far-layer-post-tonemap-linear-srgb-mix',
      label: 'fade.ts far-layer colour mix occurs in linear HDR before tonemapping & sRGB encoding',
      measured: `addPatchFade injects uFarColor mix at byte ${mixIdx} AFTER tonemapping (${tonemapIdx}), colorspace (${colorspaceIdx}), and fog (${fogIdx}) via #include <dithering_fragment> (${ditherIdx}); direct-render canopy L=[0.14,0.19,0.11]*5.2 outputs raw sRGB=[${rawOut.map(v => v.toFixed(3)).join(',')}] vs ACES-sRGB=[${trueOut.map(v => v.toFixed(3)).join(',')}] (RMS=${rmsErr.toFixed(3)}, bright L=0.35 clips at 1.82->1.000, err=${clipErr.toFixed(3)})`,
      expected: `uFarColor linear HDR blend injected BEFORE #include <tonemapping_fragment> (or tonemapped+encoded to match output space), RMS colour error <= 0.005`,
      score,
      knownMatchScore,
      knownMismatchScore,
      pass: score >= 0.95,
      source: 'Three.js r180 ShaderLib.standard.fragmentShader + src/render/fade.ts:59,67 + src/render/post.ts:143 (direct render bypass when !ao && !lightFx)',
    });
  }

  // 4. DRONE_STOP half-stop math (1.5 vs sqrt(2)) + uncompensated backgroundIntensity double-exposure surge
  {
    const trueHalfStop = Math.SQRT2; // 2^0.5 = 1.41421356
    const stopErr = Math.abs(DRONE_STOP - trueHalfStop) / trueHalfStop; // 6.07%
    // At h = 2000 m (globe -> band handoff boundary): standalone globe uses exposure = INPAGE.gain = 1.0
    // In band mode at h = 2000 m: s = 0, bgIntensity = 1.0 / 0.5 = 2.0, renderer exposure = 0.5 * droneExposureScale(2000)
    const exp2000 = (INPAGE.gain / EXPOSURE.base) * (EXPOSURE.base * droneExposureScale(2000));
    const step2000Pct = (exp2000 - INPAGE.gain) / INPAGE.gain; // +19.2% step right at 2000 m!
    // At h = 600 m (fadeFull): intended far-layer exposure = INPAGE.bandGain (2.6), actual = 2.6 * 1.5 = 3.9 (+50%)
    const s600 = smoothstep(TRANSITION.bandTop, TRANSITION.fadeFull, 600);
    const target600 = INPAGE.gain + (INPAGE.bandGain - INPAGE.gain) * s600;
    const actual600 = (target600 / EXPOSURE.base) * (EXPOSURE.base * droneExposureScale(600));
    const surge600 = (actual600 - target600) / target600; // +50.0%

    const scoreFn = (sErr: number, stepErr: number, surgeErr: number) =>
      +clamp01(1 - (sErr / 0.05 + stepErr / 0.1 + surgeErr / 0.2) / 3).toFixed(4);
    const score = scoreFn(stopErr, Math.abs(step2000Pct), Math.abs(surge600));
    const knownMatchScore = scoreFn(0, 0, 0);
    const knownMismatchScore = scoreFn(0.0607, 0.192, 0.50);
    checks.push({
      id: 'drone-half-stop-and-far-layer-double-exposure',
      label: 'Exact photographic +0.5 EV drone stop (sqrt(2)) & continuous far-layer exposure across 2 km handoff',
      measured: `DRONE_STOP=${DRONE_STOP} (+${Math.log2(DRONE_STOP).toFixed(3)} EV vs +0.500 EV / ${trueHalfStop.toFixed(4)}); h=2000 m effective far-layer exposure jumps ${INPAGE.gain.toFixed(3)}->${exp2000.toFixed(3)} (+${(step2000Pct * 100).toFixed(1)}%); h=600 m actual=${actual600.toFixed(3)} vs target=${target600.toFixed(3)} (+${(surge600 * 100).toFixed(1)}%; live 400 m bgI=${live.droneDay.bgIntensity} * exp=${live.droneDay.toneMappingExposure} = ${live.droneDay.effectiveBgExposure})`,
      expected: `DRONE_STOP = Math.SQRT2 (1.4142, +0.500 EV), and scene.backgroundIntensity divided by (EXPOSURE.base * DRONE_GRADE.exposure) so 2000 m step = 0% and 600 m effective gain = ${target600.toFixed(2)}`,
      score,
      knownMatchScore,
      knownMismatchScore,
      pass: score >= 0.95,
      source: 'ISO 2720 / Lagarde & de Rousiers 2014 (+0.5 EV = 2^0.5 = 1.4142); src/render/droneGrade.ts:14, post.ts:140, inpage.ts:473-474',
    });
  }

  // 5. hideForBand uncompiled patchFade deadlock & WeakMap false poisoning (fade.ts:86 + inpage.ts:237-260)
  {
    const freshMat = new THREE.MeshStandardMaterial({ color: 0x335533 });
    fadeOptIn(freshMat, true);
    const flaggedImmediately = !!freshMat.userData.patchFade; // false! only set inside onBeforeCompile!
    const partial = live.partialFade1200m;
    const liveHiddenFrac = partial.totalChunkMeshes > 0 ? partial.hiddenChunkMeshes / partial.totalChunkMeshes : 0;

    // Also verify source code of inpage.ts WeakMap dithers caches uncompiled false forever
    const inpageSrc = readFileSync(join(ROOT, 'src/world/globe/inpage.ts'), 'utf8');
    const cachesFalseInWeakMap = /dithers\.set\(o,\s*v\)/.test(inpageSrc) && /!faded\(m\)/.test(inpageSrc);

    const scoreFn = (flaggedAtOptIn: boolean, cachesStaleFalse: boolean, hiddenFracAt1200m: number) =>
      +clamp01((flaggedAtOptIn ? 0.5 : 0) + (!cachesStaleFalse ? 0.25 : 0) + 0.25 * (1 - hiddenFracAt1200m)).toFixed(4);
    const score = scoreFn(flaggedImmediately, cachesFalseInWeakMap, liveHiddenFrac);
    const knownMatchScore = scoreFn(true, false, 0);
    const knownMismatchScore = scoreFn(false, true, 1);
    checks.push({
      id: 'hide-for-band-uncompiled-patchfade-deadlock',
      label: 'fadeOptIn marks materials immediately so hideForBand never deadlocks compilation or poisons WeakMap',
      measured: `fadeOptIn(mat, true) sets userData.patchFade=${flaggedImmediately} before compile (only set inside onBeforeCompile at fade.ts:86); inpage.ts:239 permanently caches false in dithers WeakMap; live at h=1200 m (fade=${partial.fade}): ${partial.hiddenChunkMeshes}/${partial.totalChunkMeshes} chunk meshes hidden (${partial.patchFadeFlagged} flagged patchFade)`,
      expected: `fadeOptIn sets m.userData.patchFade = true immediately upon wiring (or hideForBand checks opted-in set), 0 opted-in chunk meshes hidden by uncompiled deadlock`,
      score,
      knownMatchScore,
      knownMismatchScore,
      pass: score >= 0.95,
      source: 'src/render/fade.ts:81-87 vs src/world/globe/inpage.ts:237-260',
    });
  }

  // 6. forestLanding seed-blind landingMemo + inpage.ts unblended 400 m -> 1.8 m snap (nextMode divergence)
  {
    const origOn = STAGES.on, origSeed = STAGES.seed;
    STAGES.on = true; STAGES.seed = 1400;
    const spot1400 = forestLanding({ x: 0, z: 0 });
    STAGES.on = true; STAGES.seed = 4242;
    const spot4242Cached = forestLanding({ x: 0, z: 0 }); // stale cache hit because key is only "0,0"!
    // Force cache miss by perturbing around slightly by 0.001 m to see true seed-4242 landing!
    const spot4242True = forestLanding({ x: 0.001, z: 0 });
    STAGES.on = origOn; STAGES.seed = origSeed;

    const memoReturnedStale = spot4242Cached.land.x === spot1400.land.x && spot4242Cached.land.z === spot1400.land.z;
    const trueShiftM = Math.hypot(spot4242True.land.x - spot1400.land.x, spot4242True.land.z - spot1400.land.z);
    const staleShiftError = memoReturnedStale ? trueShiftM : 0;

    // Check nextMode vs live G press at 400 m
    const nextModeAllows400m = nextMode({ mode: 'band', height: 400, overHome: true, descending: true, chunksReady: true, embody: true }) === 'game';
    const handoverIsNoOp = handoverBlend({ y: 400 }, { y: 1.8 }, 1).y === 400;
    const liveDropM = live.postLand.singleSnapDropM;

    const scoreFn = (staleErrM: number, snapDropM: number, contractAligned: boolean) =>
      +clamp01((staleErrM < 0.5 ? 0.5 : 0) + (snapDropM < 20 && contractAligned ? 0.5 : 0)).toFixed(4);
    const score = scoreFn(staleShiftError, liveDropM, nextModeAllows400m && !handoverIsNoOp);
    const knownMatchScore = scoreFn(0, 5, true);
    const knownMismatchScore = scoreFn(50, 398, false);
    checks.push({
      id: 'forest-landing-seed-memo-and-400m-embody-snap',
      label: 'forestLanding memo keys on world/stage seed & G-embody eases smoothly per nextMode contract',
      measured: `forestLanding({0,0}) seed 1400=(${spot1400.land.x},${spot1400.land.z}) vs seed 4242 cached=(${spot4242Cached.land.x},${spot4242Cached.land.z}) [STALE!] vs true seed 4242=(${spot4242True.land.x},${spot4242True.land.z}, ${trueShiftM.toFixed(1)} m off); live G-embody snapped ${liveDropM} m in 1 frame (${live.postLand.preLandCamY} m -> ${live.postLand.postLandCamY} m; handoverBlend no-op=${handoverIsNoOp}, transition.nextMode(400m)=${nextModeAllows400m ? 'game' : 'band'})`,
      expected: `landingMemo key includes WORLD_SEED & STAGES.seed/on (0 m stale error), and embodying from glide eases smoothly (or lowers to floorAlt) without snapping 398 m in 1 frame`,
      score,
      knownMatchScore,
      knownMismatchScore,
      pass: score >= 0.95,
      source: 'src/world/globe/forestLanding.ts:74-81 + src/world/globe/inpage.ts:412,444 + src/world/globe/transition.ts:118,173',
    });
  }

  return checks;
}

async function main() {
  const live = await runLiveCapture();
  const checks = buildCalibratedChecks(live);
  const calibrationValid = checks.every(c => c.knownMatchScore >= 0.95 && c.knownMismatchScore <= 0.25);
  const passCount = checks.filter(c => c.pass).length;
  const meanScore = +(checks.reduce((s, c) => s + c.score, 0) / checks.length).toFixed(4);

  const report = {
    audit: 'inpage-descent-fade-sky-audit',
    baseUrl: BASE,
    capturedAt: new Date().toISOString(),
    calibrationValid,
    passCount,
    totalChecks: checks.length,
    meanScore,
    live,
    checks,
  };
  writeFileSync(join(HERE, 'numbers.json'), JSON.stringify(report, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify({ calibrationValid, passCount, totalChecks: checks.length, meanScore, consoleErrors: (live.consoleErrors as string[]).length, checks: checks.map(c => ({ id: c.id, score: c.score, pass: c.pass })) }, null, 2));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
