/**
 * Calibrated Rule 11 audit for T-0295:
 *   1. Production Vite bundle (dist/assets 21.71 MB, 65.10 MB total) & eager 5.92 MB VR session fetch on desktop
 *   2. vendor/ (6 vendored libraries) & public/wasm/boreal_sim.wasm export/runtime parity
 *   3. tests/sim-home-ceiling.json & tests/rules.test.ts guardrail drift
 *   4. Governance/spec/licence docs (PROJECT-RULES, SKELETON-RULES, ANIMAL-BEHAVIOUR, CHALLENGES, docs/*) & live prod visuals
 *
 * Run: npx tsx refs/audit/prod-bundle-vendor-wasm-docs-audit/audit.ts [repoWithDist]
 */
import fs from 'node:fs';
import path from 'node:path';

const AUDIT_DIR = import.meta.dirname;
const REPO = path.resolve(process.argv[2] ?? path.join(AUDIT_DIR, '..', '..', '..'));

interface CheckMetrics {
  [k: string]: boolean | number | string | string[] | Record<string, unknown>;
}
interface CalibratedCheck {
  id: string;
  passThreshold: number;
  score: number;
  pass: boolean;
  knownMatchScore: number;
  knownMismatchScore: number;
  calibrationOk: boolean;
  metrics: CheckMetrics;
}

function walk(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).flatMap(name => {
    const abs = path.join(dir, name);
    return fs.statSync(abs).isDirectory() ? walk(abs) : [abs];
  });
}

function ratioScore(flags: boolean[]): number {
  if (!flags.length) return 0;
  return Number((flags.filter(Boolean).length / flags.length).toFixed(4));
}

function calibrate(id: string, scoreFn: (m: Record<string, boolean>) => number, actualFlags: Record<string, boolean>, extraMetrics: CheckMetrics): CalibratedCheck {
  const keys = Object.keys(actualFlags);
  const allTrue = Object.fromEntries(keys.map(k => [k, true]));
  const allFalse = Object.fromEntries(keys.map(k => [k, false]));
  const score = scoreFn(actualFlags);
  const knownMatchScore = scoreFn(allTrue);
  const knownMismatchScore = scoreFn(allFalse);
  const calibrationOk = knownMatchScore >= 0.99 && knownMismatchScore <= 0.25;
  return {
    id,
    passThreshold: 0.95,
    score,
    pass: calibrationOk && score >= 0.95,
    knownMatchScore,
    knownMismatchScore,
    calibrationOk,
    metrics: { ...actualFlags, ...extraMetrics },
  };
}

// --- Read live capture if present ---
const liveCapturePath = path.join(AUDIT_DIR, 'live-capture.json');
const liveCapture = fs.existsSync(liveCapturePath) ? JSON.parse(fs.readFileSync(liveCapturePath, 'utf8')) : null;

// --- 1. Production bundle & eager VR boot ---
const distDir = path.join(REPO, 'dist');
const distAssetsDir = path.join(distDir, 'assets');
const distFiles = walk(distDir);
const distAssets = walk(distAssetsDir);
const sumBytes = (arr: string[]) => arr.reduce((acc, f) => acc + fs.statSync(f).size, 0);

const iwsdkFonts = distAssets.filter(f => /^(raleway|playfairDisplay|nunito|merriweather|montserrat|inter|firaCode|workSans|roboto|poppins|sourceCodePro|openSans|inconsolata|lato|crimsonText|libreBaskerville|spaceMono|msdf-worker)-/i.test(path.basename(f)));
const havokWasm = distAssets.filter(f => /havok/i.test(path.basename(f)));
const dracoKtx = distAssets.filter(f => /draco|basis|ktx/i.test(path.basename(f)));
const katexRedundant = distAssets.filter(f => /^KaTeX_.*\.(ttf|woff)$/i.test(path.basename(f)));
const katexWoff2 = distAssets.filter(f => /^KaTeX_.*\.woff2$/i.test(path.basename(f)));
const sessionChunks = distAssets.filter(f => /^session-.*\.js$/i.test(path.basename(f)));
const chunksOver500k = distAssets.filter(f => f.endsWith('.js') && fs.statSync(f).size > 500_000);

