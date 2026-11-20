/**
 * Calibrated Rule 11 verification script for T-0294:
 * Shipped Audio Mastering & Loop Seams, Public Production Bundle Bloat / Licencing / Base-Path URLs,
 * Tree/Animal GLB PBR & cc0Impostors Atlas Baking, and Live Autoplay / Visual Fidelity.
 *
 * Run: npx tsx refs/audit/shipped-assets-audio-impostors-autoplay-audit/audit.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = path.resolve(import.meta.dirname, '../../..');
const AUDIT_DIR = import.meta.dirname;

interface CheckResult {
  id: string;
  score: number;
  pass: boolean;
  knownMatchScore: number;
  knownMismatchScore: number;
  metrics: Record<string, unknown>;
}

const round4 = (v: number) => Number(v.toFixed(4));

function measureAudio(relPath: string) {
  const full = path.join(ROOT, relPath);
  const probeOut = spawnSync('ffprobe', ['-v', 'quiet', '-print_format', 'json', '-show_format', '-show_streams', full], { encoding: 'utf8' });
  const probe = JSON.parse(probeOut.stdout);
  const s = probe.streams[0];
  const dur = Number(probe.format?.duration ?? s?.duration ?? 0);
  const sr = Number(s?.sample_rate ?? 0);
  const ch = Number(s?.channels ?? 0);
  const ebu = spawnSync('ffmpeg', ['-hide_banner', '-i', full, '-af', 'ebur128=peak=true', '-f', 'null', '-'], { encoding: 'utf8' });
  let lufs: number | null = null;
  let truePeak: number | null = null;
  for (const raw of ebu.stderr.split(/\r?\n/)) {
    const line = raw.trim();
    if (line.startsWith('I:')) lufs = Number(line.slice(2).split('LUFS')[0].trim());
    if (line.startsWith('Peak:')) truePeak = Number(line.slice(5).split('dBFS')[0].trim());
  }
  return { file: relPath, bytes: fs.statSync(full).size, dur: round4(dur), sr, ch, lufs, truePeak };
}

function measureSilenceEndsMs(relPath: string): { leadMs: number; trailMs: number; totalGapMs: number } {
  const full = path.join(ROOT, relPath);
  const res = spawnSync('ffmpeg', ['-v', 'quiet', '-i', full, '-ac', '1', '-ar', '44100', '-f', 'f32le', '-'], { maxBuffer: 64 * 1024 * 1024 });
  const buf = res.stdout as Buffer;
  const view = new Float32Array(buf.buffer, buf.byteOffset, Math.floor(buf.byteLength / 4));
  let lead = 0;
  while (lead < view.length && Math.abs(view[lead]) <= 1e-3) lead++;
  let trail = 0;
  while (trail < view.length && Math.abs(view[view.length - 1 - trail]) <= 1e-3) trail++;
  const leadMs = Number(((lead / 44100) * 1000).toFixed(1));
  const trailMs = Number(((trail / 44100) * 1000).toFixed(1));
  return { leadMs, trailMs, totalGapMs: Number((leadMs + trailMs).toFixed(1)) };
}

function parseGlbJson(relPath: string) {
  const buf = fs.readFileSync(path.join(ROOT, relPath));
  const jsonLen = buf.readUInt32LE(12);
  return JSON.parse(buf.subarray(20, 20 + jsonLen).toString('utf8'));
}

function walkFiles(dir: string): string[] {
  const out: string[] = [];
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walkFiles(p));
    else if (e.isFile()) out.push(p);
  }
  return out;
}

// ---------------------------------------------------------------------------
// 1. Shipped Audio Mastering, True-Peak Clipping, Pup Loudness & Loop Seams
// ---------------------------------------------------------------------------
function scoreAudioCheck(m: {
  clippingActiveCount: number;
  maxTruePeakDb: number;
  pupCallSpreadLu: number;
  pupHasPerClipTrim: boolean;
  pupHasMp3Fallback: boolean;
  maxMusicLoopGapMs: number;
  underMasteredSfxCount: number;
  bigBangSampleRateMismatch: number;
  bigBangVoSpreadLu: number;
}): number {
  const c1 = m.clippingActiveCount === 0 && m.maxTruePeakDb <= -1.0 ? 1 : 0;
  const c2 = m.pupCallSpreadLu <= 4.0 && m.pupHasPerClipTrim && m.pupHasMp3Fallback ? 1 : 0;
  const c3 = m.maxMusicLoopGapMs <= 20 ? 1 : 0;
  const c4 = m.underMasteredSfxCount === 0 ? 1 : 0;
  const c5 = m.bigBangSampleRateMismatch === 0 && m.bigBangVoSpreadLu <= 4.0 ? 1 : 0;
  return round4((c1 + c2 + c3 + c4 + c5) / 5);
}

const activeAudioPaths = [
  ...fs.readdirSync(path.join(ROOT, 'public/sounds')).filter(f => f.endsWith('.mp3')).map(f => `public/sounds/${f}`),
  ...fs.readdirSync(path.join(ROOT, 'public/sounds/pups')).filter(f => f.endsWith('.ogg')).map(f => `public/sounds/pups/${f}`),
  ...fs.readdirSync(path.join(ROOT, 'public/audio/big-bang')).filter(f => f.endsWith('.mp3') && !f.includes('-alt1')).map(f => `public/audio/big-bang/${f}`),
].sort();

const audioRows = activeAudioPaths.map(measureAudio);
const clippingActive = audioRows.filter(r => r.truePeak !== null && r.truePeak > -0.05);
const maxTruePeakDb = Math.max(...audioRows.map(r => r.truePeak ?? -99));
const call1 = audioRows.find(r => r.file.endsWith('call_01.ogg'))!;
const call2 = audioRows.find(r => r.file.endsWith('call_02.ogg'))!;
const pupCallSpreadLu = Number(Math.abs((call1.lufs ?? 0) - (call2.lufs ?? 0)).toFixed(1));
const musicDayGap = measureSilenceEndsMs('public/sounds/music-day.mp3');
const musicNightGap = measureSilenceEndsMs('public/sounds/music-night.mp3');
const maxMusicLoopGapMs = Math.max(musicDayGap.totalGapMs, musicNightGap.totalGapMs);

const borealSoundSrc = fs.readFileSync(path.join(ROOT, 'src/audio/borealSound.ts'), 'utf8');
const pupHasPerClipTrim = /playPup[\s\S]*?(PUP_TRIM|trim\()/.test(borealSoundSrc);
const pupHasMp3Fallback = /sounds\/pups\/\$\{name\}\.mp3/.test(borealSoundSrc);

// Check SFX that stay > 8 LU below -20 LUFS even after +18 dB clamp (i.e. raw LUFS < -46)
const underMasteredSfx = audioRows.filter(r => r.file.startsWith('public/sounds/') && !r.file.includes('/pups/') && r.lufs !== null && r.lufs < -46);
const bigBangActive = audioRows.filter(r => r.file.startsWith('public/audio/big-bang/'));
const bigBangSampleRateMismatch = bigBangActive.filter(r => r.sr !== 44100).length;
const bigBangVo = bigBangActive.filter(r => /narration|vo-b/.test(r.file));
const bigBangVoSpreadLu = Number((Math.max(...bigBangVo.map(r => r.lufs ?? -99)) - Math.min(...bigBangVo.map(r => r.lufs ?? 0))).toFixed(1));
const narrationDurS = bigBangActive.find(r => r.file.endsWith('narration.mp3'))!.dur;

const audioMetrics = {
  activeFilesMeasured: audioRows.length,
  clippingActiveCount: clippingActive.length,
  clippingActiveFiles: clippingActive.map(r => `${r.file} (${r.truePeak} dBTP)`),
  maxTruePeakDb,
  pupCall1Lufs: call1.lufs,
  pupCall2Lufs: call2.lufs,
  pupCallSpreadLu,
  pupHasPerClipTrim,
  pupHasMp3Fallback,
  musicDayGapMs: musicDayGap,
  musicNightGapMs: musicNightGap,
  maxMusicLoopGapMs,
  underMasteredSfxCount: underMasteredSfx.length,
  underMasteredSfxFiles: underMasteredSfx.map(r => `${r.file} (${r.lufs} LUFS)`),
  bigBangSampleRateMismatch,
  bigBangVoSpreadLu,
  narrationDurMeasuredS: narrationDurS,
  narrationDurReadmeS: 5.851429,
};

const check1: CheckResult = {
  id: 'shipped-audio-mastering-and-loop-seams',
  score: scoreAudioCheck(audioMetrics),
  pass: scoreAudioCheck(audioMetrics) >= 0.95,
  knownMatchScore: scoreAudioCheck({
    clippingActiveCount: 0, maxTruePeakDb: -1.5, pupCallSpreadLu: 2.0, pupHasPerClipTrim: true,
    pupHasMp3Fallback: true, maxMusicLoopGapMs: 5, underMasteredSfxCount: 0, bigBangSampleRateMismatch: 0, bigBangVoSpreadLu: 1.5,
  }),
  knownMismatchScore: scoreAudioCheck({
    clippingActiveCount: 13, maxTruePeakDb: 3.4, pupCallSpreadLu: 27.3, pupHasPerClipTrim: false,
    pupHasMp3Fallback: false, maxMusicLoopGapMs: 1047, underMasteredSfxCount: 2, bigBangSampleRateMismatch: 2, bigBangVoSpreadLu: 8.4,
  }),
  metrics: audioMetrics,
};

// ---------------------------------------------------------------------------
// 2. Shipped public/ Bundle Bloat, Licencing, Base-Path URLs & detect-gpu
// ---------------------------------------------------------------------------
function scorePublicBundleCheck(m: {
  deadPublicBytes: number;
  unlicencedBinaryDirs: number;
  brokenBasePathUrls: number;
  silsoPublicImportBug: boolean;
  rtx5060DetectGpuHits: number;
}): number {
  const c1 = m.deadPublicBytes === 0 ? 1 : 0;
  const c2 = m.unlicencedBinaryDirs === 0 ? 1 : 0;
  const c3 = m.brokenBasePathUrls === 0 ? 1 : 0;
  const c4 = !m.silsoPublicImportBug ? 1 : 0;
  const c5 = m.rtx5060DetectGpuHits > 0 ? 1 : 0;
  return round4((c1 + c2 + c3 + c4 + c5) / 5);
}

const totalPublicBytes = walkFiles(path.join(ROOT, 'public')).reduce((s, p) => s + fs.statSync(p).size, 0);
const deadGroups: Record<string, string[]> = {
  cinematicPlaceholders: walkFiles(path.join(ROOT, 'public/cinematic/refs')).filter(p => !p.endsWith('.md')),
  unusedBakes: ['earth-parcels.bin', 'earth-parcels.json', 'earth-mix-6k.bin', 'earth-mix-6k.json'].map(f => path.join(ROOT, 'public/bake', f)).filter(fs.existsSync),
  unusedPupMp3s: walkFiles(path.join(ROOT, 'public/sounds/pups')).filter(p => p.endsWith('.mp3')),
  unusedSilsoMonthly: [path.join(ROOT, 'public/data/silso/SN_m_tot_V2.0.csv')].filter(fs.existsSync),
  aerialBuildSources: walkFiles(path.join(ROOT, 'public/aerial/source')),
  bigBangSpareTakes: walkFiles(path.join(ROOT, 'public/audio/big-bang')).filter(p => p.includes('-alt1.mp3')),
};
const deadByGroupBytes = Object.fromEntries(
  Object.entries(deadGroups).map(([k, list]) => [k, list.reduce((s, p) => s + fs.statSync(p).size, 0)]),
);
const deadPublicBytes = Object.values(deadByGroupBytes).reduce((a, b) => a + b, 0);

const licenceDirs = ['public/models/animals', 'public/sounds', 'public/globe'];
const missingLicenceDirs = licenceDirs.filter(d => {
  const names = fs.readdirSync(path.join(ROOT, d)).map(n => n.toLowerCase());
  return !names.some(n => n.includes('licence') || n.includes('license') || n.includes('credit'));
});
const unlicencedBinaryBytes = missingLicenceDirs.reduce((sum, d) => {
  const dirFull = path.join(ROOT, d);
  const files = d === 'public/sounds'
    ? [...fs.readdirSync(dirFull).filter(f => f.endsWith('.mp3')).map(f => path.join(dirFull, f)), ...walkFiles(path.join(dirFull, 'voice'))]
    : walkFiles(dirFull);
  return sum + files.reduce((s, p) => s + fs.statSync(p).size, 0);
}, 0);

const parcelsSrc = fs.readFileSync(path.join(ROOT, 'src/world/globe/parcels.ts'), 'utf8');
const openingSrc = fs.readFileSync(path.join(ROOT, 'src/world/cosmos/opening.ts'), 'utf8');
const sunViewSrc = fs.readFileSync(path.join(ROOT, 'src/world/sun/sunView.ts'), 'utf8');
const parcelsHardcodedRoot = /DEFAULT_BAKE\s*=\s*['"]\/bake\//.test(parcelsSrc) && !/asset\(/.test(parcelsSrc);
const openingRawCineRefs = /['"]cinematic\/refs\/PLACEHOLDER_/.test(openingSrc) && !/asset\(['"]cinematic\/refs/.test(openingSrc);
const silsoPublicImportBug = /new URL\(['"]\.\.\/\.\.\/\.\.\/public\/data\/silso\//.test(sunViewSrc);
const brokenBasePathUrls = (parcelsHardcodedRoot ? 1 : 0) + (openingRawCineRefs ? 1 : 0);

const rtx5060DetectGpuHits = walkFiles(path.join(ROOT, 'public/detect-gpu'))
  .filter(p => p.endsWith('.json'))
  .filter(p => fs.readFileSync(p, 'utf8').includes('5060')).length;

const bundleMetrics = {
  totalPublicMB: Number((totalPublicBytes / 1e6).toFixed(2)),
  deadPublicBytes,
  deadPublicMB: Number((deadPublicBytes / 1e6).toFixed(2)),
  deadSharePct: Number(((deadPublicBytes / totalPublicBytes) * 100).toFixed(2)),
  deadByGroupBytes,
  unlicencedBinaryDirs: missingLicenceDirs.length,
  missingLicenceDirs,
  unlicencedBinaryMB: Number((unlicencedBinaryBytes / 1e6).toFixed(2)),
  parcelsHardcodedRoot,
  openingRawCineRefs,
  brokenBasePathUrls,
  silsoPublicImportBug,
  rtx5060DetectGpuHits,
};

const check2: CheckResult = {
  id: 'public-bundle-bloat-licencing-and-basepath',
  score: scorePublicBundleCheck(bundleMetrics),
  pass: scorePublicBundleCheck(bundleMetrics) >= 0.95,
  knownMatchScore: scorePublicBundleCheck({
    deadPublicBytes: 0, unlicencedBinaryDirs: 0, brokenBasePathUrls: 0, silsoPublicImportBug: false, rtx5060DetectGpuHits: 1,
  }),
  knownMismatchScore: scorePublicBundleCheck({
    deadPublicBytes: 5_890_000, unlicencedBinaryDirs: 3, brokenBasePathUrls: 2, silsoPublicImportBug: true, rtx5060DetectGpuHits: 0,
  }),
  metrics: bundleMetrics,
};

// ---------------------------------------------------------------------------
// 3. Tree/Animal GLB PBR, cc0Impostors Atlas Clipping & Blue Marble Resolution
// ---------------------------------------------------------------------------
function scoreGlbImpostorCheck(m: {
  treeGlbMetallicCount: number;
  cc0ImpostorsTopClipPct: number;
  cc0ImpostorsLinearTaggedSrgb: boolean;
  cc0ImpostorsDisposesGlb: boolean;
  animalGlbDoubleSidedCount: number;
  blueMarbleWidthPx: number;
}): number {
  const c1 = m.treeGlbMetallicCount === 0 ? 1 : 0;
  const c2 = m.cc0ImpostorsTopClipPct <= 1.0 ? 1 : 0;
  const c3 = !m.cc0ImpostorsLinearTaggedSrgb && m.cc0ImpostorsDisposesGlb ? 1 : 0;
  const c4 = m.animalGlbDoubleSidedCount === 0 ? 1 : 0;
  const c5 = m.blueMarbleWidthPx >= 2048 ? 1 : 0;
  return round4((c1 + c2 + c3 + c4 + c5) / 5);
}

const treeGlbs = fs.readdirSync(path.join(ROOT, 'public/models/trees')).filter(f => f.endsWith('.glb')).sort();
let treeGlbMetallicCount = 0;
for (const f of treeGlbs) {
  const j = parseGlbJson(`public/models/trees/${f}`);
  const hasMetallic1 = (j.materials ?? []).some((m: { pbrMetallicRoughness?: { metallicFactor?: number; metallicRoughnessTexture?: unknown } }) => {
    const pbr = m.pbrMetallicRoughness ?? {};
    return !pbr.metallicRoughnessTexture && (pbr.metallicFactor ?? 1) >= 0.99;
  });
  if (hasMetallic1) treeGlbMetallicCount++;
}

const animalGlbs = fs.readdirSync(path.join(ROOT, 'public/models/animals')).filter(f => f.endsWith('.glb')).sort();
let animalGlbDoubleSidedCount = 0;
let animalGlbCopyrightCount = 0;
const animalTris: Record<string, number> = {};
for (const f of animalGlbs) {
  const j = parseGlbJson(`public/models/animals/${f}`);
  if (j.asset?.copyright) animalGlbCopyrightCount++;
  if ((j.materials ?? []).some((m: { doubleSided?: boolean }) => m.doubleSided === true)) animalGlbDoubleSidedCount++;
  let tris = 0;
  for (const mesh of j.meshes ?? []) {
    for (const prim of mesh.primitives ?? []) {
      tris += prim.indices !== undefined ? Math.floor(j.accessors[prim.indices].count / 3) : Math.floor(j.accessors[prim.attributes.POSITION].count / 3);
    }
  }
  animalTris[f] = tris;
}

const cc0Src = fs.readFileSync(path.join(ROOT, 'src/render/trees/cc0Impostors.ts'), 'utf8');
// Analytic frustum check from frame(): fov=28, dist=1.35*size.y, cam=(0.35*dist, 0.42*size.y, dist), lookAt=(0, 0.38*size.y, 0)
const fovRad = (28 * Math.PI) / 180;
const camDist = Math.hypot(0.35 * 1.35, 1.35);
const visibleTopY = 0.38 + camDist * Math.tan(fovRad / 2);
const cc0ImpostorsTopClipPct = Number(((1 - Math.min(1, visibleTopY)) * 100).toFixed(1));
const cc0ImpostorsLinearTaggedSrgb = /NoToneMapping/.test(cc0Src) && /albedo\.colorSpace\s*=\s*THREE\.SRGBColorSpace/.test(cc0Src);
const cc0ImpostorsDisposesGlb = /mesh\.geometry\.dispose\(\)/.test(cc0Src);

const bmProbe = JSON.parse(
  spawnSync('ffprobe', ['-v', 'quiet', '-print_format', 'json', '-show_streams', path.join(ROOT, 'public/globe/blue-marble-200408.jpg')], { encoding: 'utf8' }).stdout,
);
const blueMarbleWidthPx = Number(bmProbe.streams[0].width);
const blueMarbleHeightPx = Number(bmProbe.streams[0].height);
const blueMarbleKmPerPxEq = Number((40075.017 / blueMarbleWidthPx).toFixed(2));

const glbMetrics = {
  treeGlbCount: treeGlbs.length,
  treeGlbMetallicCount,
  cc0ImpostorsVisibleTopShare: round4(visibleTopY),
  cc0ImpostorsTopClipPct,
  cc0ImpostorsLinearTaggedSrgb,
  cc0ImpostorsDisposesGlb,
  animalGlbCount: animalGlbs.length,
  animalGlbDoubleSidedCount,
  animalGlbCopyrightCount,
  ermineTris: animalTris['ermine.glb'],
  mooseTris: animalTris['moose.glb'],
  blueMarbleWidthPx,
  blueMarbleHeightPx,
  blueMarbleKmPerPxEq,
};

const check3: CheckResult = {
  id: 'tree-impostors-glb-pbr-and-blue-marble',
  score: scoreGlbImpostorCheck(glbMetrics),
  pass: scoreGlbImpostorCheck(glbMetrics) >= 0.95,
  knownMatchScore: scoreGlbImpostorCheck({
    treeGlbMetallicCount: 0, cc0ImpostorsTopClipPct: 0, cc0ImpostorsLinearTaggedSrgb: false,
    cc0ImpostorsDisposesGlb: true, animalGlbDoubleSidedCount: 0, blueMarbleWidthPx: 4096,
  }),
  knownMismatchScore: scoreGlbImpostorCheck({
    treeGlbMetallicCount: 5, cc0ImpostorsTopClipPct: 26.3, cc0ImpostorsLinearTaggedSrgb: true,
    cc0ImpostorsDisposesGlb: false, animalGlbDoubleSidedCount: 21, blueMarbleWidthPx: 1024,
  }),
  metrics: glbMetrics,
};

// ---------------------------------------------------------------------------
// 4. Live ?autoplay=1 Boot Experience & Visual Fidelity Against References
// ---------------------------------------------------------------------------
const live = JSON.parse(fs.readFileSync(path.join(AUDIT_DIR, 'live-capture.json'), 'utf8'));
const webmBytes = fs.statSync(path.join(AUDIT_DIR, 'recording.webm')).size;
const framesPresent = [
  'frame-0-live-autoplay-visit.png',
  'frame-1-live-globe-blue-marble.png',
  'frame-2-live-forest-horizon-impostors.png',
  'frame-3-live-tree-impostor-atlas.png',
].filter(f => fs.existsSync(path.join(AUDIT_DIR, f))).length;
const refsPresent = [
  'reference/ref-0-boreal-trees-spruce-birch-reference.jpg',
  'reference/ref-1-earth-orbit-north-america-reference.jpg',
].filter(f => fs.existsSync(path.join(AUDIT_DIR, f))).length;

function scoreLiveCheck(m: {
  consoleErrors: number;
  pageErrors: number;
  framesPresent: number;
  refsPresent: number;
  webmBytes: number;
  atlasLinearGreenReflectance: number;
  globeLoadingCleared: boolean;
  autoplaySingleBootUnder15s: boolean;
  forestVisualNaturalMatch: boolean;
}): number {
  let pts = 0;
  if (m.consoleErrors === 0 && m.pageErrors === 0) pts += 1;
  if (m.framesPresent === 4 && m.refsPresent === 2 && m.webmBytes >= 50_000) pts += 1;
  if (m.atlasLinearGreenReflectance >= 0.04 && m.atlasLinearGreenReflectance <= 0.16) pts += 1;
  if (m.globeLoadingCleared && m.autoplaySingleBootUnder15s) pts += 1;
  if (m.forestVisualNaturalMatch) pts += 1;
  return round4(pts / 5);
}

const gByte = Number(live.atlasMetrics?.meanOpaqueRGB?.[1] ?? 0);
const atlasLinearGreenReflectance = round4(Math.pow(gByte / 255, 2.2));
const liveMetrics = {
  consoleErrors: live.consoleErrors.length,
  pageErrors: live.pageErrors.length,
  framesPresent,
  refsPresent,
  webmBytes,
  autoplayLogs: live.autoplayLogs,
  autoplayElapsedS: live.autoplayElapsedS,
  autoplayStillInSecondLoadingAfter40s: !!live.autoplayPhaseAfter25s?.hasLoading,
  autoplaySingleBootUnder15s: false,
  globeLoadingCleared: !live.globeMetrics?.loadingInDom,
  atlasMeanOpaqueRGB: live.atlasMetrics?.meanOpaqueRGB,
  atlasLinearGreenReflectance,
  forestVisualNaturalMatch: false,
};

const check4: CheckResult = {
  id: 'live-autoplay-atlas-and-visual-fidelity',
  score: scoreLiveCheck(liveMetrics),
  pass: scoreLiveCheck(liveMetrics) >= 0.95,
  knownMatchScore: scoreLiveCheck({
    consoleErrors: 0, pageErrors: 0, framesPresent: 4, refsPresent: 2, webmBytes: 574165,
    atlasLinearGreenReflectance: 0.07, globeLoadingCleared: true, autoplaySingleBootUnder15s: true, forestVisualNaturalMatch: true,
  }),
  knownMismatchScore: scoreLiveCheck({
    consoleErrors: 2, pageErrors: 1, framesPresent: 0, refsPresent: 0, webmBytes: 0,
    atlasLinearGreenReflectance: 0.014, globeLoadingCleared: false, autoplaySingleBootUnder15s: false, forestVisualNaturalMatch: false,
  }),
  metrics: liveMetrics,
};

const checks = [check1, check2, check3, check4];
const calibrationValid = checks.every(c => c.knownMatchScore >= 0.95 && c.knownMismatchScore <= 0.25);
const passCount = checks.filter(c => c.pass).length;
const meanScore = round4(checks.reduce((s, c) => s + c.score, 0) / checks.length);

const out = {
  taskId: 'T-0294',
  commit: '37713319',
  auditedAt: '2026-11-20T11:52-08:00',
  calibrationValid,
  passCount,
  totalChecks: checks.length,
  meanScore,
  checks,
};

fs.writeFileSync(path.join(AUDIT_DIR, 'numbers.json'), JSON.stringify(out, null, 2) + '\n', 'utf8');
console.log(JSON.stringify({ calibrationValid, passCount, totalChecks: checks.length, meanScore, scores: checks.map(c => [c.id, c.score]) }, null, 2));
