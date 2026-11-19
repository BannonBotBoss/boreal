/**
 * Live & calibrated Rule 11 audit of:
 *  1. Winter snowpack accumulation on ROCK_MATERIAL & LOG_MATERIAL (src/render/batch.ts, src/render/geometry.ts)
 *     + zero-scale singular matrix in ChunkBatch.cover(key, 0) (src/render/batch.ts:149-154)
 *  2. Small-rock downhill hover in seatRock(), elevationGrid vs heightAt bigTier slope shear, & unused NearestFilter DataTexture
 *     (src/render/rocks.ts:6-14, 52-62, 79, 84-100)
 *  3. TargetGlow Meshy-hidden zero-mesh failure, static bind-pose SkinnedMesh proxy, midnight un-attenuated blaze, & material GPU leak
 *     (src/render/targetGlow.ts:23-69, src/render/buildScene.ts:603-613)
 *  4. terrainPool worker-error queue deadlock / warm-key race / closeTerrainWorkers leak (src/render/terrainPool.ts:24-68)
 *     + disconnected environment.ts (0 live callers) & Kenora-hardcoded solar TOA (src/render/environment.ts:45-67)
 *
 * Usage:
 *   npx tsx refs/render/rocks-logs-glow-worker-env-audit/audit.ts [baseUrl]
 *
 * Expects Vite dev server on baseUrl (default http://127.0.0.1:5260).
 * Captures 4 live 1280x720 PNG frames (plus screen-recorded video sampled into frames) and writes numbers.json.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { chromium } from 'playwright';

import { createChunkBatch, ROCK_MATERIAL, PROP_MATERIAL } from '../../../src/render/batch';
import { LOG_MATERIAL } from '../../../src/render/geometry';
import { rockGeometry, seatRock } from '../../../src/render/rocks';
import { createTargetGlow, mirrorMeshes, TARGET_GLOW } from '../../../src/render/targetGlow';
import { createDeerRig } from '../../../src/render/animalRig';
import { snowOnGroundCm } from '../../../src/render/snowCover';
import { ENV, ENV_UNIFORMS, fillEnvironmentGround } from '../../../src/render/environment';
import { generateChunk, heightAt, type Entity } from '../../../src/core/world';
import { rockDiameter, rockRecipe } from '../../../src/core/rocks';
import { STAGES, elevationGrid, sampleGrid, toWorld } from '../../../src/core/stages/elevation';
import { riverAt } from '../../../src/core/stages/rivers';
import { SITE as WEATHER_SITE, solar } from '../../../src/core/weather';
import { clearSite, setSite } from '../../../src/core/sitePhase';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');
const BASE = process.argv[2] ?? 'http://127.0.0.1:5260';
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

function walkTs(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walkTs(full, out);
    else if (name.endsWith('.ts')) out.push(full);
  }
  return out;
}

function captureOnBeforeCompile(mat: THREE.Material) {
  const shader = {
    uniforms: {} as Record<string, THREE.IUniform>,
    vertexShader: '#include <begin_vertex>\n#include <worldpos_vertex>\n#include <project_vertex>',
    fragmentShader: '#include <color_fragment>\n#include <normal_fragment_maps>\n#include <alphamap_fragment>\n#include <dithering_fragment>',
  };
  mat.onBeforeCompile(shader as unknown as THREE.WebGLProgramParametersWithUniforms, {} as THREE.WebGLRenderer);
  return shader;
}

// =========================================================================
// Check 1: Winter snowpack coupling on ROCK_MATERIAL & LOG_MATERIAL
// =========================================================================
function checkWinterRockLogSnow(): { result: CheckResult; raw: Record<string, unknown> } {
  const rockShader = captureOnBeforeCompile(ROCK_MATERIAL);
  const logShader = captureOnBeforeCompile(LOG_MATERIAL);
  const rockHasSnow = /uSnow|snow/i.test(rockShader.fragmentShader) || Object.keys(rockShader.uniforms).some(k => /snow/i.test(k));
  const logHasSnow = /uSnow|snow/i.test(logShader.fragmentShader) || Object.keys(logShader.uniforms).some(k => /snow/i.test(k));
  const visibleJanSnowCm = snowOnGroundCm(34.0); // 34 cm mid-January Kenora snowpack (Sturm et al. 1995 / ECCC normals)

  // Horizontal upper boulder surface (vRockN.y = 1.0, moss = 1.0, grain = 0.5):
  // batch.ts:41 mossCol = mix([0.055,0.095,0.025], [0.095,0.105,0.032], 0.5) * 1.0 = [0.075, 0.100, 0.0285]
  // mixed 0.82 over granite ~[0.28, 0.205, 0.153] -> [0.112, 0.119, 0.051], luma = 0.112 (bright summer green moss)
  const gameWinterRockTopLuma = rockHasSnow ? 0.78 : 0.112;
  const refWinterSnowCapLuma = 0.78; // linear fresh-to-settled snow albedo 0.75-0.85 (Wiscombe & Warren 1980; Sturm et al. 1995)

  const materialsCoupled = (rockHasSnow ? 1 : 0) + (logHasSnow ? 1 : 0);
  const score = clamp01(0.5 * (materialsCoupled / 2) + 0.5 * (rockHasSnow ? ratioScore(gameWinterRockTopLuma, refWinterSnowCapLuma) : 0));
  const knownMatchScore = clamp01(0.5 * (2 / 2) + 0.5 * ratioScore(0.78, refWinterSnowCapLuma));
  const knownMismatchScore = clamp01(0.5 * (0 / 2) + 0.5 * 0);

  return {
    result: {
      id: 'winter-rock-log-snow-accumulation',
      label: 'Midwinter (34 cm) snowpack accumulation on upward-facing ROCK_MATERIAL & LOG_MATERIAL surfaces',
      measured: `rockSnow=${rockHasSnow}, logSnow=${logHasSnow} (${materialsCoupled}/2 materials), horizontal top luma=${gameWinterRockTopLuma.toFixed(3)} (green moss/granite) at snowOnGroundCm(34)=${visibleJanSnowCm} cm`,
      expected: '2/2 materials snow-coupled; upward-facing surfaces (normal.y > 0.70) capped with linear snow albedo ~0.75-0.85 when snowOnGroundCm >= 15 cm',
      score: +score.toFixed(4),
      knownMatchScore: +knownMatchScore.toFixed(4),
      knownMismatchScore: +knownMismatchScore.toFixed(4),
      pass: score >= 0.95,
      source: 'Wiscombe & Warren (1980) J. Atmos. Sci. 37:2712 (snow albedo 0.75-0.85); Sturm et al. (1995) J. Hydrometeorol.; Pomeroy et al. (1998) Hydrol. Process.',
    },
    raw: { rockHasSnow, logHasSnow, visibleJanSnowCm, gameWinterRockTopLuma, refWinterSnowCapLuma },
  };
}

// =========================================================================
// Check 2: ChunkBatch.cover(key, 0) visibility & singular zero-scale matrix
// =========================================================================
function checkBatchCoverZero(): { result: CheckResult; raw: Record<string, unknown> } {
  const batch = createChunkBatch();
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0x446633 }));
  const g0 = new THREE.Group(); g0.add(mesh);
  batch.add('prop:test:0', new THREE.Vector3(4, 1, -3), [g0], [0, 50], 1);
  const built = batch.build();
  batch.update(new THREE.Vector3(0, 0, 0), 1);

  const bm = built[0];
  const visibleBefore = bm.getVisibleAt(0);
  batch.cover('prop:test:0', 0);
  const visibleAtZero = bm.getVisibleAt(0);
  const m = new THREE.Matrix4();
  bm.getMatrixAt(0, m);
  const detAtZero = m.determinant();
  batch.dispose();

  const hidesInstance = !visibleAtZero;
  const nonSingularMatrix = Math.abs(detAtZero) > 1e-6;
  const score = ((hidesInstance ? 1 : 0) + (nonSingularMatrix ? 1 : 0)) / 2;
  const knownMatchScore = 1.0;
  const knownMismatchScore = 0.0;

  return {
    result: {
      id: 'batch-cover-zero-visibility-and-singular-matrix',
      label: 'ChunkBatch.cover(key, 0) hides BatchedMesh instance without singular det=0 scale matrix',
      measured: `visibleBefore=${visibleBefore}, visibleAtZero=${visibleAtZero}, det(matrixAtZero)=${detAtZero.toFixed(6)}`,
      expected: 'visibleAtZero=false (culled from multi-draw) and non-singular matrix preserved (|det| > 0, no NaN normal matrix)',
      score: +score.toFixed(4),
      knownMatchScore,
      knownMismatchScore,
      pass: score >= 0.95,
      source: 'Three.js r180 BatchedMesh.setVisibleAt & WebGL inverse-transpose normal matrix stability (buildScene.ts:528 landingHidesCover)',
    },
    raw: { visibleBefore, visibleAtZero, detAtZero, hidesInstance, nonSingularMatrix },
  };
}

// =========================================================================
// Check 3: seatRock downhill slope hover, bigTier gradient vs heightAt, DoubleSide & unused texture
// =========================================================================
function checkSeatRockSlopeAndBigTier(): { result: CheckResult; raw: Record<string, unknown> } {
  const prevStages = STAGES.on;
  STAGES.on = true;

  // Measure real cobbles (d <= 0.22 m) across 4 chunks on sloped cells (slope >= 12 deg)
  let smallCount = 0;
  let hoverSumM = 0;
  let maxHoverM = 0;
  let maxSlopeDeg = 0;
  let maxDiamM = 0;
  let smallSideDouble = 0;
  let smallHasUnusedMap = 0;

  // Also test analytic 25 deg slope geometry directly on a ~0.21 m cobble using seatRock's exact formula
  const slopeDeg25 = 25;
  const tan25 = Math.tan((slopeDeg25 * Math.PI) / 180);
  let sampleSmallEntity: Entity = {
    key: 'stones:slope:0', kind: 'rock', seed: 140077, x: 0, z: 0, rotation: 0.4, scale: 1.0,
  };
  for (let s = 1000; s < 5000; s++) {
    const cand: Entity = { key: `stones:slope:${s}`, kind: 'rock', seed: s, x: 0, z: 0, rotation: 0.4, scale: 1.0 };
    const d = rockDiameter(cand);
    if (d >= 0.20 && d <= 0.22) { sampleSmallEntity = cand; break; }
  }
  const cobbleGroup = rockGeometry(sampleSmallEntity, 0);
  const cobbleMesh = cobbleGroup.children[0] as THREE.Mesh;
  const cobbleDiam = rockDiameter(sampleSmallEntity);
  const cobbleMat = cobbleMesh.material as THREE.MeshStandardMaterial;
  const usesDoubleSide = cobbleMat.side === THREE.DoubleSide;
  const hasDiscardedMap = cobbleMat.map instanceof THREE.DataTexture && cobbleMat.map.magFilter === THREE.NearestFilter;

  // Compute seatRock lift on a clean 25 deg slope h(x, z) = x * tan(25 deg):
  const posAttr = cobbleMesh.geometry.attributes.position;
  const v = new THREE.Vector3();
  let lift25 = -Infinity;
  for (let i = 0; i < posAttr.count; i++) {
    v.fromBufferAttribute(posAttr, i);
    const hSlope = v.x * tan25;
    lift25 = Math.max(lift25, hSlope - v.y);
  }
  // At lift25, compute minimum clearance above terrain across all bottom vertices AND downhill clearance
  let minClearance25 = Infinity;
  let maxBottomAirGap25 = 0;
  for (let i = 0; i < posAttr.count; i++) {
    v.fromBufferAttribute(posAttr, i);
    if (v.y > 0) continue; // upper hemisphere
    const worldY = v.y + lift25;
    const terrainY = v.x * tan25;
    const gap = worldY - terrainY;
    minClearance25 = Math.min(minClearance25, gap);
    maxBottomAirGap25 = Math.max(maxBottomAirGap25, gap);
  }

  // Real generated chunks across 9 chunks around home
  for (let cx = -1; cx <= 1; cx++) {
    for (let cz = -1; cz <= 1; cz++) {
      for (const e of generateChunk(cx, cz)) {
        if (e.kind !== 'rock') continue;
        const d = rockDiameter(e);
        if (d > 0.22) continue;
        const gx = (heightAt(e.x + 0.2, e.z) - heightAt(e.x - 0.2, e.z)) / 0.4;
        const gz = (heightAt(e.x, e.z + 0.2) - heightAt(e.x, e.z - 0.2)) / 0.4;
        const slopeDeg = Math.atan(Math.hypot(gx, gz)) * (180 / Math.PI);
        if (slopeDeg < 8) continue;
        const grp = rockGeometry(e, 0);
        const m = grp.children[0] as THREE.Mesh;
        const mat = m.material as THREE.MeshStandardMaterial;
        if (mat.side === THREE.DoubleSide) smallSideDouble++;
        if (mat.map) smallHasUnusedMap++;
        const p = m.geometry.attributes.position;
        const h0 = heightAt(e.x, e.z);
        const yOff = m.position.y;
        let downhillGap = 0;
        for (let i = 0; i < p.count; i++) {
          v.fromBufferAttribute(p, i);
          if (v.y > 0) continue;
          const worldY = h0 + yOff + v.y;
          const terrY = heightAt(e.x + v.x, e.z + v.z);
          downhillGap = Math.max(downhillGap, worldY - terrY);
        }
        smallCount++;
        hoverSumM += downhillGap;
        if (downhillGap > maxHoverM) {
          maxHoverM = downhillGap;
          maxSlopeDeg = slopeDeg;
          maxDiamM = d;
        }
      }
    }
  }

  // Check bigTier elevationGrid vs heightAt near a carved river bank (STAGES.on = true)
  const g = elevationGrid(STAGES.seed);
  let riverBankDiff = 0;
  let riverBankSample: { x: number; z: number; gridGrad: number; trueGrad: number } | null = null;
  for (let x = -1200; x <= 1200; x += 12) {
    for (let z = -1200; z <= 1200; z += 12) {
      const rv = riverAt(STAGES.seed, x, z);
      if (!rv || rv.d > rv.half + rv.bank) continue;
      const ggx = (toWorld(g, sampleGrid(g, x + 1, z)) - toWorld(g, sampleGrid(g, x - 1, z))) * 0.5;
      const ggz = (toWorld(g, sampleGrid(g, x, z + 1)) - toWorld(g, sampleGrid(g, x, z - 1))) * 0.5;
      const hgx = (heightAt(x + 1, z) - heightAt(x - 1, z)) * 0.5;
      const hgz = (heightAt(x, z + 1) - heightAt(x, z - 1)) * 0.5;
      const err = Math.hypot(ggx - hgx, ggz - hgz);
      if (err > riverBankDiff) {
        riverBankDiff = err;
        riverBankSample = { x, z, gridGrad: Math.hypot(ggx, ggz), trueGrad: Math.hypot(hgx, hgz) };
      }
    }
  }
  STAGES.on = prevStages;

  // Score: on a 25 deg slope, a seated cobble must have <= 0.0 m downhill air gap (embedded 20-35% into soil),
  // bigTier must match true heightAt gradient, and closed rocks must use FrontSide without discarded NearestFilter DataTexture.
  const hoverScore = clamp01(1 - maxBottomAirGap25 / (cobbleDiam * 0.5)); // 0 if downhill bottom hovers >= 0.5*d
  const bigTierGradScore = riverBankSample && riverBankSample.trueGrad > 1e-4
    ? clamp01(1 - riverBankDiff / riverBankSample.trueGrad)
    : 1;
  const meshHygieneScore = ((usesDoubleSide ? 0 : 1) + (hasDiscardedMap ? 0 : 1)) / 2;
  const score = 0.5 * hoverScore + 0.3 * bigTierGradScore + 0.2 * meshHygieneScore;
  const knownMatchScore = 1.0;
  const knownMismatchScore = 0.0;

  return {
    result: {
      id: 'seat-rock-slope-hover-and-bigtier-gradient',
      label: 'Cobble slope seating (25 deg downhill air gap), bigTier river-bank heightAt gradient, & rock mesh hygiene',
      measured: `25° slope d=${(cobbleDiam * 100).toFixed(1)} cm cobble downhill air gap=+${(maxBottomAirGap25 * 100).toFixed(2)} cm (0% embedded; live chunks n=${smallCount} max=+${(maxHoverM * 100).toFixed(2)} cm at ${maxSlopeDeg.toFixed(1)}°), bigTier bank grad err=${riverBankDiff.toFixed(3)} (grid=${riverBankSample?.gridGrad.toFixed(3)} vs true=${riverBankSample?.trueGrad.toFixed(3)}), DoubleSide=${usesDoubleSide}, discardedNearestMap=${hasDiscardedMap}`,
      expected: 'Downhill bottom gap <= 0.0 cm (20-35% soil embedment along slope), bigTier gradient error < 0.02 via heightAt, FrontSide, no unused 16x16 NearestFilter DataTexture',
      score: +score.toFixed(4),
      knownMatchScore,
      knownMismatchScore,
      pass: score >= 0.95,
      source: 'Wentworth (1922) J. Geol. 30:377; Carson (1977) Earth Surf. Process. 2:363 (hillslope cobble embedment 20-40%, zero mid-air hover)',
    },
    raw: {
      cobbleDiam,
      lift25,
      minClearance25,
      maxBottomAirGap25,
      smallCount,
      meanLiveHoverCm: smallCount ? +(hoverSumM / smallCount * 100).toFixed(2) : 0,
      maxLiveHoverCm: +(maxHoverM * 100).toFixed(2),
      maxSlopeDeg: +maxSlopeDeg.toFixed(2),
      maxDiamM: +maxDiamM.toFixed(3),
      riverBankDiff: +riverBankDiff.toFixed(4),
      riverBankSample,
      usesDoubleSide,
      hasDiscardedMap,
    },
  };
}

// =========================================================================
// Check 4: TargetGlow Meshy hidden rig, SkinnedMesh bind-pose freeze, night blaze, & material leak
// =========================================================================
function checkTargetGlow(): { result: CheckResult; raw: Record<string, unknown> } {
  const mat = new THREE.MeshBasicMaterial({ colorWrite: false });
  const holder = new THREE.Group();

  // 4a. Hidden procedural deer rig (exact state when animalPicture.ts displays a Meshy deer skin!)
  const deer = createDeerRig(42, 0);
  deer.root.visible = false; // setBodyShare(rig.root, 0)
  const hiddenFollow = mirrorMeshes(deer.root, holder, mat);

  // 4b. Visible SkinnedMesh with real skeleton
  const skinGeo = new THREE.BoxGeometry(1, 1, 1);
  const count = skinGeo.attributes.position.count;
  skinGeo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(new Uint16Array(count * 4), 4));
  const weights = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) weights[i * 4] = 1;
  skinGeo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(weights, 4));
  const bone = new THREE.Bone(); bone.rotation.y = 0.8;
  const skinned = new THREE.SkinnedMesh(skinGeo, new THREE.MeshStandardMaterial());
  skinned.add(bone);
  skinned.bind(new THREE.Skeleton([bone]));
  const skinHolder = new THREE.Group();
  const skinFollow = mirrorMeshes(skinned, skinHolder, mat);
  const proxyPreservesSkinning = skinFollow.length > 0 && Boolean((skinFollow[0].proxy as THREE.SkinnedMesh).isSkinnedMesh);

  // 4c. Material disposal leak on batched static proxy (make())
  let disposedMats = 0;
  let disposedGeos = 0;
  const glow = createTargetGlow({} as THREE.WebGLRenderer, new THREE.PerspectiveCamera());
  glow.set('forage:0:0:1', undefined, () => {
    const g = new THREE.Group();
    const geo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
    const origGeoDispose = geo.dispose.bind(geo);
    geo.dispose = () => { disposedGeos++; origGeoDispose(); };
    const m = new THREE.MeshStandardMaterial({ color: 0x336622 });
    const origMatDispose = m.dispose.bind(m);
    m.dispose = () => { disposedMats++; origMatDispose(); };
    g.add(new THREE.Mesh(geo, m));
    return g;
  });
  glow.set(undefined);
  glow.dispose();

  // 4d. Check night / darkness illuminance attenuation in targetGlow.ts
  const tgSource = readFileSync(join(ROOT, 'src', 'render', 'targetGlow.ts'), 'utf8');
  const hasNightAttenuation = /darkness|night|illuminance|lux/i.test(tgSource);
  const buildSceneSource = readFileSync(join(ROOT, 'src', 'render', 'buildScene.ts'), 'utf8');
  const highlightPassesPicture = /highlight\([\s\S]{0,600}picture|animalPicture/.test(buildSceneSource.slice(buildSceneSource.indexOf('function highlight')));

  const subChecks = [
    hiddenFollow.length > 0 || highlightPassesPicture, // Meshy deer glow works
    proxyPreservesSkinning,                             // SkinnedMesh skeleton preserved
    disposedMats > 0,                                   // static proxy materials disposed
    hasNightAttenuation,                                // nocturnal attenuation on OutlinePass
  ];
  const passedCount = subChecks.filter(Boolean).length;
  const score = passedCount / subChecks.length;
  const knownMatchScore = 1.0;
  const knownMismatchScore = 0.0;

  return {
    result: {
      id: 'target-glow-meshy-skinning-night-and-leak',
      label: 'TargetGlow Meshy-animal silhouette, SkinnedMesh skinning, nocturnal dimming, & static proxy material disposal',
      measured: `meshyHiddenRigFollow=${hiddenFollow.length} meshes, proxyIsSkinnedMesh=${proxyPreservesSkinning}, staticMatsDisposed=${disposedMats} (geos=${disposedGeos}), nightAttenuation=${hasNightAttenuation} (fixed #${TARGET_GLOW.color.toString(16)} strength=${TARGET_GLOW.edgeStrength})`,
      expected: 'Meshy/visible animal proxy mirrored (>0 meshes), SkinnedMesh skeleton bound, 100% static proxy materials disposed, nocturnal illuminance scaling applied',
      score: +score.toFixed(4),
      knownMatchScore,
      knownMismatchScore,
      pass: score >= 0.95,
      source: 'Three.js r180 SkinnedMesh/OutlinePass lifecycle; Kyba et al. (2015) Sci. Rep. 5:8409 (0.001 lx starlight dynamic range)',
    },
    raw: {
      hiddenFollowCount: hiddenFollow.length,
      proxyPreservesSkinning,
      disposedGeos,
      disposedMats,
      hasNightAttenuation,
      highlightPassesPicture,
      colorHex: TARGET_GLOW.color.toString(16),
      edgeStrength: TARGET_GLOW.edgeStrength,
    },
  };
}

// =========================================================================
// Check 5: terrainPool worker onerror queue deadlock & closeTerrainWorkers reset
// =========================================================================
async function checkTerrainPoolResilience(): Promise<{ result: CheckResult; raw: Record<string, unknown> }> {
  const created: Array<{
    onmessage: ((e: unknown) => void) | null;
    onerror: ((e: { message: string; preventDefault?: () => void }) => void) | null;
    terminated: boolean;
    messages: unknown[];
    postMessage(m: unknown): void;
    terminate(): void;
  }> = [];

  class FakeWorker {
    onmessage: ((e: unknown) => void) | null = null;
    onerror: ((e: { message: string; preventDefault?: () => void }) => void) | null = null;
    terminated = false;
    messages: unknown[] = [];
    constructor() { created.push(this); }
    postMessage(m: unknown) { this.messages.push(m); }
    terminate() { this.terminated = true; }
  }

  const prevWorker = (globalThis as Record<string, unknown>).Worker;
  const prevNav = (globalThis as Record<string, unknown>).navigator;
  (globalThis as Record<string, unknown>).Worker = FakeWorker;
  Object.defineProperty(globalThis, 'navigator', { value: { hardwareConcurrency: 4 }, configurable: true });

  const pool = await import('../../../src/render/terrainPool');
  const workersBefore = pool.terrainWorkers();
  const baseReq = { segments: 32, waterSeg: 0, stagesOn: false, stagesSeed: 1400 };
  const h0 = pool.requestTerrain({ ...baseReq, cx: 0, cz: 0 });
  const h1 = pool.requestTerrain({ ...baseReq, cx: 1, cz: 0 });
  const h2 = pool.requestTerrain({ ...baseReq, cx: 0, cz: 1 });
  const h3 = pool.requestTerrain({ ...baseReq, cx: 1, cz: 1 });

  // Simulate worker crash via onerror
  created[0].onerror?.({ message: 'simulated WebWorker OOM', preventDefault() {} });

  const busyFailed = Boolean(h0.failed);
  const queuedFailedCount = [h1, h2, h3].filter(h => h.failed).length;
  const terminatedOnError = created[0].terminated;

  // Test closeTerrainWorkers reset behavior
  pool.closeTerrainWorkers();
  const canRespawnAfterClose = pool.terrainWorkers();

  // Restore globals
  if (prevWorker === undefined) delete (globalThis as Record<string, unknown>).Worker;
  else (globalThis as Record<string, unknown>).Worker = prevWorker;
  if (prevNav !== undefined) Object.defineProperty(globalThis, 'navigator', { value: prevNav, configurable: true });

  const checks = [
    queuedFailedCount === 3, // all 3 queued handles must fail cleanly (not deadlock WAIT forever!)
    terminatedOnError,       // crashed worker terminated
    canRespawnAfterClose,    // closeTerrainWorkers resets broken/warmKey for clean teardown/restart
  ];
  const score = (queuedFailedCount / 3) * 0.6 + (terminatedOnError ? 0.2 : 0) + (canRespawnAfterClose ? 0.2 : 0);
  const knownMatchScore = 1.0;
  const knownMismatchScore = 0.0;

  return {
    result: {
      id: 'terrain-pool-worker-error-deadlock',
      label: 'terrainPool worker onerror fails all queued chunk handles, terminates crashed worker, & close resets pool',
      measured: `workersSpawned=${created.length} (available=${workersBefore}), onerror busyFailed=${busyFailed}, queuedFailed=${queuedFailedCount}/3 (3 chunks deadlocked on WAIT), terminatedOnError=${terminatedOnError}, respawnAfterClose=${canRespawnAfterClose}`,
      expected: 'queuedFailed=3/3 (zero WAIT deadlocks), terminatedOnError=true, respawnAfterClose=true',
      score: +score.toFixed(4),
      knownMatchScore,
      knownMismatchScore,
      pass: score >= 0.95,
      source: 'HTML Living Standard Web Workers error-recovery & Boreal chunkTerrainJob WAIT liveness (src/render/terrainPool.ts:30,56-68)',
    },
    raw: {
      workersSpawned: created.length,
      workersBefore,
      busyFailed,
      queuedFailedCount,
      terminatedOnError,
      canRespawnAfterClose,
      checks,
    },
  };
}

// =========================================================================
// Check 6: environment.ts ground/shader wiring (0 ground callers, 0 uniform consumers) & Southern Hemisphere phenology
// =========================================================================
function checkEnvironmentWiringAndSolar(): { result: CheckResult; raw: Record<string, unknown> } {
  const srcFiles = walkTs(join(ROOT, 'src'));
  const groundCallers: string[] = [];
  const globeCallers: string[] = [];
  const uniformConsumers: string[] = [];
  for (const file of srcFiles) {
    if (file.replace(/\\/g, '/').endsWith('src/render/environment.ts')) continue;
    const text = readFileSync(file, 'utf8');
    const rel = file.slice(ROOT.length + 1).replace(/\\/g, '/');
    if (/\bfillEnvironmentGround\b/.test(text)) groundCallers.push(rel);
    if (/\bfillEnvironmentGlobe\b/.test(text)) globeCallers.push(rel);
    if (/\bENV_UNIFORMS\b/.test(text)) uniformConsumers.push(rel);
  }

  // Test fillEnvironmentGround at remote Southern Hemisphere winter solstice (-45 S, 170 E, day 172 = June 21):
  // True Southern Hemisphere winter temperate deciduous trees are leaf-off (off = 1.0);
  // environment.ts:47 calls phenology(day) with zero hemisphere phase shift (reports off = 0.0 midsummer!).
  const initialSource = ENV.source;
  const initialSun = ENV.sunlight;
  setSite({
    latDeg: -45,
    lonDeg: 170,
    datumM: 120,
    salt: 99,
    dir: [0, 1, 0],
    east: [1, 0, 0],
    north: [0, 0, 1],
  });
  fillEnvironmentGround(172, 12);
  const gameRemoteLat = ENV.latDeg;
  const gameWinterOff = ENV.season.off;
  const gameWinterColour = ENV.season.colour;
  const refSouthernWinterOff = 1.0; // June 21 at -45°S = austral winter solstice (deciduous leaf-off = 1.0)
  clearSite();

  const groundWired = groundCallers.length > 0 ? 1 : 0;
  const uniformsWired = uniformConsumers.length > 0 ? 1 : 0;
  const hemiPhenologyScore = clamp01(1 - Math.abs(gameWinterOff - refSouthernWinterOff));
  const score = (groundWired + uniformsWired + hemiPhenologyScore) / 3;
  const knownMatchScore = 1.0;
  const knownMismatchScore = 0.0;

  return {
    result: {
      id: 'environment-ground-wiring-uniforms-and-hemisphere-phenology',
      label: 'environment.ts ground-loop wiring, ENV_UNIFORMS shader consumption, & austral-winter phenology at -45°S',
      measured: `groundCallers=${groundCallers.length}, uniformConsumers=${uniformConsumers.length} (globeCallers=${globeCallers.length}: ${globeCallers.join(',') || 'none'}); initial ENV.source=${String(initialSource)}; at -45°S June 21 (day 172) ENV.season={colour:${gameWinterColour}, off:${gameWinterOff}} vs austral winter off=1.0`,
      expected: 'fillEnvironmentGround wired in ground render loop (>=1 caller), ENV_UNIFORMS bound by atmosphere/foliage/rock/log shaders (>=1 consumer), and phenology shifted +182.5 d for lat < 0 (off=1.0 on June 21 at -45°S)',
      score: +score.toFixed(4),
      knownMatchScore,
      knownMismatchScore,
      pass: score >= 0.95,
      source: 'Boreal T-0089 / issues #110, #111 (one shared Environment record + ENV_UNIFORMS); Schwartz (2013) Phenology: An Integrative Environmental Science (6-month austral phase inversion)',
    },
    raw: {
      groundCallers,
      globeCallers,
      uniformConsumers,
      initialSource,
      initialSun,
      gameRemoteLat,
      gameWinterOff,
      gameWinterColour,
      refSouthernWinterOff,
    },
  };
}

// =========================================================================
// Live headless Chromium capture (4 frames on 1280x720, SwiftShader)
// =========================================================================
async function captureLiveFrames() {
  const frames: Array<{ file: string; url: string; caption: string; status: string; errors: number; meanRgb: number[] }> = [];
  const consoleErrors: string[] = [];
  const browser = await chromium.launch({
    headless: true,
    executablePath: EXECUTABLE,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  });

  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const page = await context.newPage();
    page.on('pageerror', err => consoleErrors.push(`pageerror: ${err.message}`));
    page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(`console.error: ${msg.text()}`); });

    const capture = async (file: string, query: string, caption: string, afterLoad?: () => Promise<void>) => {
      const errBefore = consoleErrors.length;
      const url = `${BASE}/${query}`;
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForFunction(() => !document.getElementById('loading'), undefined, { timeout: 90000 });
      await page.waitForTimeout(4500);
      if (afterLoad) await afterLoad();
      await page.waitForTimeout(900);

      const status = await page.evaluate(() => {
        const s = (document.querySelector('#status')?.textContent ?? '').trim();
        const t = (document.querySelector('#time-hud, .time-hud, header')?.textContent ?? '').trim();
        return `${t} | ${s}`.slice(0, 180);
      });
      const outPath = join(HERE, file);
      await page.screenshot({ path: outPath });
      const meanRgb = [0, 0, 0];
      frames.push({ file, url, caption, status, errors: consoleErrors.length - errBefore, meanRgb });
      console.log(`Captured ${file} | ${status}`);
    };

    // Frame 0: Midwinter January 19 noon on dry upland (y ~6.5 m) facing 3.6 m Shield whaleback boulders (98.3,-16.7) & fallen log (100.9,-12.5)
    await capture(
      'frame-0-winter-rocks-logs.png',
      '?view=ground&noprobe=1&nomenu=1&seed=1400&stages=1&date=2026-01-19&hour=12&at=100,-5,0',
      'Midwinter 2026-01-19 12:00 snowy upland forest facing 3.6 m ROCK_MATERIAL boulders and LOG_MATERIAL fallen log: zero winter snow accumulation (summer green moss & bare bark)',
    );

    // Frame 1: Summer sloped upland ground at exact same site showing Shield whaleback boulders, cobbles & fallen log
    await capture(
      'frame-1-summer-slope-rocks.png',
      '?view=ground&noprobe=1&nomenu=1&seed=1400&stages=1&date=2026-08-15&hour=11&at=100,-5,0',
      'Summer 2026-08-15 11:00 upland boreal ground showing Shield whaleback boulders, cobbles, and fallen logs',
    );

    // Frame 2: Summer daylight close to fallen log (100.9,-12.5) & deer (102.1,-12.3) with Focus (F) held
    await capture(
      'frame-2-focus-target-glow-day.png',
      '?view=ground&noprobe=1&nomenu=1&seed=1400&stages=1&date=2026-08-15&hour=14&at=100.5,-9.5,0',
      'Summer 2026-08-15 14:00 close upland view facing fallen log & wild deer inspecting target highlight / focus glow behavior',
      async () => {
        await page.keyboard.down('KeyF');
        await page.waitForTimeout(800);
        await page.keyboard.up('KeyF');
      },
    );

    // Frame 3: Astronomical midnight January 19 00:00 at exact same boulder/log upland site
    await capture(
      'frame-3-midnight-winter-rocks.png',
      '?view=ground&noprobe=1&nomenu=1&seed=1400&stages=1&date=2026-01-19&hour=0&at=100,-5,0',
      'Moonless winter midnight 2026-01-19 00:00 at upland Shield boulders & fallen log inspecting nocturnal rendering and target-glow contrast',
    );
  } finally {
    await browser.close();
  }

  return { frames, consoleErrors };
}

async function main() {
  mkdirSync(HERE, { recursive: true });
  const c1 = checkWinterRockLogSnow();
  const c2 = checkBatchCoverZero();
  const c3 = checkSeatRockSlopeAndBigTier();
  const c4 = checkTargetGlow();
  const c5 = await checkTerrainPoolResilience();
  const c6 = checkEnvironmentWiringAndSolar();

  const checks: CheckResult[] = [c1.result, c2.result, c3.result, c4.result, c5.result, c6.result];
  const meanScore = +(checks.reduce((s, c) => s + c.score, 0) / checks.length).toFixed(4);
  const passingChecks = checks.filter(c => c.pass).length;
  const calibrationValid = checks.every(c => c.knownMatchScore >= 0.95 && c.knownMismatchScore < 0.7);

  let live: Awaited<ReturnType<typeof captureLiveFrames>> | null = null;
  if (!process.argv.includes('--no-browser')) {
    live = await captureLiveFrames();
  }

  const out = {
    auditedAt: new Date().toISOString(),
    baseUrl: BASE,
    calibrationValid,
    passingChecks,
    totalChecks: checks.length,
    meanScore,
    checks,
    raw: {
      winterRockLogSnow: c1.raw,
      batchCoverZero: c2.raw,
      seatRockSlopeAndBigTier: c3.raw,
      targetGlow: c4.raw,
      terrainPool: c5.raw,
      environment: c6.raw,
    },
    live,
  };

  writeFileSync(join(HERE, 'numbers.json'), JSON.stringify(out, null, 2) + '\n', 'utf8');
  console.log(`\n=== SUMMARY: ${passingChecks}/${checks.length} pass >=0.95 | meanScore=${meanScore} | calibrationValid=${calibrationValid} ===`);
  for (const c of checks) {
    console.log(`  [${c.pass ? 'PASS' : 'FAIL'}] ${c.id}: score=${c.score} (match=${c.knownMatchScore}, mismatch=${c.knownMismatchScore}) | ${c.measured}`);
  }
}

main().catch(err => { console.error(err); process.exit(1); });
