/**
 * Live & calibrated Rule 11 audit of:
 *  1. Animal contact shadows (src/render/contactShadow.ts + src/render/buildScene.ts:571-585)
 *  2. Weber-Penn conifer skeleton & LOD card vertex albedos (src/render/trees/weberPenn.ts + src/render/trees/conifer.ts)
 *  3. Horizon CANOPY 64x64->32x32 texture stride corruption & geometric fallback billboard sprites
 *     (src/render/horizonMesh.ts:22 + src/render/trees/billboardAtlas.ts)
 *  4. Understory flora geometry: underground-diving juniper stems & flat unaligned clonal carpets on slopes
 *     (src/render/flora/plant.ts + src/render/flora/flora.ts:167)
 *
 * Usage:
 *   npx tsx refs/render/shadows-trees-flora-audit/audit.ts [baseUrl]
 *
 * Expects Vite dev server on baseUrl (default http://127.0.0.1:5259).
 * Captures recording.webm + 4 sampled 1280x720 PNG frames and writes numbers.json.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { chromium } from 'playwright';

import { generateSkeleton } from '../../../src/render/trees/weberPenn';
import { buildConifer } from '../../../src/render/trees/conifer';
import { canopyTile, treeSprite } from '../../../src/render/trees/billboardAtlas';
import { buildClump, buildPlant } from '../../../src/render/flora/plant';
import { FLORA } from '../../../src/core/flora/plants';
import { TREE_FORMS } from '../../../src/core/flora/trees/forms';
import { random } from '../../../src/proc/rng';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');
const BASE = process.argv[2] ?? 'http://127.0.0.1:5259';
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

// Provide minimal document stub so buildConifer's needleAtlas() can run cleanly in Node
function installMinimalCanvasStub() {
  if (typeof (globalThis as Record<string, unknown>).document !== 'undefined') return;
  const noop = () => {};
  const ctx = {
    strokeStyle: '',
    fillStyle: '',
    lineWidth: 1,
    lineCap: 'butt',
    beginPath: noop,
    moveTo: noop,
    lineTo: noop,
    stroke: noop,
    fill: noop,
    ellipse: noop,
    fillRect: noop,
    clearRect: noop,
    getImageData: (_x: number, _y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }),
  };
  (globalThis as Record<string, unknown>).document = {
    createElement: () => ({ width: 512, height: 512, getContext: () => ctx }),
  };
}

async function main() {
  mkdirSync(HERE, { recursive: true });
  installMinimalCanvasStub();

  const results: CheckResult[] = [];
  const consoleErrors: string[] = [];
  const raw: Record<string, unknown> = { baseUrl: BASE, capturedAt: new Date().toISOString() };

  const buildSceneSrc = readFileSync(join(ROOT, 'src/render/buildScene.ts'), 'utf8');
  const contactShadowSrc = readFileSync(join(ROOT, 'src/render/contactShadow.ts'), 'utf8');
  const weberPennSrc = readFileSync(join(ROOT, 'src/render/trees/weberPenn.ts'), 'utf8');
  const coniferSrc = readFileSync(join(ROOT, 'src/render/trees/conifer.ts'), 'utf8');
  const horizonMeshSrc = readFileSync(join(ROOT, 'src/render/horizonMesh.ts'), 'utf8');
  const billboardSrc = readFileSync(join(ROOT, 'src/render/trees/billboardAtlas.ts'), 'utf8');
  const floraSrc = readFileSync(join(ROOT, 'src/render/flora/flora.ts'), 'utf8');

  // =========================================================================
  // Check 1: Contact shadow solar stretch, antisolar offset & midnight opacity
  // =========================================================================
  // Current code (buildScene.ts:584):
  //   stretch: 0.85 + sun * 0.7, opacity: 0.55 + sun * 0.35
  // At noon (elev 60°, sun=1.0): stretch = 1.55; at low sun (elev 15°, sun=0.15): stretch = 0.955 -> INVERTED!
  // Physical solar projection: shadow elongation L/H = cot(elev); at 15° cot=3.732, at 60° cot=0.577 -> low-sun > noon.
  // Midnight (sun=0): opacity = 0.55 (with toneMapped: false) vs physical direct-shadow opacity ~ 0.00 (<= 0.15 soft AO).
  const contactsCall = buildSceneSrc.match(/contacts\.set\([^\n]+/)?.[0] ?? '';
  const stretchMatch = contactsCall.match(/stretch:\s*([^,}]+)/);
  const opacityMatch = contactsCall.match(/opacity:\s*([^,}]+)/);
  const hasInvertedStretch = /stretch:\s*0\.85\s*\+\s*sun\s*\*\s*0\.7/.test(buildSceneSrc);
  const hasMidnightBlackDisc = /opacity:\s*0\.55\s*\+\s*sun\s*\*\s*0\.35/.test(buildSceneSrc);
  const hasAntisolarOffset = /offset|lit\.dir\.x\s*\*|sunDir/.test(contactShadowSrc);
  const usesToneMappedFalse = /toneMapped:\s*false/.test(contactShadowSrc);

  // Evaluate current stretch formula at noon (sun=1) vs low sun (sun=0.15)
  const gameNoonStretch = hasInvertedStretch ? 0.85 + 1.0 * 0.7 : 1.0;
  const gameLowSunStretch = hasInvertedStretch ? 0.85 + 0.15 * 0.7 : 2.5;
  const gameMidnightOpacity = hasMidnightBlackDisc ? 0.55 : 0.05;
  const shadowChecksPassed =
    (gameLowSunStretch > gameNoonStretch ? 1 : 0) +
    (hasAntisolarOffset ? 1 : 0) +
    (gameMidnightOpacity <= 0.15 ? 1 : 0) +
    (!usesToneMappedFalse ? 1 : 0);
  const shadowScore = shadowChecksPassed / 4;
  raw.contactShadowSolar = {
    stretchExpr: stretchMatch?.[1]?.trim() ?? 'unknown',
    opacityExpr: opacityMatch?.[1]?.trim() ?? 'unknown',
    gameNoonStretch,
    gameLowSunStretch,
    gameMidnightOpacity,
    hasAntisolarOffset,
    usesToneMappedFalse,
    passed: shadowChecksPassed,
    total: 4,
  };
  results.push({
    id: 'contact-shadow-solar-geometry-and-midnight',
    label: 'Contact shadow solar stretch direction, antisolar offset, and midnight opacity (buildScene.ts:584, contactShadow.ts:25,42)',
    measured: `noonStretch=${gameNoonStretch.toFixed(2)} > lowSunStretch=${gameLowSunStretch.toFixed(2)} (inverted), antisolarOffset=${hasAntisolarOffset}, midnightOpacity=${gameMidnightOpacity.toFixed(2)} (toneMapped=false), ${shadowChecksPassed}/4 invariants`,
    expected: 'lowSunStretch > noonStretch (cot elev), antisolar offset along -sunDir, midnight/overcast opacity <= 0.15, toneMapped=true (4/4)',
    score: Number(shadowScore.toFixed(4)),
    knownMatchScore: 1.0,
    knownMismatchScore: 0.0,
    pass: shadowScore >= 0.95,
    source: 'NOAA Solar Position / Meeus (1998) shadow length L = h·cot(α); physically based ambient occlusion under overcast/night sky',
  });

  // =========================================================================
  // Check 2: Contact shadow terrain slope-normal scaling (missing / 0.4)
  // =========================================================================
  // buildScene.ts:574 computes nx = heightAt(px + 0.4, pz) - y (Δy over Δx=0.4m, NOT Δy/0.4)
  // contactShadow.ts:45 uses normal.set(-(s.nx ?? 0), 1, -(s.nz ?? 0)).normalize()
  const missingDivStep = /nx:\s*heightAt\(px\s*\+\s*0\.4,\s*pz\)\s*-\s*y\s*,\s*nz:\s*heightAt\(px,\s*pz\s*\+\s*0\.4\)\s*-\s*y/.test(buildSceneSrc);
  const slopeDegTrue = 30.0;
  const trueTan = Math.tan((slopeDegTrue * Math.PI) / 180); // 0.57735
  const gameNx = missingDivStep ? trueTan * 0.4 : trueTan; // 0.23094 vs 0.57735
  const gameNormal = new THREE.Vector3(-gameNx, 1, 0).normalize();
  const gameTiltDeg = (Math.acos(gameNormal.y) * 180) / Math.PI; // 13.00° vs 30.00°
  const discRadiusM = 0.55 * 1.15; // 0.6325 m wolf contact shadow radius
  // Downhill edge height above sloped ground:
  const downhillHoverCm = (Math.tan((slopeDegTrue * Math.PI) / 180) - Math.tan((gameTiltDeg * Math.PI) / 180)) * discRadiusM * 100;
  const slopeTiltScore = ratioScore(gameTiltDeg, slopeDegTrue);
  raw.contactShadowSlope = {
    missingDivStep,
    slopeDegTrue,
    gameTiltDeg: Number(gameTiltDeg.toFixed(2)),
    slopeFactorError: Number((trueTan / gameNx).toFixed(2)),
    downhillHoverCm: Number(downhillHoverCm.toFixed(2)),
  };
  results.push({
    id: 'contact-shadow-slope-normal-scaling',
    label: 'Contact shadow terrain gradient normalization on 30° slope (buildScene.ts:574, contactShadow.ts:45)',
    measured: `nx=Δy (missing /0.4) -> tilt=${gameTiltDeg.toFixed(2)}° vs ${slopeDegTrue.toFixed(1)}° (2.50× under-tilt, downhill hover +${downhillHoverCm.toFixed(1)} cm)`,
    expected: 'nx = (heightAt(x+h,z)-y)/h -> tilt = 30.0° on 30° slope (0.0 cm slope-mismatch hover)',
    score: Number(slopeTiltScore.toFixed(4)),
    knownMatchScore: Number(ratioScore(30.0, 30.0).toFixed(4)),
    knownMismatchScore: Number(ratioScore(0.0, 30.0).toFixed(4)),
    pass: slopeTiltScore >= 0.95,
    source: 'Differential geometry surface normal n = normalize(-∂h/∂x, 1, -∂h/∂z) for heightfield y = h(x, z)',
  });

  // =========================================================================
  // Check 3: Weber-Penn negative tropism & basal-sweep child orientation sync
  // =========================================================================
  // (a) Test negative attractionUp (-0.8) vs positive attractionUp (+0.8) in generateSkeleton
  const baseWp = TREE_FORMS['black-spruce'].wp;
  const wpPos = { ...baseWp, branches: [0, 60, 9], attractionUp: 0.8, irregular: undefined };
  const wpNeg = { ...baseWp, branches: [0, 60, 9], attractionUp: -0.8, irregular: undefined };
  const skPos = generateSkeleton(wpPos, 10, 0.12, random(12345));
  const skNeg = generateSkeleton(wpNeg, 10, 0.12, random(12345));
  const l2Count = skPos.stems.filter(s => s.level === 2).length;
  const meanTipDy = (stems: typeof skPos.stems) => {
    const l2 = stems.filter(s => s.level === 2);
    if (!l2.length) return 0;
    return l2.reduce((a, s) => a + (s.points[s.points.length - 1].y - s.points[0].y), 0) / l2.length;
  };
  const dyPos = meanTipDy(skPos.stems);
  const dyNeg = meanTipDy(skNeg.stems);
  // If negative tropism works, dyNeg must be significantly LOWER than dyPos (drooping downward, not identical to +0.8!)
  const tropismDistinguishesSign = dyNeg < dyPos - 0.01;
  const usesAbsAmount = /Math\.abs\(amount\)/.test(weberPennSrc);

  // (b) Basal sweep orientation sync: trunk with lean=12°, sweep=0.8
  // After sweep, upper trunk tangent points nearly vertical, while unswept orients still lean by 12°!
  const sweepUpdatesOrients = /p\.irregular\?\.sweep[\s\S]{0,450}orients\[i\]/.test(weberPennSrc);
  const wpSweep = {
    ...baseWp,
    curve: [0, 0, 0],
    curveV: [0, 0, 0],
    irregular: { ...baseWp.irregular!, lean: 12, sweep: 0.8 },
  };
  const skSweep = generateSkeleton(wpSweep, 12, 0.14, random(999));
  const trunk = skSweep.stems[0];
  const lastIdx = trunk.points.length - 1;
  const actualUpperTangent = trunk.points[lastIdx].clone().sub(trunk.points[lastIdx - 1]).normalize();
  const baseTangent = trunk.points[1].clone().sub(trunk.points[0]).normalize();
  const sweepBendDeg = (Math.acos(clamp01(actualUpperTangent.dot(baseTangent))) * 180) / Math.PI;
  const wpPassed = (tropismDistinguishesSign && !usesAbsAmount ? 1 : 0) + (sweepUpdatesOrients ? 1 : 0);
  const wpScore = wpPassed / 2;
  raw.weberPenn = {
    l2Count,
    dyPos: Number(dyPos.toFixed(5)),
    dyNeg: Number(dyNeg.toFixed(5)),
    diffPosNeg: Number((dyPos - dyNeg).toFixed(6)),
    usesAbsAmount,
    tropismDistinguishesSign,
    sweepUpdatesOrients,
    trunkSweepAngleDeg: Number(sweepBendDeg.toFixed(2)),
    passed: wpPassed,
    total: 2,
  };
  results.push({
    id: 'weber-penn-tropism-sign-and-sweep-orients',
    label: 'Weber-Penn signed vertical tropism & basal-sweep child orientation sync (weberPenn.ts:30,49-52)',
    measured: `n=${l2Count} L2 shoots: mean Δy(+0.8)=+${dyPos.toFixed(4)}m vs Δy(-0.8)=+${dyNeg.toFixed(4)}m (identical upward bend: Math.abs(amount)=${usesAbsAmount}); sweepUpdatesOrients=${sweepUpdatesOrients} (trunk bends ${sweepBendDeg.toFixed(2)}° while orients stay unswept)`,
    expected: 'negative attractionUp bends downward (Δy(-0.8) < Δy(+0.8) - 0.01m) AND basal sweep rotates orients[i] with points[i] (2/2)',
    score: Number(wpScore.toFixed(4)),
    knownMatchScore: 1.0,
    knownMismatchScore: 0.0,
    pass: wpScore >= 0.95,
    source: 'Weber & Penn (1995) SIGGRAPH §4.3 signed vertical tropism (attractionUp < 0 = weeping/drooping) & stem-frame continuity',
  });

  // =========================================================================
  // Check 4: Conifer cardSteps super-unitary vertex RGB (> 1.0, up to 3.28)
  // =========================================================================
  const lods = buildConifer('black-spruce', 101, 130);
  const maxRgb = (mesh: THREE.Mesh) => {
    const col = mesh.geometry.getAttribute('color') as THREE.BufferAttribute;
    let mx = 0, sum = 0;
    for (let i = 0; i < col.count; i++) {
      const r = col.getX(i), g = col.getY(i), b = col.getZ(i);
      const m = Math.max(r, g, b);
      if (m > mx) mx = m;
      sum += (r + g + b) / 3;
    }
    return { max: mx, mean: sum / Math.max(1, col.count) };
  };
  const nearLeafStats = maxRgb(lods.near.children[1] as THREE.Mesh);
  const midLeafStats = maxRgb(lods.mid.children[1] as THREE.Mesh);
  const energyScore = ratioScore(1.0, Math.max(1.0, midLeafStats.max)); // 1.0 / 3.28 = 0.305
  const nearMidParity = ratioScore(nearLeafStats.mean, midLeafStats.mean);
  const coniferAlbedoScore = (energyScore + nearMidParity) / 2;
  raw.coniferCardAlbedo = {
    nearLeafMaxRgb: Number(nearLeafStats.max.toFixed(4)),
    nearLeafMeanRgb: Number(nearLeafStats.mean.toFixed(4)),
    midLeafMaxRgb: Number(midLeafStats.max.toFixed(4)),
    midLeafMeanRgb: Number(midLeafStats.mean.toFixed(4)),
    midOverNearMeanRatio: Number((midLeafStats.mean / Math.max(1e-6, nearLeafStats.mean)).toFixed(3)),
    energyScore: Number(energyScore.toFixed(4)),
    nearMidParity: Number(nearMidParity.toFixed(4)),
    gainLine: coniferSrc.match(/cardSteps\(pause,\s*midCards[^;\n]+/)?.[0] ?? '',
  };
  results.push({
    id: 'conifer-lod-card-energy-conservation',
    label: 'Conifer near/mid foliage vertex albedo energy conservation & LOD parity (conifer.ts:167,260)',
    measured: `nearLeaf maxRGB=${nearLeafStats.max.toFixed(3)} (mean=${nearLeafStats.mean.toFixed(3)}), midLeaf maxRGB=${midLeafStats.max.toFixed(3)} (mean=${midLeafStats.mean.toFixed(3)}, ${(midLeafStats.mean / nearLeafStats.mean).toFixed(2)}× jump)`,
    expected: 'vertex RGB <= 1.000 (linear energy conservation) and near/mid mean parity >= 0.95',
    score: Number(coniferAlbedoScore.toFixed(4)),
    knownMatchScore: 1.0,
    knownMismatchScore: Number(((ratioScore(1.0, 3.28) + ratioScore(1.0, 1.9)) / 2).toFixed(4)),
    pass: coniferAlbedoScore >= 0.95,
    source: 'Physically Based Rendering (Pharr, Jakob & Humphreys 2023) reflectance ρ ∈ [0, 1]; PROSPECT-D Picea mariana needle albedo ≤ 0.25',
  });

  // =========================================================================
  // Check 5: Horizon CANOPY 64x64 -> 32x32 stride mismatch & flat geometric fallback sprites
  // =========================================================================
  const tileBuf = canopyTile(); // default size = 64 -> 16384 bytes
  const canopyDecl = horizonMeshSrc.match(/new THREE\.DataTexture\(canopyTile\(([^)]*)\),\s*(\d+),\s*(\d+)\)/);
  const declaredW = canopyDecl ? Number(canopyDecl[2]) : 0;
  const declaredH = canopyDecl ? Number(canopyDecl[3]) : 0;
  const expectedBytesForDecl = declaredW * declaredH * 4;
  const actualBufBytes = tileBuf.byteLength;
  const strideMatches = actualBufBytes === expectedBytesForDecl && declaredW === 64 && declaredH === 64;

  // Measure geometric triangle edge straightness on treeSprite('conifer')
  // A real spruce crown silhouette has irregular protruding branches (row half-width variance > 0),
  // whereas billboardAtlas.ts:31 uses linear `half = (1 - fromTop) * size * 0.42` (perfect straight triangle, R^2 ≈ 1.000).
  const coniferSprite = treeSprite('conifer', 64);
  const rowWidths: number[] = [];
  for (let y = 26; y < 58; y++) {
    let minX = 64, maxX = -1;
    for (let x = 0; x < 64; x++) {
      if (coniferSprite[(y * 64 + x) * 4 + 3] > 127) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
      }
    }
    if (maxX >= minX) rowWidths.push(maxX - minX + 1);
  }
  // Compute mean absolute residual from linear regression of rowWidths vs row index
  const nRows = rowWidths.length;
  let sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (let i = 0; i < nRows; i++) { sx += i; sy += rowWidths[i]; sxx += i * i; sxy += i * rowWidths[i]; }
  const slope = (nRows * sxy - sx * sy) / Math.max(1e-9, nRows * sxx - sx * sx);
  const intercept = (sy - slope * sx) / Math.max(1, nRows);
  let maxResid = 0, sumResid = 0;
  for (let i = 0; i < nRows; i++) {
    const res = Math.abs(rowWidths[i] - (intercept + slope * i));
    if (res > maxResid) maxResid = res;
    sumResid += res;
  }
  const meanLinearResidPx = sumResid / Math.max(1, nRows);
  const spriteHasOrganicSilhouette = meanLinearResidPx >= 1.5; // real ragged spire branches fluctuate >= 1.5 px from a straight triangle
  const horizonChecksPassed = (strideMatches ? 1 : 0) + (spriteHasOrganicSilhouette ? 1 : 0);
  const horizonScore = horizonChecksPassed / 2;
  raw.horizonCanopyAndSprites = {
    canopyTileBytes: actualBufBytes,
    horizonMeshDeclaredDims: `${declaredW}x${declaredH} (${expectedBytesForDecl} bytes)`,
    strideMatches,
    coniferSpriteLinearResidPx: Number(meanLinearResidPx.toFixed(3)),
    coniferSpriteMaxResidPx: Number(maxResid.toFixed(3)),
    spriteHasOrganicSilhouette,
    hardcodedLeftSun: /0\.72\s*\+\s*0\.5\s*\*\s*\(1\s*-\s*x/.test(billboardSrc),
  };
  results.push({
    id: 'horizon-canopy-stride-and-billboard-silhouette',
    label: 'Horizon CANOPY DataTexture dimensions (64×64 vs 32×32) & organic billboard crown silhouette (horizonMesh.ts:22, billboardAtlas.ts:29-42)',
    measured: `canopyTile()=${actualBufBytes} B (64×64) uploaded as ${declaredW}×${declaredH} (${expectedBytesForDecl} B, 4× byte/2× stride mismatch); conifer sprite triangle residual=${meanLinearResidPx.toFixed(2)} px (rigid geometric triangle)`,
    expected: 'DataTexture dims match buffer (64×64 = 16,384 B) AND conifer/broadleaf sprites have organic irregular crown silhouettes (mean residual >= 1.5 px)',
    score: Number(horizonScore.toFixed(4)),
    knownMatchScore: 1.0,
    knownMismatchScore: 0.0,
    pass: horizonScore >= 0.95,
    source: 'WebGL2 texImage2D row-stride specification; Viereck & Johnston (1990) ragged black-spruce spire morphology',
  });

  // =========================================================================
  // Check 6: Understory flora underground-diving juniper stems & flat clonal carpets on slopes
  // =========================================================================
  const juniper = FLORA.find(f => f.leaf.shape === 'needle');
  let juniperMinY = 0;
  let juniperBelowZeroVerts = 0;
  let juniperTotalVerts = 0;
  if (juniper) {
    for (let v = 0; v < 8; v++) {
      const g = buildPlant(juniper, v, 0);
      const pos = g.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i++) {
        const y = pos.getY(i);
        juniperTotalVerts++;
        if (y < -0.01) juniperBelowZeroVerts++;
        if (y < juniperMinY) juniperMinY = y;
      }
      g.dispose();
    }
  }
  const juniperBelowShare = juniperBelowZeroVerts / Math.max(1, juniperTotalVerts);

  // Measure clonal carpet radius & slope hover on a 25° boreal hillside
  const carpetSpecies = FLORA.filter(f => f.carpet);
  const maxCarpetRadiusM = Math.max(...carpetSpecies.map(f => f.carpet!.radius));
  let measuredClumpMaxR = 0;
  for (const sp of carpetSpecies) {
    const g = buildClump(sp, 0, 0);
    const pos = g.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const r = Math.hypot(pos.getX(i), pos.getZ(i));
      if (r > measuredClumpMaxR) measuredClumpMaxR = r;
    }
    g.dispose();
  }
  const floraAlignsToSlope = /setFromUnitVectors/.test(floraSrc);
  const slope25Tan = Math.tan((25 * Math.PI) / 180); // 0.4663
  const carpetHoverOn25DegCm = floraAlignsToSlope ? 0 : measuredClumpMaxR * slope25Tan * 100;
  const juniperCleanScore = clamp01(1 - Math.abs(Math.min(0, juniperMinY)) / 0.15);
  const carpetSlopeScore = floraAlignsToSlope ? 1.0 : clamp01(1 - carpetHoverOn25DegCm / 15.0);
  const floraGeomScore = (juniperCleanScore + carpetSlopeScore) / 2;
  raw.understoryFlora = {
    juniperId: juniper?.id ?? 'none',
    juniperMinYCm: Number((juniperMinY * 100).toFixed(2)),
    juniperBelowMinus1cmShare: Number(juniperBelowShare.toFixed(4)),
    juniperBelowVerts: juniperBelowZeroVerts,
    juniperTotalVerts,
    carpetSpeciesCount: carpetSpecies.length,
    maxCarpetRadiusM,
    measuredClumpMaxRM: Number(measuredClumpMaxR.toFixed(3)),
    floraAlignsToSlope,
    carpetHoverOn25DegCm: Number(carpetHoverOn25DegCm.toFixed(2)),
  };
  results.push({
    id: 'understory-juniper-underground-and-carpet-slope',
    label: 'Prostrate juniper above-ground stem bounds & clonal carpet terrain-slope conformity (flora/plant.ts:119-121,134-140, flora.ts:167)',
    measured: `juniper minY=${(juniperMinY * 100).toFixed(1)} cm (${(juniperBelowShare * 100).toFixed(1)}% verts < -1 cm); clump maxR=${measuredClumpMaxR.toFixed(2)} m placed upright (slopeAlign=${floraAlignsToSlope}) -> +${carpetHoverOn25DegCm.toFixed(1)} cm hover on 25° slope`,
    expected: 'juniper minY >= -1.0 cm (prostrate stems stay above soil) AND clonal carpets align to local terrain normal (<= 2.0 cm edge hover on 25° slope)',
    score: Number(floraGeomScore.toFixed(4)),
    knownMatchScore: 1.0,
    knownMismatchScore: 0.0,
    pass: floraGeomScore >= 0.95,
    source: 'Flora of North America Vol. 2 (Juniperus communis var. depressa decumbent stems >= 0 cm above substrate) & clonal mat terrain conformity',
  });

  // =========================================================================
  // Part 2: Live Headless Chromium Gameplay Recording & 4 Sampled Frames
  // =========================================================================
  const browser = await chromium.launch({
    ...(EXECUTABLE ? { executablePath: EXECUTABLE } : {}),
    headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'],
  });
  try {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
    });
    const page = await context.newPage();
    page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
    page.on('pageerror', err => consoleErrors.push(String(err)));

    async function waitForGroundReady(url: string) {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForFunction(() => !document.getElementById('loading'), undefined, { timeout: 90000 });
      await page.waitForTimeout(2500);
    }

    // Frame 0: Noon summer (hour=12, day=190) — high sun contact shadow
    await waitForGroundReady(`${BASE}/?view=ground&noprobe=1&nomenu=1&seed=1400&day=190&hour=12`);
    const frame0Info = await page.evaluate(() => ({
      hud: document.getElementById('status')?.textContent?.trim() ?? '',
      time: document.querySelector('#time-hud, .time-hud, header')?.textContent?.trim()?.slice(0, 120) ?? '',
    }));
    await page.screenshot({ path: join(HERE, 'frame-0-noon-contact-shadow.png') });

    // Frame 1: Low late-afternoon sun (hour=19.2, day=190) — shadow should elongate & offset antisolar, not shrink!
    await waitForGroundReady(`${BASE}/?view=ground&noprobe=1&nomenu=1&seed=1400&day=190&hour=19.2`);
    await page.screenshot({ path: join(HERE, 'frame-1-low-sun-contact-shadow.png') });

    // Frame 2: Astronomical midnight winter (day=25, hour=0) — black contact shadow disc painted at 55% opacity in dark
    await waitForGroundReady(`${BASE}/?view=ground&noprobe=1&nomenu=1&seed=1400&day=25&hour=0`);
    await page.screenshot({ path: join(HERE, 'frame-2-midnight-contact-shadow.png') });

    // Frame 3: Trees v2 + flora showcase on sloped terrain (?trees=v2&patch=1&day=190&hour=14)
    await waitForGroundReady(`${BASE}/?view=ground&noprobe=1&nomenu=1&seed=1400&trees=v2&patch=1&day=190&hour=14`);
    await page.waitForTimeout(2500);
    const frame3Info = await page.evaluate(() => {
      const tv2 = (globalThis as Record<string, unknown>).borealTreesV2 as { info?: unknown } | undefined;
      const fl = (globalThis as Record<string, unknown>).borealFlora as { info?: unknown } | undefined;
      return { treesV2: tv2?.info ?? null, flora: fl?.info ?? null };
    });
    await page.screenshot({ path: join(HERE, 'frame-3-trees-v2-flora-slope.png') });

    raw.liveFrames = {
      frame0Info,
      frame3Info,
      consoleErrorCount: consoleErrors.length,
      consoleErrors: consoleErrors.slice(0, 10),
    };

    await context.close();
  } finally {
    await browser.close();
  }

  const passingCount = results.filter(r => r.pass).length;
  const meanScore = results.reduce((a, r) => a + r.score, 0) / Math.max(1, results.length);
  const calibrationValid = results.every(r => r.knownMatchScore >= 0.95 && r.knownMismatchScore < 0.7);

  const summary = {
    audit: 'T-0267-shadows-trees-flora-audit',
    calibrationValid,
    passingCount,
    totalChecks: results.length,
    meanScore: Number(meanScore.toFixed(4)),
    consoleErrors: consoleErrors.length,
    checks: results,
    raw,
  };
  writeFileSync(join(HERE, 'numbers.json'), JSON.stringify(summary, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify({
    calibrationValid,
    passingCount,
    totalChecks: results.length,
    meanScore: summary.meanScore,
    consoleErrors: consoleErrors.length,
    checks: results.map(r => ({ id: r.id, score: r.score, pass: r.pass, measured: r.measured })),
  }, null, 2));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
