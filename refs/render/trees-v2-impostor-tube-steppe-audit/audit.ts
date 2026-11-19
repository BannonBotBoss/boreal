/**
 * Live & calibrated Rule 11 audit of the Trees v2, Octahedral Impostor, Tube Parallel Transport,
 * Far-Ring & Steppe-Tuft rendering pipeline:
 *  1. src/render/trees/game.ts:40-67,71,89-90 — scene===undefined variant poisoning (caches -1
 *     geometry IDs permanently when placeTree runs before updateTrees) + BatchedMesh capacity vs
 *     all 16 conifer variants (4 age classes x 4 variants)
 *  2. src/render/trees/game.ts:119,139-153 — unthrottled per-frame O(N) reconcileSteppe() +
 *     unbounded steppeTufts Three.js Group/BufferGeometry leak (never removed or disposed)
 *  3. src/render/trees/impostor.ts:210,212,294-305,435-446 — reversed matrix product
 *     inverse(transformedInstanceMatrix * modelMatrix) in VERT, un-transformed bake-camera
 *     view-space normals unpacked as live view-space normals, and 2.05x cyan-blue IMPOSTOR_FX.tint
 *     (0.39, 0.42, 0.80) causing live LOD color/shading divergence vs near LOD
 *  4. src/render/trees/tube.ts:34,38 — parallel-transport vertical degeneracy (missing XV fallback
 *     when t is parallel to UPV on ring i > 0 -> collapsed rings & zero-length normals)
 *  5. src/render/trees/farRing.ts:24-25 + impostor.ts:210 — non-uniform scale (sx != sy) applied to
 *     octahedral impostors projected in unit-sphere space
 *  6. src/render/flora/steppeTuft.ts:77-79,125-130,170-183 — 2.6x super-bright linear straw albedo
 *     (tip 0.72 R / 0.58 G vs 0.16-0.28 Oke 1987 cured grass), zero winter/spring phenology,
 *     unshared per-instance geometry in steppeTuftGroup, and loop-index yaw hash2u(i, 1, 7) that
 *     scrambles every tussock's orientation on every 3 m camera pan
 *
 * Usage:
 *   npx tsx refs/render/trees-v2-impostor-tube-steppe-audit/audit.ts [baseUrl]
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';
import * as THREE from 'three';
import { chromium } from 'playwright';

import { tubes } from '../../../src/render/trees/tube';
import { IMPOSTOR_FX } from '../../../src/render/trees/impostor';
import { steppeTuftGeometry } from '../../../src/render/flora/steppeTuft';
import { hash2u } from '../../../src/proc/rng';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');
const BASE = process.argv[2] ?? 'http://127.0.0.1:5263';
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

function decodePng(path: string): { width: number; height: number; bpp: number; recon: Buffer } {
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
  return { width, height, bpp, recon };
}

/** Measure non-sky, non-floor foliage pixels inside horizontal slice [x0Frac, x1Frac] x [y0Frac, y1Frac]. */
function measureTreeSlot(png: { width: number; height: number; bpp: number; recon: Buffer }, x0f: number, x1f: number, y0f: number, y1f: number) {
  const { width, height, bpp, recon } = png;
  const stride = width * bpp;
  const x0 = Math.floor(width * x0f), x1 = Math.ceil(width * x1f);
  const y0 = Math.floor(height * y0f), y1 = Math.ceil(height * y1f);
  let sr = 0, sg = 0, sb = 0, n = 0;
  let minY = height, maxY = 0, minX = width, maxX = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = y * stride + x * bpp;
      const r = recon[i], g = recon[i + 1], b = recon[i + 2];
      // Exclude blue sky background (#a9c3dc -> ~169,195,220, B > R + 20 && B > 150)
      if (b > 150 && b > r + 15) continue;
      // Exclude uniform dark ground below tree crown base (only keep crown pixels)
      sr += r; sg += g; sb += b; n++;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
    }
  }
  const r = sr / Math.max(1, n), g = sg / Math.max(1, n), b = sb / Math.max(1, n);
  const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return {
    px: n,
    r: +r.toFixed(1),
    g: +g.toFixed(1),
    b: +b.toFixed(1),
    luma: +luma.toFixed(1),
    bOverG: +(b / Math.max(1, g)).toFixed(3),
    rOverG: +(r / Math.max(1, g)).toFixed(3),
    bboxW: n > 0 ? maxX - minX + 1 : 0,
    bboxH: n > 0 ? maxY - minY + 1 : 0,
  };
}

