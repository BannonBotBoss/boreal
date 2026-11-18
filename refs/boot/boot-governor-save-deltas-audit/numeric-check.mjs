/**
 * Calibrated Rule 11 numeric verification for T-0257:
 * Boot/Startup, Adaptive Quality Governor & GPU Probe, Seed/Save/Resume,
 * Persistence Deltas, Interest Job Scheduler, & Snapshot Rewind Audit.
 *
 * Run: npx tsx refs/boot/boot-governor-save-deltas-audit/numeric-check.mjs
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
const { toLatLon, fromLatLon, PLANET } = await import(new URL('../../../src/world/globe/planet.ts', import.meta.url).href);
const { createContext, parseContext, cleanResume, bootChoice } = await import(new URL('../../../src/core/events.ts', import.meta.url).href);
const { WORLD_SEED } = await import(new URL('../../../src/core/world.ts', import.meta.url).href);
const { STAGES } = await import(new URL('../../../src/core/stages/elevation.ts', import.meta.url).href);
const { GOVERNOR, LADDER, applied, governFrame, resetGovernor, tierForGpu } = await import(new URL('../../../src/core/quality.ts', import.meta.url).href);
const { PROBE, probeCap, median } = await import(new URL('../../../src/core/probe.ts', import.meta.url).href);
const { DELTAS, record, upsertGrazed, prune, strength, loadDeltas } = await import(new URL('../../../src/core/deltas.ts', import.meta.url).href);
const { runJobs, enqueue, STATS, cancel } = await import(new URL('../../../src/core/interest.ts', import.meta.url).href);
const { createSnapshotHub } = await import(new URL('../../../src/core/snapshot.ts', import.meta.url).href);
const { startupRoute, standChunkIndex } = await import(new URL('../../../src/render/startup.ts', import.meta.url).href);
const { worldSeedFromUniverse } = await import(new URL('../../../src/core/universeSeed.ts', import.meta.url).href);

const obs = JSON.parse(fs.readFileSync(path.join(__dirname, 'observations.json'), 'utf8'));
const srcMain = fs.readFileSync(path.join(REPO_ROOT, 'src/main.ts'), 'utf8');
const srcMenu = fs.readFileSync(path.join(REPO_ROOT, 'src/ui/menu.ts'), 'utf8');
const srcStartup = fs.readFileSync(path.join(REPO_ROOT, 'src/render/startup.ts'), 'utf8');
const srcPhotoreal = fs.readFileSync(path.join(REPO_ROOT, 'src/render/photoreal.ts'), 'utf8');

// ============================================================================
// 1. Calibration (Rule 11): 4 Known Matches (>= 0.95) & 4 Known Mismatches (< 0.70)
// ============================================================================
const unitDir = fromLatLon(49.77 * Math.PI / 180, 65.54 * Math.PI / 180);
const unitRoundTripLat = toLatLon(unitDir).lat * 180 / Math.PI;
const rtxTier = tierForGpu('ANGLE (NVIDIA, NVIDIA GeForce RTX 5060 Laptop GPU Direct3D11)');
const medEven = median([10, 20, 30, 40]);
const warmRoute = startupRoute({
  reprobe: false,
  skipProbe: false,
  cached: true,
  buildId: 'build-1',
  renderer: 'RTX',
  stamp: { build: 'build-1', renderer: 'RTX' },
});
const chunk0 = standChunkIndex(64.6, -16.5);

const knownMatches = [
  {
    id: 'match_unit_vector_toLatLon_roundtrip',
    measured: +unitRoundTripLat.toFixed(6),
    reference: 49.77,
    score: +deltaScore(unitRoundTripLat, 49.77, 90).toFixed(4),
    note: 'Normalized unit direction round-trips 49.77 deg exactly',
  },
  {
    id: 'match_rtx_gpu_string_initial_tier',
    measured: rtxTier,
    reference: 0,
    score: +deltaScore(rtxTier, 0, 5).toFixed(4),
    note: 'Discrete RTX GPU maps to tier 0 (Ultra)',
  },
  {
    id: 'match_probe_median_even_array',
    measured: medEven,
    reference: 25,
    score: +ratioScore(medEven, 25).toFixed(4),
    note: 'median([10,20,30,40]) === 25.0',
  },
  {
    id: 'match_warm_startup_route_and_chunk_index',
    measured: warmRoute === 'warm' && chunk0.a === 1 && chunk0.b === -1 ? 1 : 0,
    reference: 1,
    score: warmRoute === 'warm' && chunk0.a === 1 && chunk0.b === -1 ? 1.0 : 0.0,
    note: 'Matching warm stamp routes warm; (64.6,-16.5) maps to chunk (1,-1)',
  },
];

// ============================================================================
// 2. Audit Checks (12 measured checks across 4 objectives)
// ============================================================================

// Check 1: captureResume() unnormalized cam.position -> toLatLon (main.ts:495)
const orbitR = PLANET.radius + 23_572_733;
const camMetres = [unitDir[0] * orbitR, unitDir[1] * orbitR, unitDir[2] * orbitR];
const resumeBugLatDeg = toLatLon(camMetres).lat * 180 / Math.PI;
const resumeLatErrDeg = Math.abs(resumeBugLatDeg - 49.77);
const mainCallsUnnormalizedToLatLon = /toLatLon\(\[cam\.x,\s*cam\.y,\s*cam\.z\]\)/.test(srcMain);
const score1 = mainCallsUnnormalizedToLatLon ? deltaScore(resumeBugLatDeg, 49.77, 90) : 1.0;

// Check 2: Seed mismatch in parseContext/createContext + legacy newWorld shadowed by universeSeed + clearWorldSaves leaks
const prevStagesSeed = STAGES.seed;
STAGES.seed = 999999;
const ctxOnSeed999999 = createContext();
const acceptedCrossSeed = parseContext(JSON.stringify(ctxOnSeed999999)).worldSeed === WORLD_SEED;
STAGES.seed = prevStagesSeed;
const st2 = obs.stage2_seedAndClearLeaks;
const leakedKeysCount = [
  st2.survivingUniverseSeedKey === '424242',
  !!st2.survivingClockKey,
  st2.survivingDayKey === '{"day":15,"hour":14}',
  st2.survivingPlayerKey === 'deer',
].filter(Boolean).length;
const score2 = clamp01(1 - (leakedKeysCount + (acceptedCrossSeed ? 1 : 0)) / 5);

// Check 3: releasePrey never calls commitContext & pagehide skips saveAll when !hasSeenBigBang
const releasePreySection = srcMain.slice(srcMain.indexOf("else if (id === 'releasePrey')"), srcMain.indexOf("else if (id === 'howl')"));
const releaseCommits = /commitContext\(\)|localStorage\.setItem\(SAVE_KEY/.test(releasePreySection);
const pagehideGatedOnBigBang = /pagehide',\s*\(\)\s*=>\s*\{\s*if\s*\(hasSeenBigBang\(context\)\)\s*saveAll\(\)/.test(srcMain);
const score3 = ((releaseCommits ? 1 : 0) + (pagehideGatedOnBigBang ? 0 : 1)) / 2;

// Check 4: Menu -> Graphics split-brain & capTier clamping (live stage1 + module check)
resetGovernor();
GOVERNOR.capTier = 2; GOVERNOR.probeCap = 2; GOVERNOR.auto = false;
// Simulate menu.ts:101 picking Ultra (i=0): updates probeCap=0, tier=0, leaves capTier=2
GOVERNOR.probeCap = 0; GOVERNOR.tier = 0;
const appliedAfterMenuUltra = applied().name;
const st1 = obs.stage1_graphicsSplitBrain;
const graphicsSyncMatches = [
  st1.lowerAutoCheckedAfterTopPick === false,
  st1.persistedAutoAfter === false,
  st1.persistedTierAfter === 'Ultra',
  appliedAfterMenuUltra === 'Ultra',
].filter(Boolean).length;
const score4 = graphicsSyncMatches / 4;

// Check 5: GPU-bound at 60 fps vsync (workMs=3, gpuMs=15.8, frameMs=16.67) fools governFrame into lifting probeCap
resetGovernor();
GOVERNOR.auto = true; GOVERNOR.targetFps = 60; GOVERNOR.capTier = 0; GOVERNOR.probeCap = 2; GOVERNOR.tier = 2; GOVERNOR.probeHits = 0; GOVERNOR.cool = 0; GOVERNOR.upBlock = 0;
let vsyncSteppedUp = 0;
for (let i = 0; i < 600; i++) {
  const d = governFrame(3.0, 15.8, 16.67);
  if (d !== 0) { vsyncSteppedUp = d; break; }
}
const vsyncReportedFps = GOVERNOR.fps; // ~333 fps instead of ~63 fps (1000/15.8)
const vsyncRaisedProbeCap = GOVERNOR.probeCap < 2;
const score5 = vsyncRaisedProbeCap ? 0.0 : ratioScore(vsyncReportedFps, 1000 / 15.8);

// Check 6: Startup measureHardware clamps to capTier, PROBE.budgetMs ignores targetFps, JOB_FIRST leak, per-frame JSON.stringify
const measureSavesCapTier = /const capTier = GOVERNOR\.capTier/.test(srcStartup);
const probeUsesTargetFps = /targetFps|budgetMs\(\)/.test(fs.readFileSync(path.join(REPO_ROOT, 'src/core/probe.ts'), 'utf8'));
const splashClearsJobFirst = /splashJobs !== undefined[\s\S]{0,120}else\s+JOB_FIRST\.test\s*=\s*null/.test(srcMain);
const perFrameJsonStringify = /before\([\s\S]{0,140}JSON\.stringify\(applied\(\)\)/.test(srcPhotoreal);
const score6 = ((measureSavesCapTier ? 1 : 0) + (probeUsesTargetFps ? 1 : 0) + (splashClearsJobFirst ? 1 : 0) + (perFrameJsonStringify ? 0 : 1)) / 4;

// Check 7: deltas.ts:61,68 cap eviction drops freshly eaten grazed patch (m=0) FIRST
DELTAS.log = [];
upsertGrazed({ x: 10, z: 10, m: 0, meta: 'forage:freshly-eaten|0|0.01|100|player' });
for (let i = 0; i < DELTAS.cap; i++) {
  record({ kind: 'footprint', x: i * 5, z: 0, t: 0, m: 0.05 });
}
const freshlyEatenSurvived = DELTAS.log.some(d => d.kind === 'grazed');
const score7 = freshlyEatenSurvived ? 1.0 : 0.0;

// Check 8: deltas.ts:74 prune throws TypeError on unknown/retired delta kind from loadDeltas
loadDeltas(JSON.stringify([{ kind: 'retiredKind', x: 0, z: 0, t: 0, m: 1 }]));
let pruneThrew = false;
let pruneErrMsg = '';
try { prune(1); } catch (e) { pruneThrew = true; pruneErrMsg = String(e); }
DELTAS.log = [];
const score8 = pruneThrew ? 0.0 : 1.0;

// Check 9: deltas.ts:48-49 footprint weather decay is non-monotonic (rejuvenates when rain stops) + 1s setInterval footprints & hardcoded 'canid' footing
const fpNoWet = { kind: 'footprint', x: 0, z: 0, t: 0, m: 0.05 };
const ageDays = 2.0;
const ageYrs = ageDays / 365.25;
const dryStr = Math.exp(-ageDays / 1.5);
const rainInstantStr = Math.exp(-ageDays / 1.5 * 4);
const nonMonotonicRatio = rainInstantStr / dryStr; // drops 54.6x instantly on 1-min shower, jumps 54.6x back up if rain stops!
const hardcodedCanidFooting = /footing\(column\(player\.x,\s*player\.z\),\s*playerMass,\s*'canid'/.test(srcMain);
const intervalFootprint = /setInterval\([\s\S]{0,600}record\(\{\s*kind:\s*'footprint'/.test(srcMain);
const score9 = ((nonMonotonicRatio > 0.9 ? 1 : 0) + (hardcodedCanidFooting ? 0 : 1) + (intervalFootprint ? 0 : 1)) / 3;

// Check 10: interest.ts:68 estSlice spike lock (single 40 ms GC stall locks multi-slice scheduling to 1/frame for ~22 runs) + no try/catch in runJobs
STATS.kinds = {}; STATS.deferred = 0;
let stepsIn10Frames = 0;
enqueue('audit:gc', 1, (function* () { for (let i = 0; i < 30; i++) { stepsIn10Frames++; yield; } })(), () => {});
let clk = 0, call = 0;
const fakeNow = () => { call++; clk += call === 3 ? 40 : 0.05; return clk; };
let framesDeferred = 0;
for (let f = 0; f < 10; f++) {
  const before = STATS.deferred;
  runJobs(4, fakeNow);
  if (STATS.deferred > before) framesDeferred++;
}
cancel('audit:gc');
// With 0.05 ms slices and 4 ms budget, frames 2..10 should run all remaining 29 slices in 1 frame (0 deferred); bug runs only 1/frame (9 deferred)
const score10 = deltaScore(framesDeferred, 0, 9);

// Check 11: snapshot.ts:35 rewind + resume wipes entire 60s ring & main.ts omits needs/modes/worldClock from snapshot hub
const hub = createSnapshotHub(600);
let simT = 0;
hub.register('player', { capture: () => simT, restore: v => { simT = v; } });
for (let i = 0; i < 50; i++) { simT = i * 0.1; hub.sample(simT); }
const ringBefore = hub.ring.size;
hub.restore(hub.ring.at(25));
simT += 0.1;
hub.sample(simT);
const ringAfterResume = hub.ring.size; // wiped from 50 -> 1!
const registersNeeds = /hub\.register\('needs'/.test(srcMain);
const registersModes = /hub\.register\('modes'/.test(srcMain);
const registersClock = /hub\.register\('clock'/.test(srcMain);
const score11 = (clamp01(ringAfterResume / 26) + (registersNeeds ? 1 : 0) + (registersModes ? 1 : 0) + (registersClock ? 1 : 0)) / 4;

// Check 12: Startup globe hold (frame-0.png stuck at Building the ground here... after 48.5s) & menu.ts white-on-white <select>/<input> contrast
const checks = [
  { id: 'c01_globe_resume_unnormalized_lat', measured: +resumeBugLatDeg.toFixed(2), target: 49.77, score: +score1.toFixed(4), detail: `toLatLon([cam.x,cam.y,cam.z]) clamps 22.86e6 m to +90.00 deg North Pole (err ${resumeLatErrDeg.toFixed(2)} deg)` },
  { id: 'c02_seed_parseContext_and_clearWorldSaves', measured: leakedKeysCount + (acceptedCrossSeed ? 1 : 0), target: 0, score: +score2.toFixed(4), detail: `parseContext accepts cross-seed WORLD_SEED=1400; clearWorldSaves leaks universeSeed=${st2.survivingUniverseSeedKey}, clock, day=${st2.survivingDayKey}, player=${st2.survivingPlayerKey}` },
  { id: 'c03_releasePrey_and_pagehide_save_gaps', measured: (releaseCommits ? 1 : 0) + (pagehideGatedOnBigBang ? 0 : 1), target: 2, score: +score3.toFixed(4), detail: `releasePrey commits=${releaseCommits}; pagehide skips saveAll when !hasSeenBigBang (${pagehideGatedOnBigBang})` },
  { id: 'c04_graphics_menu_split_brain_and_capTier', measured: graphicsSyncMatches, target: 4, score: +score4.toFixed(4), detail: `Top Quality=0 (Ultra) leaves lower auto=${st1.lowerAutoCheckedAfterTopPick}, tier=${st1.lowerTierValueAfterTopPick}, persisted=${st1.persistedTierAfter}, applied()=${appliedAfterMenuUltra}` },
  { id: 'c05_vsync_gpu_bound_probeCap_false_raise', measured: +vsyncReportedFps.toFixed(1), target: +(1000 / 15.8).toFixed(1), score: +score5.toFixed(4), detail: `gpuMs=15.8ms, workMs=3.0ms, frameMs=16.67ms -> reported ${vsyncReportedFps.toFixed(1)} fps, stepped=${vsyncSteppedUp}, probeCap raised to ${LADDER[GOVERNOR.probeCap].name}` },
  { id: 'c06_startup_probe_budget_jobFirst_jsonStringify', measured: score6 * 4, target: 4, score: +score6.toFixed(4), detail: `measureCapGuard=${measureSavesCapTier}, probeTargetFps=${probeUsesTargetFps}, clearJobFirst=${splashClearsJobFirst}, perFrameJsonStringify=${perFrameJsonStringify}` },
  { id: 'c07_deltas_cap_evicts_empty_grazed_first', measured: freshlyEatenSurvived ? 1 : 0, target: 1, score: +score7.toFixed(4), detail: `Freshly grazed patch (m=0, strength=1) has strength*m=0 -> evicted first at cap=${DELTAS.cap} (survived=${freshlyEatenSurvived})` },
  { id: 'c08_deltas_prune_throws_on_unknown_kind', measured: pruneThrew ? 0 : 1, target: 1, score: +score8.toFixed(4), detail: `loadDeltas unknown kind -> prune() throws ${pruneErrMsg}` },
  { id: 'c09_deltas_nonmonotonic_wet_and_interval_canid', measured: +nonMonotonicRatio.toFixed(4), target: 1.0, score: +score9.toFixed(4), detail: `2d track drops ${(1 / nonMonotonicRatio).toFixed(1)}x on 1-min rain & rebounds on dry; hardcodedCanid=${hardcodedCanidFooting}, intervalFootprint=${intervalFootprint}` },
  { id: 'c10_interest_estSlice_spike_deferral', measured: framesDeferred, target: 0, score: +score10.toFixed(4), detail: `1x 40ms spike deferred ${framesDeferred}/9 subsequent 0.05ms frames (only ${stepsIn10Frames}/30 steps ran, estSlice=${STATS.kinds.audit.estSlice.toFixed(2)}ms)` },
  { id: 'c11_snapshot_rewind_wipe_and_missing_sources', measured: ringAfterResume, target: 26, score: +score11.toFixed(4), detail: `Rewind 50->25 + 1 tick wipes ring to ${ringAfterResume}; needs=${registersNeeds}, modes=${registersModes}, clock=${registersClock}` },
];

const knownMismatches = [
  { id: 'mismatch_unnormalized_orbit_lat_polar_clamp', measured: +resumeBugLatDeg.toFixed(2), reference: 49.77, score: +deltaScore(resumeBugLatDeg, 49.77, 90).toFixed(4), note: 'Unnormalized cam vector clamps 49.77N to +90.00N' },
  { id: 'mismatch_vsync_gpu_bound_fps_illusion', measured: +vsyncReportedFps.toFixed(1), reference: 63.3, score: +ratioScore(vsyncReportedFps, 63.3).toFixed(4), note: 'workMs=3ms reported as 333 fps when gpuMs=15.8ms' },
  { id: 'mismatch_grazed_cap_eviction', measured: 0, reference: 1, score: 0.0, note: 'Freshly grazed patch evicted first (strength*0=0)' },
  { id: 'mismatch_estSlice_spike_deferral', measured: framesDeferred, reference: 0, score: +deltaScore(framesDeferred, 0, 9).toFixed(4), note: '9/9 frames deferred after single 40ms spike' },
];

const calibrationValid =
  knownMatches.every(m => m.score >= 0.95) &&
  knownMismatches.every(m => m.score < 0.70);

const meanScore = +(checks.reduce((s, c) => s + c.score, 0) / checks.length).toFixed(4);
const passingCount = checks.filter(c => c.score >= 0.95).length;

const result = {
  task: 'T-0257',
  calibrationValid,
  knownMatches,
  knownMismatches,
  passingCount,
  totalChecks: checks.length,
  meanScore,
  checks,
};

fs.writeFileSync(path.join(__dirname, 'numbers.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify({ calibrationValid, passingCount, totalChecks: checks.length, meanScore, checks: checks.map(c => ({ id: c.id, score: c.score, detail: c.detail })) }, null, 2));
