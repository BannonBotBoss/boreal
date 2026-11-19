/**
 * Calibrated Rule 11 numeric verification for T-0260:
 * Generation Inspector (I), Terrain/Animal Picking, Appearance Editor,
 * 3D Drag Handles, ShapeTools, Coat Shader & Genome Constraints Audit.
 *
 * Run: npx tsx refs/ui/inspector-appearance-shape-audit/numeric-check.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');

const clamp01 = x => Math.min(1, Math.max(0, Number.isFinite(x) ? x : 0));
const ratioScore = (a, b) => {
  if (!(a > 0) || !(b > 0)) return 0;
  return clamp01(Math.min(a, b) / Math.max(a, b));
};
const deltaScore = (measured, target, fullScale) => {
  if (!(fullScale > 0) || !Number.isFinite(measured) || !Number.isFinite(target)) return 0;
  return clamp01(1 - Math.abs(measured - target) / fullScale);
};

// Load repo modules directly
const { createGenomeEditor, defaultGenome, handleWall, fitProfile, CONSTRAINTS } = await import(new URL('../../../src/core/genome.ts', import.meta.url).href);

const obs = JSON.parse(fs.readFileSync(path.join(__dirname, 'observations.json'), 'utf8'));
const srcInspector = fs.readFileSync(path.join(REPO_ROOT, 'src/ui/inspector.ts'), 'utf8');
const srcAppearancePanel = fs.readFileSync(path.join(REPO_ROOT, 'src/ui/appearancePanel.ts'), 'utf8');
const srcShapeTools = fs.readFileSync(path.join(REPO_ROOT, 'src/ui/shapeTools.ts'), 'utf8');
const srcAppearanceRender = fs.readFileSync(path.join(REPO_ROOT, 'src/render/appearance.ts'), 'utf8');
const srcBuild = fs.readFileSync(path.join(REPO_ROOT, 'src/render/buildScene.ts'), 'utf8');
const srcGameCam = fs.readFileSync(path.join(REPO_ROOT, 'src/camera/gameCamera.ts'), 'utf8');

// Calibration: known match must score >= 0.99, known mismatch must score <= 0.10
const calibration = {
  knownMatch: {
    ratio_exact: ratioScore(1.0, 1.0),
    delta_zero: deltaScore(0.7, 0.7, 0.7),
    binary_pass: 1.0,
  },
  knownMismatch: {
    ratio_zero: ratioScore(0, 1.0),
    delta_full: deltaScore(0.0, 0.7, 0.7),
    binary_fail: 0.0,
  },
};
const calibrationValid =
  Object.values(calibration.knownMatch).every(v => v >= 0.99) &&
  Object.values(calibration.knownMismatch).every(v => v <= 0.10);

const checks = [];

// 1. Live #inspector visibility on pressing KeyI (blocked by gameCamera.ts:97 body:not(.boreal-debug) #inspector display:none !important)
const inspectorVisible = obs.stages.stage0_openInspector.computed?.display !== 'none' && (obs.stages.stage0_openInspector.rect?.width ?? 0) > 0;
checks.push({
  id: 'inspector-visible-on-toggle',
  name: '#inspector panel visible on pressing I without hidden boreal-debug class',
  measured: inspectorVisible ? obs.stages.stage0_openInspector.rect.width : 0,
  target: 360,
  unit: 'px width (CSS #inspector width)',
  source: 'src/style.css:20 (#inspector width: 360px) vs src/camera/gameCamera.ts:97 (display:none !important)',
  score: inspectorVisible ? ratioScore(obs.stages.stage0_openInspector.rect.width, 360) : 0,
  pass: inspectorVisible,
});

// 2. Live ground terrain picking in Generation Inspector (buildScene.ts:179 hides ground.visible=false; pick():674 rejects hidden; continuousTerrain omitted)
const groundHits = obs.stages.stage1_groundAndPlayerPick.groundClicks.filter(c => c.header.includes('terrain')).length;
const groundTotal = obs.stages.stage1_groundAndPlayerPick.groundClicks.length;
checks.push({
  id: 'inspector-terrain-pick',
  name: 'Clicking visible ground selects terrain column/weather/deltas in Inspector',
  measured: groundHits,
  target: groundTotal,
  unit: 'hits / 6 ground clicks',
  source: 'src/render/buildScene.ts:179,666-675 (ground.visible=false & continuousTerrain omitted from pick roots)',
  score: groundTotal > 0 ? groundHits / groundTotal : 0,
  pass: groundHits === groundTotal,
});

// 3. Inspector 60 Hz gizmo GPU material disposal (drawGizmos allocates fresh LineBasicMaterial/ArrowHelper/BoxHelper every frame, never disposes materials, toggle(false) skips all disposal)
const drawGizmosBlock = srcInspector.slice(srcInspector.indexOf('function drawGizmos()'), srcInspector.indexOf('// ---- picking'));
const disposesMaterials = /\.material\b[\s\S]*?\.dispose\s*\(/.test(drawGizmosBlock);
const toggleClearsDisposed = /if\s*\(!on\)\s*\{[^}]*dispose/.test(srcInspector);
checks.push({
  id: 'inspector-gizmo-material-disposal',
  name: 'drawGizmos() & toggle(false) dispose allocated Three.js materials and geometries (0 leaked materials/frame)',
  measured: (disposesMaterials ? 0.5 : 0) + (toggleClearsDisposed ? 0.5 : 0),
  target: 1,
  unit: 'disposal compliance fraction',
  source: 'src/ui/inspector.ts:216-220,228,230,265 (Three.js r180 WebGLRenderer disposal contract)',
  score: (disposesMaterials ? 0.5 : 0) + (toggleClearsDisposed ? 0.5 : 0),
  pass: disposesMaterials && toggleClearsDisposed,
});

// 4. Inspector freeGeometry() skips userData.shared cached geometries (avoid corrupting global tree/rock cache)
const freeGeomLine = srcInspector.match(/const freeGeometry\s*=\s*[^\n]+/)?.[0] ?? '';
const guardsSharedGeom = /userData\.shared/.test(freeGeomLine);
checks.push({
  id: 'inspector-shared-geometry-guard',
  name: 'freeGeometry() preserves userData.shared cached meshes (trees/rocks) on What-If preview restore',
  measured: guardsSharedGeom ? 1 : 0,
  target: 1,
  unit: 'boolean (1 = guards userData.shared)',
  source: 'src/ui/inspector.ts:37 vs src/render/geometry.ts disposeObject shared-cache invariant',
  score: guardsSharedGeom ? 1 : 0,
  pass: guardsSharedGeom,
});

// 5. Inspector player species label (hardcodes "Gray wolf" / agentWhy("wolf") even when playing deer/bear/hare)
const hardcodesPlayerWolf = /agentWhy\('wolf'\),\s*d\.goal,\s*d\.because\),\s*'Gray wolf'/.test(srcInspector);
checks.push({
  id: 'inspector-player-species-dynamic',
  name: 'Inspector player readout uses active playable species instead of hardcoded Gray wolf',
  measured: hardcodesPlayerWolf ? 0 : 1,
  target: 1,
  unit: 'boolean (1 = species-aware)',
  source: 'src/ui/inspector.ts:137-143 vs src/render/playables.ts (wolf, deer, bear, hare)',
  score: hardcodesPlayerWolf ? 0 : 1,
  pass: !hardcodesPlayerWolf,
});

// 6. Live AppearancePanel capture-phase keydown listener leak (removeEventListener missing capture=true)
const addedBefore = obs.stages.stage2_appearanceAndShapeTools.beforeEdits.keydownAddedCapture;
const addedAfter = obs.stages.stage2_appearanceAndShapeTools.afterEdits.keydownAddedCapture;
const removedCapture = obs.stages.stage2_appearanceAndShapeTools.afterEdits.keydownRemovedCapture;
const leakedPerRebuild = addedAfter - addedBefore - removedCapture;
const removesCapture = /removeEventListener\(\s*'keydown'\s*,\s*keys\s*,\s*true\s*\)/.test(srcAppearancePanel.slice(srcAppearancePanel.indexOf('const keys'), srcAppearancePanel.indexOf('if (!(ev.ctrlKey')));
checks.push({
  id: 'appearance-keydown-capture-leak',
  name: 'appearancePanel removes capture-phase keydown listeners on rebuild/unmount (0 leaked listeners)',
  measured: leakedPerRebuild,
  target: 0,
  unit: 'leaked capture keydown listeners over 2 edits',
  source: 'WHATWG DOM Standard §2.7 EventTarget.removeEventListener(type, cb, capture) vs src/ui/appearancePanel.ts:60,64',
  score: leakedPerRebuild === 0 && removesCapture ? 1 : 0,
  pass: leakedPerRebuild === 0 && removesCapture,
});

// 7. 3D handles detached when Inspector/Appearance hidden + pointercancel & behind-camera guard
const handlesGuardBehindCam = /v\.z\s*>\s*1|v\.z\s*<\s*-1/.test(srcShapeTools);
const handlesPointerCancel = /pointercancel/.test(srcShapeTools);
const inspectorDetachesHandles = /handles\??\.attach\(\s*undefined\s*\)/.test(srcInspector);
const handleScore = ((handlesGuardBehindCam ? 1 : 0) + (handlesPointerCancel ? 1 : 0) + (inspectorDetachesHandles ? 1 : 0)) / 3;
checks.push({
  id: 'shapetools-3d-handle-lifecycle',
  name: '3D drag handles guard behind-camera NDC (v.z>1), handle pointercancel, and detach on Inspector close',
  measured: +handleScore.toFixed(4),
  target: 1,
  unit: '3 lifecycle guards fraction',
  source: 'src/ui/shapeTools.ts:31-53 & src/ui/inspector.ts:263-266 (W3C Pointer Events Level 3)',
  score: handleScore,
  pass: handleScore >= 0.99,
});

// 8. Genome load(g) preserves cross-parameter ratio CONSTRAINTS [0.7, 1.4]
const edLoad = createGenomeEditor([]);
edLoad.load({ ...defaultGenome(), length: 1.35, height: 0.75 });
const loadedRatio = Number(edLoad.genome.height) / Number(edLoad.genome.length);
const minRatio = CONSTRAINTS.find(c => c.a === 'height' && c.b === 'length').min;
const loadConstraintPass = loadedRatio >= minRatio - 1e-6;
checks.push({
  id: 'genome-load-ratio-constraint',
  name: 'createGenomeEditor().load() enforces cross-parameter height/length >= 0.70 constraint',
  measured: +loadedRatio.toFixed(4),
  target: minRatio,
  unit: 'height/length ratio (must be >= 0.70)',
  source: 'src/core/genome.ts:32,71 (CONSTRAINTS height/length in [0.7, 1.4])',
  score: loadConstraintPass ? 1 : ratioScore(loadedRatio, minRatio),
  pass: loadConstraintPass,
});

// 9. handleWall() linear scaling for param === 'size' (currently divides by baseExtent * size^2 instead of baseExtent * size)
const gSize = { ...defaultGenome(), size: 1.4 };
// Dragging +0.14 m on a 1.0 m baseExtent at size=1.4 should yield size = 1.4 + 0.14 = 1.54 (10% increase);
// Buggy formula divides by (1.0 * 1.4 * 1.4) = 1.96 -> 1.4 * (1 + 0.14/1.96) = 1.50!
const hw = handleWall(gSize, 'size', 1.4, 0.14, 1.0, 1);
const expectedSize = 1.54;
const sizeGainMeasured = (hw.value - 1.4) / 0.14;
const sizeGainExpected = 1.0;
checks.push({
  id: 'genome-handlewall-size-linear',
  name: 'handleWall("size") scales 1:1 with worldDelta/baseExtent (no double size^2 division)',
  measured: +sizeGainMeasured.toFixed(4),
  target: sizeGainExpected,
  unit: 'd(size) / (worldDelta / baseExtent)',
  source: 'src/core/genome.ts:80-85 ("the render layer effect is exactly linear")',
  score: ratioScore(sizeGainMeasured, sizeGainExpected),
  pass: Math.abs(hw.value - expectedSize) < 0.005,
});

// 10. fitProfile() explores full valid (L, H) domain without being locked by prior height constraint
// Starting from short animal (length=0.75, height=0.75), sketch a tall+long 1.30x1.30 silhouette:
const unitSil = [[-0.5, 0.5], [0, 0.5], [0.5, 0.5], [-0.5, -0.5], [0, -0.5], [0.5, -0.5]];
const targetScale = 1.30;
const strokeTallLong = unitSil.map(([x, y]) => [x * targetScale, y * targetScale]);
const fitRes = fitProfile({ ...defaultGenome(), length: 0.75, height: 0.75 }, strokeTallLong, unitSil);
const fitScore = ratioScore(fitRes.length, targetScale);
checks.push({
  id: 'genome-fitprofile-domain',
  name: 'fitProfile() reaches valid (1.30, 1.30) sketch from (0.75, 0.75) without stale height clamp',
  measured: +fitRes.length.toFixed(4),
  target: targetScale,
  unit: 'fitted length (target 1.30)',
  source: 'src/core/genome.ts:95-104 (least-squares over valid CONSTRAINTS domain)',
  score: fitScore,
  pass: fitScore >= 0.95,
});

// 11. render/appearance.ts inject() chains existing onBeforeCompile (CSM shadows) & uses Rec.709 linear luminance without 2x energy blowup
const chainsOnBeforeCompile = /const\s+\w+\s*=\s*m\.onBeforeCompile/.test(srcAppearanceRender);
const usesRec709No2x = /0?\.2126[\s\S]*0?\.7152[\s\S]*0?\.0722/.test(srcAppearanceRender) && !/\*\s*2\.?\s*;/.test(srcAppearanceRender);
const coatShaderScore = ((chainsOnBeforeCompile ? 1 : 0) + (usesRec709No2x ? 1 : 0)) / 2;
checks.push({
  id: 'appearance-shader-csm-and-luminance',
  name: 'render/appearance.ts chains onBeforeCompile (preserving CSM shadows) and uses Rec.709 linear luminance without 2x albedo blowup',
  measured: coatShaderScore,
  target: 1,
  unit: 'shader compliance fraction',
  source: 'ITU-R BT.709-6 / IEC 61966-2-1 linear luminance (0.2126, 0.7152, 0.0722) & Three.js CSM onBeforeCompile chaining (src/render/photoreal.ts)',
  score: coatShaderScore,
  pass: coatShaderScore >= 0.99,
});

// 12. ShapeTools wheel sRGB vs swatch sRGB agreement (THREE.Color.lerp operates in linear RGB so getHexString() encodes #ffbbbb while wheel canvas draws [255,128,128])
// Exact IEC 61966-2-1 sRGB encoding of linear 0.5 is 187.5/255 (~#ffbbbb), whereas wheel canvas pixel is [255, 128, 128]
const linearMidToSrgb255 = Math.round((1.055 * (0.5 ** (1 / 2.4)) - 0.055) * 255); // 188
const wheelMidG = obs.stages.stage2_appearanceAndShapeTools.wheelSample?.midRedRight?.[1] ?? 0;
const wheelVsSwatchScore = deltaScore(wheelMidG, linearMidToSrgb255, 255);
const wheelSwatchPass = Math.abs(wheelMidG - linearMidToSrgb255) <= 2;
checks.push({
  id: 'shapetools-wheel-swatch-srgb-match',
  name: 'ShapeTools color wheel pixel RGB matches CSS swatch sRGB output at HSV(0, 0.5, 1)',
  measured: wheelMidG,
  target: linearMidToSrgb255,
  unit: 'green/blue byte (wheel canvas 128 vs CSS swatch 188)',
  source: 'IEC 61966-2-1 sRGB transfer function & Three.js r180 ColorManagement (src/ui/shapeTools.ts:64,109)',
  score: wheelSwatchPass ? 1 : wheelVsSwatchScore,
  pass: wheelSwatchPass,
});

const passed = checks.filter(c => c.pass).length;
const meanScore = checks.reduce((s, c) => s + c.score, 0) / checks.length;

const report = {
  task: 'T-0260',
  generatedAt: new Date().toISOString(),
  calibration,
  calibrationValid,
  summary: {
    passed,
    total: checks.length,
    passThreshold: 0.95,
    meanScore: +meanScore.toFixed(4),
  },
  checks,
};

fs.writeFileSync(path.join(__dirname, 'numbers.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report.summary, null, 2));
console.log('calibrationValid:', calibrationValid);
for (const c of checks) {
  console.log(`${c.pass ? 'PASS' : 'FAIL'} [${c.score.toFixed(3)}] ${c.id}: measured=${c.measured} target=${c.target} (${c.unit})`);
}