const mainTs = fs.readFileSync(path.join(REPO, 'src/main.ts'), 'utf8');
const eagerVrImportInMain = /^\s*void\s+import\(['"]\.\/vr\/session['"]\)/m.test(mainTs);
const liveForestSessionReq = liveCapture?.forest?.topRequests?.find((r: { path: string }) => /\/assets\/session-.*\.js$/.test(r.path)) ?? null;

const hasViteConfig = ['vite.config.ts', 'vite.config.js', 'vite.config.mjs'].some(f => fs.existsSync(path.join(REPO, f)));
const simWasmDynamic = fs.readFileSync(path.join(REPO, 'src/core/planetBudget.ts'), 'utf8').includes("import('../render/simWasm')");
const simWasmStatic = fs.readFileSync(path.join(REPO, 'src/render/driveBridge.ts'), 'utf8').includes("from './simWasm'");
const locoGameDynamic = fs.readFileSync(path.join(REPO, 'src/audio/borealSound.ts'), 'utf8').includes("import('../animals/locomotion/game')");
const locoGameStatic = fs.readFileSync(path.join(REPO, 'src/render/playables.ts'), 'utf8').includes("from '../animals/locomotion/game'");

const pkg = JSON.parse(fs.readFileSync(path.join(REPO, 'package.json'), 'utf8'));
const codeFiles = [...walk(path.join(REPO, 'src')), ...walk(path.join(REPO, 'tests')), ...walk(path.join(REPO, 'tools'))].filter(f => /\.(ts|tsx|js|mjs|html)$/.test(f));
const codeJoined = codeFiles.map(f => fs.readFileSync(f, 'utf8')).join('\n');
const iwerUnused = Boolean(pkg.devDependencies?.iwer) && !codeJoined.includes('iwer');

const glbDirs = [path.join(REPO, 'public/models/trees'), path.join(REPO, 'public/models/animals')];
let totalGlbs = 0;
let glbsUsingDracoOrKtx = 0;
for (const d of glbDirs) {
  for (const f of fs.readdirSync(d).filter(x => x.endsWith('.glb'))) {
    totalGlbs++;
    const buf = fs.readFileSync(path.join(d, f));
    const jsonLen = buf.readUInt32LE(12);
    const gltf = JSON.parse(buf.subarray(20, 20 + jsonLen).toString('utf8'));
    if ((gltf.extensionsUsed || []).some((e: string) => /draco|basis|ktx/i.test(e))) glbsUsingDracoOrKtx++;
  }
}

const distJsFiles = distAssets.filter(f => f.endsWith('.js'));
const distHasRootBake = distJsFiles.some(f => fs.readFileSync(f, 'utf8').includes('/bake/earth-hot'));
const distHasUnpkg = distJsFiles.some(f => fs.readFileSync(f, 'utf8').includes('unpkg.com/detect-gpu'));
const distHasRawCineRef = distJsFiles.some(f => fs.readFileSync(f, 'utf8').includes('cinematic/refs/'));

const check1Flags = {
  lazyVrSessionOnDesktop: !eagerVrImportInMain && !liveForestSessionReq,
  noUnusedIwsdkFonts: distAssets.length > 0 ? iwsdkFonts.length === 0 : false,
  noUnusedHavokWasm: distAssets.length > 0 ? havokWasm.length === 0 : false,
  noUnusedDracoKtxDecoders: distAssets.length > 0 ? (dracoKtx.length === 0 || glbsUsingDracoOrKtx > 0) : false,
  woff2OnlyKatex: distAssets.length > 0 ? katexRedundant.length === 0 : false,
  hasViteConfig,
  noChunksOver500kB: distAssets.length > 0 ? chunksOver500k.length === 0 : false,
  noMixedStaticDynamicImports: !(simWasmDynamic && simWasmStatic) && !(locoGameDynamic && locoGameStatic),
  noUnusedDevDeps: !iwerUnused,
  noHardcodedRootOrCdnUrlsInBundle: distJsFiles.length > 0 ? (!distHasRootBake && !distHasUnpkg && !distHasRawCineRef) : false,
};

const check1 = calibrate('prod-bundle-code-splitting-and-eager-vr-boot', m => ratioScore(Object.values(m)), check1Flags, {
  distTotalFiles: distFiles.length,
  distTotalBytes: sumBytes(distFiles),
  distAssetsFiles: distAssets.length,
  distAssetsBytes: sumBytes(distAssets),
  vrSessionChunkBytes: sumBytes(sessionChunks),
  liveForestSessionFetchedBytes: liveForestSessionReq?.bytes ?? 0,
  iwsdkFontCount: iwsdkFonts.length,
  iwsdkFontBytes: sumBytes(iwsdkFonts),
  havokWasmBytes: sumBytes(havokWasm),
  dracoKtxCount: dracoKtx.length,
  dracoKtxBytes: sumBytes(dracoKtx),
  totalGlbs,
  glbsUsingDracoOrKtx,
  katexRedundantCount: katexRedundant.length,
  katexRedundantBytes: sumBytes(katexRedundant),
  katexWoff2Count: katexWoff2.length,
  katexWoff2Bytes: sumBytes(katexWoff2),
  chunksOver500kCount: chunksOver500k.length,
  chunksOver500kNames: chunksOver500k.map(f => path.basename(f)),
  mixedStaticDynamicCount: Number(simWasmDynamic && simWasmStatic) + Number(locoGameDynamic && locoGameStatic),
  iwerUnused,
  distHasRootBake,
  distHasUnpkg,
  distHasRawCineRef,
});

// --- 2. vendor/ & public/wasm/boreal_sim.wasm ---
const vendorFiles = walk(path.join(REPO, 'vendor'));
const missingSourceMaps = vendorFiles.filter(f => /\.(js|mjs)$/.test(f)).flatMap(f => {
  const m = fs.readFileSync(f, 'utf8').match(/sourceMappingURL=(\S+)/);
  if (!m) return [];
  return fs.existsSync(path.join(path.dirname(f), m[1])) ? [] : [path.relative(REPO, f).replace(/\\/g, '/') + ' -> ' + m[1]];
});
const detectGpuJs = fs.readFileSync(path.join(REPO, 'vendor/detect-gpu/index.js'), 'utf8');
const detectGpuHasUnpkgDefault = /https:\/\/unpkg\.com\/detect-gpu/.test(detectGpuJs);
const dNvidia = JSON.parse(fs.readFileSync(path.join(REPO, 'public/detect-gpu/d-nvidia.json'), 'utf8'));
const rtx50Rows: string[] = dNvidia.slice(1).filter((r: unknown[]) => /50[5-9]0/.test(String(r[0]))).map((r: unknown[]) => String(r[0]));
const hasRtx5060 = rtx50Rows.some(r => /5060/.test(r));

const wasmBuf = fs.readFileSync(path.join(REPO, 'public/wasm/boreal_sim.wasm'));
const wasmExports = WebAssembly.Module.exports(new WebAssembly.Module(wasmBuf)).filter(e => e.kind === 'function').map(e => e.name).sort();
const rustFiles = walk(path.join(REPO, 'rust/boreal-sim/src')).filter(f => f.endsWith('.rs'));
const rustExports = new Set<string>();
for (const rf of rustFiles) {
  for (const m of fs.readFileSync(rf, 'utf8').matchAll(/pub\s+extern\s+"C"\s+fn\s+([a-zA-Z0-9_]+)/g)) rustExports.add(m[1]);
}
const inRustNotWasm = [...rustExports].filter(x => !wasmExports.includes(x)).sort();
const inWasmNotRust = wasmExports.filter(x => !rustExports.has(x)).sort();
const srcJoined = walk(path.join(REPO, 'src')).filter(f => f.endsWith('.ts')).map(f => fs.readFileSync(f, 'utf8')).join('\n');
const uncalledWasmExports = wasmExports.filter(fn => !srcJoined.includes(fn));

const check2Flags = {
  noMissingVendorSourceMaps: missingSourceMaps.length === 0,
  noVendorCdnDefault: !detectGpuHasUnpkgDefault,
  detectGpuCoversRtx5060: hasRtx5060,
  wasmExportsMatchRust: inRustNotWasm.length === 0 && inWasmNotRust.length === 0,
  rustPanicBridgeWired: srcJoined.includes('engine_panic_ptr') && srcJoined.includes('engine_panic_len'),
  rustSpeciesSpawnWired: srcJoined.includes('species_density') && srcJoined.includes('species_spawn_count'),
};

const check2 = calibrate('vendor-detect-gpu-and-wasm-export-parity', m => ratioScore(Object.values(m)), check2Flags, {
  vendorFilesCount: vendorFiles.length,
  vendorBytes: sumBytes(vendorFiles),
  missingSourceMaps,
  detectGpuHasUnpkgDefault,
  rtx50Rows,
  wasmBytes: wasmBuf.length,
  wasmExportCount: wasmExports.length,
  rustExportCount: rustExports.size,
  inRustNotWasm,
  inWasmNotRust,
  uncalledWasmExports,
});

// --- 3. sim-home-ceiling.json & tests/rules.test.ts ---
const ceiling = JSON.parse(fs.readFileSync(path.join(REPO, 'tests/sim-home-ceiling.json'), 'utf8')) as Record<string, number>;
const nonSimInCeiling = Object.keys(ceiling).filter(p => /hud|asset|entry|View|Panel|lab|Demo|Skirt|Albedo|Exemplar|tilingBlend|glsl|sphere|opening|look|cineBeats|cineReady|sunView/i.test(p));
const slackEntries = Object.entries(ceiling)
  .filter(([p]) => fs.existsSync(path.join(REPO, 'src', p)))
  .map(([p, c]) => ({ p, ceiling: c, actual: fs.readFileSync(path.join(REPO, 'src', p), 'utf8').split('\n').length }))
  .filter(x => x.actual < x.ceiling);
const overEntries = Object.entries(ceiling)
  .filter(([p]) => fs.existsSync(path.join(REPO, 'src', p)))
  .filter(([p, c]) => fs.readFileSync(path.join(REPO, 'src', p), 'utf8').split('\n').length > c);

const furTsExists = fs.existsSync(path.join(REPO, 'src/render/fur.ts'));
const furTsImporters = walk(path.join(REPO, 'src'))
  .filter(f => f.endsWith('.ts') && !f.endsWith('fur.ts'))
  .filter(f => /from\s+['"][^'"]*\/fur['"]/.test(fs.readFileSync(f, 'utf8')));
const rulesTest = fs.readFileSync(path.join(REPO, 'tests/rules.test.ts'), 'utf8');
// Count legacy allowlist entries in guard(..., [ ... ]) calls
const allowlistMatches = [...rulesTest.matchAll(/guard\([\s\S]*?,\s*\[([^\]]*)\]/g)].flatMap(m =>
  [...m[1].matchAll(/'([^']+\.ts)'/g)].map(x => x[1]),
);
// Exclude the 'home' parameter matches by parsing guard calls specifically on 3rd arg
const guardAllowlistFiles = [
  'core/bearBody.ts', 'core/body.ts', 'render/fur.ts',
  'animals/hare.ts', 'audio/wolfVoice.ts', 'core/wolfBody.ts', 'core/wolfModes.ts', 'render/animalRig.ts', 'render/bear.ts', 'render/playerWolf.ts',
  'render/buildScene.ts', 'render/rocks.ts', 'core/animalBehavior.ts', 'core/species.ts',
  'render/bands.ts', 'render/grass/grass.ts', 'world/globe/atmosphere.ts', 'world/globe/planetLayers.ts',
].filter(p => rulesTest.includes(`'${p}'`));

const check3Flags = {
  noNonSimViewsInCeiling: nonSimInCeiling.length === 0,
  noStaleCeilingSlack: slackEntries.length === 0,
  noDeadFurTs: !furTsExists || furTsImporters.length > 0,
  rulesAllowlistReduced: guardAllowlistFiles.length <= 5,
  zeroOverCeiling: overEntries.length === 0,
};

const check3 = calibrate('sim-home-ceiling-and-rules-guardrail-hygiene', m => ratioScore(Object.values(m)), check3Flags, {
  totalCeilingEntries: Object.keys(ceiling).length,
  nonSimInCeilingCount: nonSimInCeiling.length,
  nonSimInCeiling,
  staleSlackCount: slackEntries.length,
  totalSlackLines: slackEntries.reduce((a, x) => a + (x.ceiling - x.actual), 0),
  staleSlackFiles: slackEntries.map(x => `${x.p}:${x.actual}/${x.ceiling}`),
  overCeilingCount: overEntries.length,
  furTsExists,
  furTsImporterCount: furTsImporters.length,
  rulesLegacyAllowlistCount: guardAllowlistFiles.length,
  rulesLegacyAllowlistSample: guardAllowlistFiles.slice(0, 10),
  allowlistTokenMatches: allowlistMatches.length,
});

// --- 4. Governance/spec/licence docs & live prod visual gate ---
const projectRules = fs.readFileSync(path.join(REPO, 'PROJECT-RULES.md'), 'utf8');
const skeletonRules = fs.readFileSync(path.join(REPO, 'SKELETON-RULES.md'), 'utf8');
const animalBehaviour = fs.readFileSync(path.join(REPO, 'ANIMAL-BEHAVIOUR.md'), 'utf8');
const challengesMd = fs.readFileSync(path.join(REPO, 'CHALLENGES.md'), 'utf8');
const docsConstants = fs.readFileSync(path.join(REPO, 'docs/constants.md'), 'utf8');
const docsRenderMap = fs.readFileSync(path.join(REPO, 'docs/rendering-map.md'), 'utf8');
const quizG = JSON.parse(fs.readFileSync(path.join(REPO, 'src/data/quizzes/constant.G.json'), 'utf8'));
const controlsJson = JSON.parse(fs.readFileSync(path.join(REPO, 'src/data/controls.json'), 'utf8'));
const todoControls = Object.entries(controlsJson.controls as Record<string, { quiz?: string }>).filter(([, v]) => v.quiz === 'todo').map(([k]) => k);

const recordingExists = fs.existsSync(path.join(AUDIT_DIR, 'recording.webm'));
const recordingBytes = recordingExists ? fs.statSync(path.join(AUDIT_DIR, 'recording.webm')).size : 0;
const framesExist = [
  'frame-0-prod-dist-forest-boot.png',
  'frame-1-prod-pages-base-boreal-globe.png',
  'frame-2-prod-dist-data-panel-katex.png',
  'reference/ref-0-boreal-wolf-pack-forest-reference.jpg',
  'reference/ref-1-earth-orbit-boreal-limb-reference.jpg',
].every(f => fs.existsSync(path.join(AUDIT_DIR, f)));
const liveZeroErrors = Boolean(liveCapture) && liveCapture.forest.errorCount === 0 && liveCapture.pagesGlobe.errorCount === 0 && liveCapture.forest.http404s.length === 0 && liveCapture.pagesGlobe.http404s.length === 0;
// Visual gate fails on current origin/main: frame-0 shows flat untextured mustard ground + spindly fishbone stalks; frame-1 shows blurry 39 km/px globe + raw checkboxes; frame-2 Data Panel covers HUD & pushes 68 KaTeX equations off-screen.
const liveVisualsMatchRef95 = false;

const check4Flags = {
  projectRulesDocumentsTreeGlbs: /models\/trees/i.test(projectRules),
  noNonCommercialQuizRiskAndTodos: !/CC BY-NC-SA/i.test(String(quizG.license || '')) && todoControls.length === 0,
  docsConstantsCorrectControlsPath: docsConstants.includes('src/data/controls.json') && !/\(core\/badges\.ts, data\/controls\.json\)/.test(docsConstants),
  docsRenderingMapCorrectWaterPath: !docsRenderMap.includes('waterMaterial` in `src/render/pbr.ts`'),
  skeletonRulesUpToDate: !skeletonRules.includes('src/render/fur.ts') && !skeletonRules.includes('deer and other animals still use the old boxes'),
  animalBehaviourUpToDate: !animalBehaviour.includes('Current animals: deer and player wolf'),
  challengesDocMatchesLiveCode: !challengesMd.includes('`core/life.ts` (proposed)') || fs.existsSync(path.join(REPO, 'src/core/life.ts')),
  liveProdZeroConsoleErrors: liveZeroErrors,
  liveProdEvidencePresent: recordingExists && recordingBytes > 10_000 && framesExist,
  liveProdVisualFidelity95: liveVisualsMatchRef95,
};

const check4 = calibrate('governance-spec-licence-docs-and-live-prod-visuals', m => ratioScore(Object.values(m)), check4Flags, {
  treeGlbsShipped: fs.readdirSync(path.join(REPO, 'public/models/trees')).filter(f => f.endsWith('.glb')).length,
  quizConstantGLicense: String(quizG.license || ''),
  todoControlCount: todoControls.length,
  todoControls,
  recordingBytes,
  liveKatexNodes: liveCapture?.forest?.extra?.panelInfo?.katexNodes ?? 0,
  liveForestRequests: liveCapture?.forest?.totalRequests ?? 0,
  livePagesGlobeRequests: liveCapture?.pagesGlobe?.totalRequests ?? 0,
});

const checks = [check1, check2, check3, check4];
const calibrationValid = checks.every(c => c.calibrationOk);
const passCount = checks.filter(c => c.pass).length;
const meanScore = Number((checks.reduce((a, c) => a + c.score, 0) / checks.length).toFixed(4));

const out = {
  auditedRepo: REPO,
  generatedAt: new Date().toISOString(),
  calibrationValid,
  passCount,
  totalChecks: checks.length,
  meanScore,
  checks,
};

const outPath = path.join(AUDIT_DIR, 'numbers.json');
fs.writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n');
console.log(JSON.stringify({ calibrationValid, passCount, totalChecks: checks.length, meanScore, scores: checks.map(c => ({ id: c.id, score: c.score, match: c.knownMatchScore, mismatch: c.knownMismatchScore })) }, null, 2));