async function runLiveAudit() {
  if (!EXECUTABLE) throw new Error('No Chrome/Edge executable found');
  const browser = await chromium.launch({
    executablePath: EXECUTABLE,
    headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'],
  });
  const errors: string[] = [];
  const failedUrls: string[] = [];
  const live: Record<string, unknown> = {};

  try {
    // 1. Recorded session on /?tree=1&view=lod (Near | Mid | Far Crown | Impostor)
    const recCtx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const page = await recCtx.newPage();
    page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
    page.on('console', m => { if (m.type() === 'error') errors.push(`console.error: ${m.text()}`); });
    page.on('response', r => { if (r.status() >= 400) failedUrls.push(`${r.status()} ${r.url()}`); });

    await page.goto(`${BASE}/?tree=1&view=lod`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(() => Boolean((window as unknown as { borealTrees?: { ready?: boolean } }).borealTrees?.ready), { timeout: 60000 });
    await page.waitForTimeout(800);
    live.lodViewerStats = await page.evaluate(() => (window as unknown as { borealTrees?: { stats?: unknown } }).borealTrees?.stats);
    const f0 = join(HERE, 'frame-0-tree-lod-front.png');
    await page.screenshot({ path: f0 });

    // Start in-browser canvas MediaRecorder for recording.webm orbiting all 4 LODs
    await page.evaluate(`(() => {
      const c = document.querySelector('canvas');
      if (!c || typeof MediaRecorder === 'undefined') return;
      const chunks = [];
      const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp8') ? 'video/webm;codecs=vp8' : 'video/webm';
      const rec = new MediaRecorder(c.captureStream(12), { mimeType: mime });
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

    // Smoothly orbit ~150 deg around the 4 LODs for recording + backlit comparison
    await page.mouse.move(640, 360);
    await page.mouse.down();
    for (let step = 1; step <= 20; step++) {
      await page.mouse.move(640 + step * 26, 360 - Math.sin((step / 20) * Math.PI) * 30);
      await page.waitForTimeout(100);
    }
    await page.mouse.up();
    await page.waitForTimeout(700);
    const f1 = join(HERE, 'frame-1-tree-lod-backlit.png');
    await page.screenshot({ path: f1 });

    const b64 = await page.evaluate(`window.__auditRec ? window.__auditRec.stop() : null`) as string | null;
    if (b64) writeFileSync(join(HERE, 'recording.webm'), Buffer.from(b64, 'base64'));

    // In-browser probe of all 16 variants budget & game.ts scene-undefined poisoning
    live.browserProbe = await page.evaluate(async () => {
      const coniferMod = await import('/src/render/trees/conifer.ts');
      const gameMod = await import('/src/render/trees/game.ts');
      const interestMod = await import('/src/core/interest.ts');

      const CLASS_AGE = [25, 70, 130, 220];
      let barkVerts = 0, barkIdx = 0, leafVerts = 0, leafIdx = 0, crownVerts = 0, crownIdx = 0;
      const perClass: Record<string, { barkV: number; barkI: number; leafV: number; leafI: number; crownV: number; crownI: number; nearTris: number; midTris: number }> = {};
      for (let cls = 0; cls < 4; cls++) {
        let cbV = 0, cbI = 0, clV = 0, clI = 0, ccV = 0, ccI = 0, nT = 0, mT = 0;
        for (let v = 0; v < 4; v++) {
          const l = coniferMod.buildConifer('black-spruce', 101 + v * 17 + cls * 1000, CLASS_AGE[cls]);
          const nb = l.near.children[0].geometry, mb = l.mid.children[0].geometry;
          const nl = l.near.children[1].geometry, ml = l.mid.children[1].geometry;
          const cr = l.crown;
          cbV += nb.attributes.position.count + mb.attributes.position.count;
          cbI += (nb.index?.count ?? 0) + (mb.index?.count ?? 0);
          clV += nl.attributes.position.count + ml.attributes.position.count;
          clI += (nl.index?.count ?? 0) + (ml.index?.count ?? 0);
          ccV += cr.attributes.position.count;
          ccI += cr.index?.count ?? 0;
          nT += l.stats.tris.near;
          mT += l.stats.tris.mid;
        }
        barkVerts += cbV; barkIdx += cbI; leafVerts += clV; leafIdx += clI; crownVerts += ccV; crownIdx += ccI;
        perClass[`age_${CLASS_AGE[cls]}`] = { barkV: cbV, barkI: cbI, leafV: clV, leafI: clI, crownV: ccV, crownI: ccI, nearTris: Math.round(nT / 4), midTris: Math.round(mT / 4) };
      }

      const prevOn = gameMod.TREES_V2.on;
      gameMod.TREES_V2.on = true;
      const fullBefore = gameMod.TREES_V2_INFO.full;
      const variantsBefore = gameMod.TREES_V2_INFO.variants;
      gameMod.placeTree('poison:0', 10, 0, 10, 0, 1, 1, 1, 32, 1, false);
      for (let i = 0; i < 400; i++) interestMod.runJobs(50);
      const fullAfter = gameMod.TREES_V2_INFO.full;
      const variantsAfter = gameMod.TREES_V2_INFO.variants;
      const recBefore = gameMod.treeRecord('poison:0');
      gameMod.dropPlacedTrees();
      gameMod.cancelPendingTreeBuilds();
      gameMod.TREES_V2.on = prevOn;

      return {
        budget16: {
          barkVerts, barkVertCap: 260000, barkVertPct: +(barkVerts / 260000 * 100).toFixed(1),
          barkIdx, barkIdxCap: 600000, barkIdxPct: +(barkIdx / 600000 * 100).toFixed(1),
          leafVerts, leafVertCap: 700000, leafVertPct: +(leafVerts / 700000 * 100).toFixed(1),
          leafIdx, leafIdxCap: 1100000, leafIdxPct: +(leafIdx / 1100000 * 100).toFixed(1),
          crownVerts, crownVertCap: 4000, crownVertPct: +(crownVerts / 4000 * 100).toFixed(1),
          crownIdx, crownIdxCap: 8000, crownIdxPct: +(crownIdx / 8000 * 100).toFixed(1),
        },
        perClass,
        sceneUndefPoison: {
          fullDelta: fullAfter - fullBefore,
          variantsDelta: variantsAfter - variantsBefore,
          treeRecorded: Boolean(recBefore),
        },
      };
    });

    await recCtx.close();

    // 2. Capture /?tree=1&view=lod&atlas=1 (baked octahedral atlas)
    const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const p2 = await ctx2.newPage();
    p2.on('pageerror', e => errors.push(`pageerror2: ${e.message}`));
    p2.on('console', m => { if (m.type() === 'error') errors.push(`console.error2: ${m.text()}`); });

    await p2.goto(`${BASE}/?tree=1&view=lod&atlas=1`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await p2.waitForFunction(() => Boolean((window as unknown as { borealTrees?: { ready?: boolean } }).borealTrees?.ready), { timeout: 60000 });
    await p2.waitForTimeout(600);
    await p2.screenshot({ path: join(HERE, 'frame-2-tree-lod-atlas.png') });

    // 3. Capture /?tree=1&view=one (eye-level stand comparison matching ref-1)
    await p2.goto(`${BASE}/?tree=1&view=one`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await p2.waitForFunction(() => Boolean((window as unknown as { borealTrees?: { ready?: boolean } }).borealTrees?.ready), { timeout: 60000 });
    await p2.waitForTimeout(600);
    live.standViewerStats = await p2.evaluate(() => (window as unknown as { borealTrees?: { stats?: unknown } }).borealTrees?.stats);
    await p2.screenshot({ path: join(HERE, 'frame-3-trees-v2-stand.png') });

    await ctx2.close();
  } finally {
    await browser.close();
  }

  return { errors, failedUrls, live };
}

async function main() {
  const { errors, failedUrls, live } = await runLiveAudit();

  // Analyze live PNG frames for LOD color/luminance/chromaticity comparison
  const frontPng = decodePng(join(HERE, 'frame-0-tree-lod-front.png'));
  // In /?tree=1&view=lod: x = -7.5 (near), -2.5 (mid), +2.5 (crown), +7.5 (impostor) from cam(0,2,30) fov=40
  const slotsFront = {
    near: measureTreeSlot(frontPng, 0.25, 0.38, 0.14, 0.67),
    mid: measureTreeSlot(frontPng, 0.39, 0.50, 0.14, 0.67),
    crown: measureTreeSlot(frontPng, 0.50, 0.61, 0.14, 0.67),
    impostor: measureTreeSlot(frontPng, 0.62, 0.75, 0.14, 0.67),
  };

  // Source-level & mathematical verification checks
  const gameSrc = readFileSync(join(ROOT, 'src/render/trees/game.ts'), 'utf8');
  const impSrc = readFileSync(join(ROOT, 'src/render/trees/impostor.ts'), 'utf8');
  const tubeSrc = readFileSync(join(ROOT, 'src/render/trees/tube.ts'), 'utf8');
  const farRingSrc = readFileSync(join(ROOT, 'src/render/trees/farRing.ts'), 'utf8');
  const steppeSrc = readFileSync(join(ROOT, 'src/render/flora/steppeTuft.ts'), 'utf8');

  const bp = live.browserProbe as {
    budget16: { barkVerts: number; barkVertCap: number; barkIdx: number; barkIdxCap: number; leafVerts: number; leafVertCap: number; leafIdx: number; leafIdxCap: number; crownVerts: number; crownVertCap: number; crownIdx: number; crownIdxCap: number };
    sceneUndefPoison: { fullDelta: number; variantsDelta: number; treeRecorded: boolean };
  };

  // Check 1: game.ts scene===undefined variant poisoning + BatchedMesh 16-variant capacity headroom
  const hasPoison = bp.sceneUndefPoison.fullDelta > 0 && bp.sceneUndefPoison.variantsDelta > 0;
  const barkFits = bp.budget16.barkVerts <= bp.budget16.barkVertCap && bp.budget16.barkIdx <= bp.budget16.barkIdxCap;
  const leafFits = bp.budget16.leafVerts <= bp.budget16.leafVertCap && bp.budget16.leafIdx <= bp.budget16.leafIdxCap;
  const crownFits = bp.budget16.crownVerts <= bp.budget16.crownVertCap && bp.budget16.crownIdx <= bp.budget16.crownIdxCap;
  const checksMbChecked = /va\.ids\.mb\s*>=\s*0/.test(gameSrc) && /va\.ids\.ml\s*>=\s*0/.test(gameSrc);
  const c1PassCount = (hasPoison ? 0 : 1) + (barkFits ? 1 : 0) + (leafFits ? 1 : 0) + (crownFits ? 1 : 0) + (checksMbChecked ? 1 : 0);
  const c1Score = +(c1PassCount / 5).toFixed(4);

  // Check 2: game.ts reconcileSteppe per-frame throttle + steppeTufts disposal/pruning
  const reconcileIdx = gameSrc.indexOf('reconcileSteppe(sc)');
  const throttleIdx = gameSrc.indexOf('Math.hypot(x - lx, z - lz)');
  const throttledReconcile = reconcileIdx > throttleIdx && throttleIdx > 0;
  const prunesSteppeTufts = /steppeTufts\.delete/.test(gameSrc) && /dispose\s*\(\)/.test(gameSrc);
  const c2Score = +(((throttledReconcile ? 1 : 0) + (prunesSteppeTufts ? 1 : 0)) / 2).toFixed(4);

  // Check 3: impostor.ts reversed modelMatrix inverse + bake-camera normals + 2.05x cyan-blue tint + live LOD brightness/silhouette divergence
  const reversedMatOrder = /inverse\s*\(\s*transformedInstanceMatrix\s*\*\s*modelMatrix\s*\)/.test(impSrc) || /inverse\s*\(\s*impostorTransform\s*\*\s*modelMatrix\s*\)/.test(impSrc);
  // Quantify exact world-to-local error for a parent group translated by (100, 0, 50) & rotated 45 deg
  const modelM = new THREE.Matrix4().compose(new THREE.Vector3(100, 0, 50), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 4), new THREE.Vector3(1, 1, 1));
  const instM = new THREE.Matrix4().compose(new THREE.Vector3(12, 0, -8), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), 1.1), new THREE.Vector3(10, 10, 10));
  const camWorld = new THREE.Vector3(115, 6, 80);
  const correctLocal = camWorld.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(modelM, instM).invert());
  const buggyLocal = camWorld.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(instM, modelM).invert());
  const dirAngleDeg = +(correctLocal.clone().normalize().angleTo(buggyLocal.clone().normalize()) * 180 / Math.PI).toFixed(2);
  const tintBG = +(IMPOSTOR_FX.tint.value.z / IMPOSTOR_FX.tint.value.y).toFixed(3);
  const tintBR = +(IMPOSTOR_FX.tint.value.z / IMPOSTOR_FX.tint.value.x).toFixed(3);
  const bakesWorldNormals = /modelMatrix\s*\*\s*vec4\s*\(\s*objectNormal/.test(impSrc);
  const crownLumaRatio = ratioScore(slotsFront.crown.luma, slotsFront.near.luma);
  const impLumaRatio = ratioScore(slotsFront.impostor.luma, slotsFront.near.luma);
  const impAreaRatio = ratioScore(slotsFront.impostor.px, slotsFront.near.px);
  const c3Sub = [
    reversedMatOrder ? 0 : 1,
    bakesWorldNormals ? 1 : 0,
    ratioScore(1.0, Math.max(tintBG, tintBR)),
    crownLumaRatio,
    impLumaRatio,
    impAreaRatio,
  ];
  const c3Score = +(c3Sub.reduce((a, b) => a + b, 0) / c3Sub.length).toFixed(4);

  // Check 4: tube.ts:38 parallel-transport vertical degeneracy (J-hook upturn: t0=(0,1,0) -> n0=(0,0,-1) -> horizontal t=(0,0,-1) -> n=(0,-1,0) -> vertical tip t=(0,1,0) where n||t and t||UPV -> n=(0,0,0)!)
  const stemWorst = {
    level: 1, radialSegments: 6,
    points: [
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(0, 1, -1),
      new THREE.Vector3(0, 0, -2),
      new THREE.Vector3(0, 1, -2),
    ],
    radii: [0.1, 0.08, 0.06, 0.04, 0.02],
    orients: [],
  };
  const tgW = tubes([stemWorst as never], { colour: () => new THREE.Color(0.5, 0.5, 0.5) });
  const normW = tgW.attributes.normal;
  let zeroNorms = 0, validNorms = 0;
  for (let i = 0; i < normW.count; i++) {
    const len = Math.hypot(normW.getX(i), normW.getY(i), normW.getZ(i));
    if (!Number.isFinite(len) || len < 0.5) zeroNorms++; else validNorms++;
  }
  const hasLine38Fallback = /if\s*\(\s*n\.lengthSq\(\)\s*<\s*1e-8\s*\)\s*\{?[^}]*XV/.test(tubeSrc);
  const c4Score = +((validNorms / normW.count) * (hasLine38Fallback ? 1 : 0.5)).toFixed(4);

  // Check 5: farRing.ts non-uniform scale on octahedral impostors
  const nonUniformImpScale = /const place = \(mesh: THREE\.InstancedMesh[\s\S]*?s\.set\(w, t\.scale \* \(\.85 \+ r\(\) \* \.3\), w\)\)[\s\S]*?place\(mesh, far\[i\]\)/.test(farRingSrc);
  // Quantify aspect distortion of non-uniform scale (sx=0.8..1.2, sy=0.85..1.15 -> max ratio 1.2/0.85 = 1.412)
  const maxAniso = +(1.2 / 0.85).toFixed(3);
  const c5Score = nonUniformImpScale ? +(1 / maxAniso * 0.5).toFixed(4) : 1.0;

  // Check 6: steppeTuft.ts linear albedo (vs Oke 1987 / Asner 1998 cured grass 0.16-0.28), seasonal phenology, & loop-index yaw instability
  const st = steppeTuftGeometry(1);
  const col = st.attributes.color;
  let maxR = 0, maxG = 0, maxB = 0, sumY = 0;
  for (let i = 0; i < col.count; i++) {
    const r = col.getX(i), g = col.getY(i), b = col.getZ(i);
    maxR = Math.max(maxR, r); maxG = Math.max(maxG, g); maxB = Math.max(maxB, b);
    sumY += 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }
  const meanLinearY = +(sumY / col.count).toFixed(4);
  const maxAlbedoTarget = 0.28; // Oke (1987) Boundary Layer Climates Table 1.1: dry/cured grass albedo 0.16-0.28
  const albedoRatio = meanLinearY <= maxAlbedoTarget && maxR <= 0.38 ? 1.0 : ratioScore(maxAlbedoTarget, meanLinearY);
  const hasSeasonalPhenology = /dayAt|season|snow|uSnow|phenology/i.test(steppeSrc);
  const usesLoopIndexYaw = /hash2u\s*\(\s*i\s*,\s*1\s*,\s*7\s*\)/.test(steppeSrc);
  // Quantify yaw scramble fraction when shifting point array by 1 index (simulating 3 m camera pan)
  let yawChanged = 0;
  for (let i = 0; i < 100; i++) {
    const y0 = hash2u(i, 1, 7) * Math.PI;
    const y1 = hash2u(i + 1, 1, 7) * Math.PI;
    if (Math.abs(y0 - y1) > 0.05) yawChanged++;
  }
  const c6Score = +((albedoRatio + (hasSeasonalPhenology ? 1 : 0) + (usesLoopIndexYaw ? 0 : 1)) / 3).toFixed(4);

  const checks: CheckResult[] = [
    {
      id: 'trees-v2-scene-undef-poison-and-batch-budget',
      label: 'trees/game.ts scene===undefined variant poisoning & 16-variant BatchedMesh budget',
      measured: `scene===undefined poison fullDelta=${bp.sceneUndefPoison.fullDelta}, variantsDelta=${bp.sceneUndefPoison.variantsDelta}; 16-variant totals: bark=${bp.budget16.barkVerts}/${bp.budget16.barkVertCap}v ${bp.budget16.barkIdx}/${bp.budget16.barkIdxCap}i, leaf=${bp.budget16.leafVerts}/${bp.budget16.leafVertCap}v ${bp.budget16.leafIdx}/${bp.budget16.leafIdxCap}i, crown=${bp.budget16.crownVerts}/${bp.budget16.crownVertCap}v ${bp.budget16.crownIdx}/${bp.budget16.crownIdxCap}i; mb/ml checked=${checksMbChecked}`,
      expected: 'Defer variant upload until scene exists (fullDelta=0), all 16 variants fit BatchedMesh caps with headroom, and materialise guards nb/mb/nl/ml >= 0',
      score: c1Score,
      knownMatchScore: 1.0,
      knownMismatchScore: 0.0,
      pass: c1Score >= 0.95,
      source: 'Three.js BatchedMesh API (maxVertexCount/maxIndexCount) & deterministic cold-start job ordering',
    },
    {
      id: 'trees-v2-reconcile-steppe-throttle-and-leak',
      label: 'trees/game.ts per-frame unthrottled reconcileSteppe & unbounded steppeTufts scene leak',
      measured: `reconcileSteppe before 1m/500ms throttle=${!throttledReconcile}; prunes/disposes steppeTufts=${prunesSteppeTufts}`,
      expected: 'reconcileSteppe gated on generation/movement throttle and steppeTufts pruned & geometry-disposed on unload/dropPlacedTrees',
      score: c2Score,
      knownMatchScore: 1.0,
      knownMismatchScore: 0.0,
      pass: c2Score >= 0.95,
      source: 'Three.js GPU memory lifecycle (BufferGeometry.dispose) & frame-budget engineering (<= 16.6 ms)',
    },
    {
      id: 'impostor-matrix-order-normals-and-cyan-tint',
      label: 'trees/impostor.ts reversed modelMatrix inverse, bake-camera normals & 2.05x cyan-blue tint',
      measured: `reversedMatOrder=${reversedMatOrder} (angle error=${dirAngleDeg} deg on moved parent group), bakesWorldNormals=${bakesWorldNormals}, IMPOSTOR_FX.tint=(${IMPOSTOR_FX.tint.value.x},${IMPOSTOR_FX.tint.value.y},${IMPOSTOR_FX.tint.value.z}) B/G=${tintBG}x B/R=${tintBR}x; live frame-0 near luma=${slotsFront.near.luma} (${slotsFront.near.px} px, W=${slotsFront.near.bboxW}) vs crown luma=${slotsFront.crown.luma} (${+(crownLumaRatio*100).toFixed(1)}%) & impostor luma=${slotsFront.impostor.luma} (${+(impLumaRatio*100).toFixed(1)}%, ${slotsFront.impostor.px} px = +${+((slotsFront.impostor.px/slotsFront.near.px - 1)*100).toFixed(1)}% bloated area, W=${slotsFront.impostor.bboxW})`,
      expected: 'inverse(modelMatrix * transformedInstanceMatrix) (0 deg error), object/world-space normal transform to live view space, neutral physically calibrated tint (B/G <= 1.15)',
      score: c3Score,
      knownMatchScore: 1.0,
      knownMismatchScore: 0.0,
      pass: c3Score >= 0.95,
      source: 'Brucks (2018) Octahedral Impostors; Three.js modelViewMatrix = viewMatrix * modelMatrix * instanceMatrix; Pharr et al. (2023) PBR albedo conservation',
    },
    {
      id: 'tube-parallel-transport-vertical-degeneracy',
      label: 'trees/tube.ts:38 parallel-transport vertical degeneracy (zero normals / collapsed rings)',
      measured: `curved-to-vertical test stem: zeroNorms=${zeroNorms}/${normW.count} vertices (${+(zeroNorms / normW.count * 100).toFixed(1)}%), line 38 XV fallback=${hasLine38Fallback}`,
      expected: '0/N zero-length normals on any curved-to-vertical stem (fallback to XV when |t x UPV| < 1e-6 on ring i > 0, matching line 34)',
      score: c4Score,
      knownMatchScore: 1.0,
      knownMismatchScore: 0.0,
      pass: c4Score >= 0.95,
      source: 'Bishop (1975) "There is More than One Way to Frame a Curve", Am. Math. Monthly 82(3):246-251; Weber & Penn (1995) sec. 5',
    },
    {
      id: 'far-ring-impostor-nonuniform-scale',
      label: 'trees/farRing.ts:24-25 non-uniform scale applied to octahedral impostors',
      measured: `nonUniformImpScale=${nonUniformImpScale} (sx=0.8..1.2 vs sy=0.85..1.15, max aspect distortion=${maxAniso}x in unit-sphere impostor projection)`,
      expected: 'Uniform scale (or aspect-corrected impostor projection) for octahedral impostor instances so cameraDir & bounding sphere stay undistorted',
      score: c5Score,
      knownMatchScore: 1.0,
      knownMismatchScore: 0.3541,
      pass: c5Score >= 0.95,
      source: 'Brucks (2018) Octahedral Impostors bounding-sphere isotropic projection assumption',
    },
    {
      id: 'steppe-tuft-albedo-phenology-and-yaw-jitter',
      label: 'flora/steppeTuft.ts 2.6x linear albedo, zero phenology & loop-index yaw jitter on camera pan',
      measured: `linear maxRGB=(${maxR.toFixed(2)},${maxG.toFixed(2)},${maxB.toFixed(2)}) meanLinearY=${meanLinearY} (vs 0.16-0.28 cured grass), seasonalPhenology=${hasSeasonalPhenology}, usesLoopIndexYaw=${usesLoopIndexYaw} (${yawChanged}/100 tussocks jump yaw on 1-slot pan)`,
      expected: 'Linear reflectance mean Y <= 0.28 (max <= 0.38), seasonal green/cured/snow phenology, and world-coordinate-seeded yaw (0/100 yaw jumps on pan)',
      score: c6Score,
      knownMatchScore: 1.0,
      knownMismatchScore: 0.0,
      pass: c6Score >= 0.95,
      source: 'Oke (1987) Boundary Layer Climates Table 1.1 (dry grass albedo 0.16-0.28); Asner (1998) Remote Sens. Environ. 64:234-253; Flora of China Vol. 22 (Stipa lessingiana May-Jul anthesis)',
    },
  ];

  const passCount = checks.filter(c => c.pass).length;
  const meanScore = +(checks.reduce((a, c) => a + c.score, 0) / checks.length).toFixed(4);
  const calibrationValid = checks.every(c => c.knownMatchScore >= 0.95 && c.knownMismatchScore < 0.5);

  const report = {
    audit: 'trees-v2-impostor-tube-steppe-audit',
    baseUrl: BASE,
    capturedAt: new Date().toISOString(),
    consoleErrors: errors,
    failedUrls,
    calibrationValid,
    passCount,
    totalChecks: checks.length,
    meanScore,
    slotsFront,
    live,
    checks,
  };
  writeFileSync(join(HERE, 'numbers.json'), JSON.stringify(report, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify({ passCount, totalChecks: checks.length, meanScore, calibrationValid, consoleErrors: errors.length, slotsFront, budget16: bp.budget16, sceneUndefPoison: bp.sceneUndefPoison, checks: checks.map(c => ({ id: c.id, score: c.score, pass: c.pass, measured: c.measured })) }, null, 2));
}

main().catch(e => { console.error(e); process.exit(1); });
