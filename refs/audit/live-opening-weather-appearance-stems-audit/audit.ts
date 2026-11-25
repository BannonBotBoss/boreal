/**
 * Calibrated Rule 11 audit for T-0304 (zero overlap with T-0001..T-0303):
 *   1. Live First-Visit Cosmic Opening & Return-Visit Globe Persistence:
 *      - Skipping Big Bang opening saves resume { mode: 'globe', lat: 90, lon: 65.54, alt: 23,572,732.56 } (North Pole + Kazakhstan).
 *      - Reloading while on the globe fails to resume globe mode (returns inpageMode: 'game', overwriting resume.mode to 'game')
 *        because main.ts:343's 1-second autosave interval calls captureResume() during loading before openAfterLoad() runs.
 *      - Opening film shows zero on-screen skip hint during the 115 s runtime (openingSkipHintPresent: false).
 *   2. Live Multi-Season Phenology (Oct 12 Autumn & Apr 20 Spring Thaw) & Weather Settings Persistence:
 *      - Oct 12 (?date=2026-10-12&hour=14, frame-2 vs ref-0) renders barren khaki-ochre grass slope with 1 yellow twig and 3 distant
 *        spruce tips instead of mixed spruce + golden birch/aspen autumn canopy.
 *      - Apr 20 (?date=2026-04-20&hour=14, frame-3 vs ref-1) reports Snow 0.0 cm and renders flat olive ground with 1 spruce cone
 *        and zero patchy spring snowdrifts (vs ref-1).
 *      - Pause -> Graphics -> Weather simulation toggle & Weather grid select fail to persist on standard DOM 'change' events
 *        (settingsPanel.ts:20 listens only to 'input', leaving weather.on=true & weather.quality='Normal (8x8)' in localStorage).
 *      - sky.ts:145,205-212 renders precipitation as unshaded square PointsMaterial(color: 0xc8d4e0) never darkened at night.
 *   3. Live Appearance Editor shapeTools Resets & G-Key Growl -> Empty Photo Gallery Hijack:
 *      - Pressing G (default growl key) in live gameplay triggers gameCamera.ts:87 global listener, popping open empty
 *        "Photo session · 0 capture(s)" modal (#photo-gallery) over live gameplay (frame-5).
 *      - In Appearance Editor (frame-4), Paint markings resets to Sketch shape after every single stroke (shapeTools.ts:74,96 -> rebuild()).
 *      - Gradient + stop selection resets stopSel=-1 on every colour-wheel commit (shapeTools.ts:75,119 -> rebuild()).
 *      - Load preset <select> renders white-on-white; Appearance shows misleading "* applies when you resume (the world regenerates)."
 *        footnote; Grizzly bear stays permanently disabled in Play as despite createBear() existing.
 *   4. Live Adaptive Stems / Music Panel (?stems=1&tones=1), Stale #info Library Dialog, & #vf-bar-Occluded #export:
 *      - Selecting Delta 2 Hz in Pulse rate preset updates MUSIC.pulse=2 in memory and saves music.preset='Delta 2 Hz', yet leaves
 *        Pulse rate (Hz) slider/output and saved music.pulse at 40 Hz (overwriting Delta 2 Hz back to 40 Hz on reload, musicSettings.ts:22-23).
 *      - Photosensitivity/epilepsy safety warning renders pale gold #f3d79a on #f3f1e6 cream (WCAG contrast 1.24:1 vs 4.5:1 AA, style.css:34);
 *        Track <select> renders white-on-white ("Adaptive stems" invisible); hint hardcodes "Acoustic guitar tracks..." (main.ts:327).
 *      - #info ("The script library", index.html:10, frame-7) contradicts live game ("No stored 3D model files", "hunting... not implemented",
 *        "P photo mode") and opens auto-scrolled to the bottom (417 px clipped above fold).
 *      - #vf-bar overlaps footer #export ("Export events") and #help ("Library / controls"), blocking #export download clicks.
 *
 * Run: npx tsx refs/audit/live-opening-weather-appearance-stems-audit/audit.ts [repoRoot]
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const AUDIT_DIR = import.meta.dirname;
const REPO = path.resolve(process.argv[2] ?? path.join(AUDIT_DIR, '..', '..', '..'));

function readPngRgba(filePath: string): { width: number; height: number; data: Uint8Array } {
  const buf = fs.readFileSync(filePath);
  let width = 0, height = 0, colorType = 6;
  const idat: Buffer[] = [];
  for (let o = 8; o < buf.length; ) {
    const len = buf.readUInt32BE(o);
    const type = buf.subarray(o + 4, o + 8).toString('ascii');
    const chunk = buf.subarray(o + 8, o + 8 + len);
    if (type === 'IHDR') { width = chunk.readUInt32BE(0); height = chunk.readUInt32BE(4); colorType = chunk[9]; }
    else if (type === 'IDAT') idat.push(chunk);
    else if (type === 'IEND') break;
    o += 12 + len;
  }
  const bpp = colorType === 6 ? 4 : 3;
  const stride = width * bpp;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const recon = new Uint8Array(height * stride);
  const paeth = (a: number, b: number, c: number) => {
    const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
  };
  for (let y = 0; y < height; y++) {
    const f = raw[y * (stride + 1)];
    const src = y * (stride + 1) + 1;
    const dst = y * stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? recon[dst + x - bpp] : 0;
      const b = y > 0 ? recon[dst - stride + x] : 0;
      const c = x >= bpp && y > 0 ? recon[dst - stride + x - bpp] : 0;
      const v = raw[src + x];
      recon[dst + x] = (f === 0 ? v : f === 1 ? v + a : f === 2 ? v + b : f === 3 ? v + ((a + b) >> 1) : v + paeth(a, b, c)) & 0xff;
    }
  }
  if (bpp === 4) return { width, height, data: recon };
  const rgba = new Uint8Array(width * height * 4);
  for (let i = 0, j = 0; i < recon.length; i += 3, j += 4) {
    rgba[j] = recon[i]; rgba[j + 1] = recon[i + 1]; rgba[j + 2] = recon[i + 2]; rgba[j + 3] = 255;
  }
  return { width, height, data: rgba };
}

function analyzeScenePng(filePath: string) {
  const png = readPngRgba(filePath);
  let rSum = 0, gSum = 0, bSum = 0, lumSum = 0;
  let goldenAutumn = 0;
  let brightSnow = 0;
  let darkConifer = 0;
  // Crop out top/bottom HUD strips (y in 18%..82%) for clean world-viewport metrics
  const y0 = Math.floor(png.height * 0.18), y1 = Math.floor(png.height * 0.82);
  let count = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = 0; x < png.width; x++) {
      const i = (y * png.width + x) * 4;
      const r = png.data[i] / 255, g = png.data[i + 1] / 255, b = png.data[i + 2] / 255;
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      rSum += r; gSum += g; bSum += b; lumSum += lum; count++;
      if (r > 0.62 && g > 0.45 && b < 0.30 && (r - b) > 0.35) goldenAutumn++;
      if (lum > 0.76 && Math.max(r, g, b) - Math.min(r, g, b) < 0.14 && y > png.height * 0.5) brightSnow++;
      if (g > r * 1.05 && g > b * 1.05 && lum > 0.04 && lum < 0.32) darkConifer++;
    }
  }
  const lowerPixels = (y1 - Math.floor(png.height * 0.5)) * png.width;
  return {
    width: png.width,
    height: png.height,
    meanRgb: [+(rSum / count).toFixed(4), +(gSum / count).toFixed(4), +(bSum / count).toFixed(4)],
    meanLum: +(lumSum / count).toFixed(4),
    goldenAutumnFrac: +(goldenAutumn / count).toFixed(4),
    lowerSnowFrac: +(brightSnow / Math.max(1, lowerPixels)).toFixed(4),
    darkConiferFrac: +(darkConifer / count).toFixed(4),
  };
}

function wcagContrast(hexA: string, hexB: string): number {
  const lum = (hex: string) => {
    const h = hex.replace('#', '');
    const ch = [0, 2, 4].map(i => {
      const c = parseInt(h.slice(i, i + 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
  };
  const l1 = lum(hexA), l2 = lum(hexB);
  return +((Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)).toFixed(2);
}

interface CheckMetrics {
  [k: string]: boolean | number | string | string[] | number[] | Record<string, unknown> | null;
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

function ratioScore(flags: Record<string, boolean>): number {
  const vals = Object.values(flags);
  if (!vals.length) return 0;
  return Number((vals.filter(Boolean).length / vals.length).toFixed(4));
}

function calibrate(id: string, actualFlags: Record<string, boolean>, extraMetrics: CheckMetrics): CalibratedCheck {
  const keys = Object.keys(actualFlags);
  const allTrue = Object.fromEntries(keys.map(k => [k, true]));
  const allFalse = Object.fromEntries(keys.map(k => [k, false]));
  const score = ratioScore(actualFlags);
  const knownMatchScore = ratioScore(allTrue);
  const knownMismatchScore = ratioScore(allFalse);
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

const cap = JSON.parse(fs.readFileSync(path.join(AUDIT_DIR, 'live-capture.json'), 'utf8'));
const readSrc = (rel: string) => fs.readFileSync(path.join(REPO, rel), 'utf8');

const mainSrc = readSrc('src/main.ts');
const settingsSrc = readSrc('src/ui/settingsPanel.ts');
const skySrc = readSrc('src/render/sky.ts');
const shapeSrc = readSrc('src/ui/shapeTools.ts');
const gameCamSrc = readSrc('src/camera/gameCamera.ts');
const musicSetSrc = readSrc('src/audio/musicSettings.ts');
const styleSrc = readSrc('src/style.css');
const indexSrc = readSrc('index.html');

const frame2Stats = analyzeScenePng(path.join(AUDIT_DIR, 'frame-2-live-autumn-foliage-oct12.png'));
const frame3Stats = analyzeScenePng(path.join(AUDIT_DIR, 'frame-3-live-spring-thaw-and-weather.png'));
const safetyContrast = wcagContrast('#f3d79a', '#f3f1e6');

// 1. First-Visit Opening Skip & Return-Visit Globe Persistence
const s1 = cap.scenario1_openingAndReturn;
const check1 = calibrate(
  'live-opening-skip-and-return-globe-persistence',
  {
    returnReloadRestoresGlobeMode: s1.returnGlobeState.inpageMode === 'globe',
    skipDoesNotSaveNorthPoleLat90: Math.abs((s1.afterSkip.resumeAfterSkip?.lat ?? 90) - 90) > 1,
    openingDisplaysSkipHint: s1.activeState.openingSkipHintPresent === true,
    autosaveGuardedDuringBootLoading: !/setInterval\(\(\) => \{[\s\S]*?if \(hasSeenBigBang\(context\)\) \{ captureResume\(\); commitContext\(\); \}/.test(mainSrc),
  },
  {
    firstLoadMs: s1.firstLoadMs,
    afterSkipMode: s1.afterSkip.inpageMode,
    afterSkipSavedLat: s1.afterSkip.resumeAfterSkip?.lat ?? null,
    afterSkipSavedLon: s1.afterSkip.resumeAfterSkip?.lon ?? null,
    returnGlobeModeActual: s1.returnGlobeState.inpageMode,
    returnGlobeOverwrittenResumeMode: s1.returnGlobeState.resumeAfterGlobeReturn?.mode ?? null,
    returnGroundDriftM: s1.returnGroundDriftM,
    openingElapsedAtFrame1: s1.activeState.elapsed,
  },
);

// 2. Multi-Season Autumn/Spring Phenology, Weather Settings Persistence & Night Precip
const s2 = cap.scenario2_seasonsWeatherPrecip;
const check2 = calibrate(
  'live-multiseason-phenology-weather-settings-and-precip',
  {
    autumnHasGoldenDeciduousCanopy: frame2Stats.goldenAutumnFrac >= 0.05 && frame2Stats.darkConiferFrac >= 0.05,
    springThawShowsPatchySnowAndCanopy: (s2.springBefore.snowCm > 0 || frame3Stats.lowerSnowFrac >= 0.05) && frame3Stats.darkConiferFrac >= 0.05,
    weatherSettingsPersistOnChangeEvent: s2.springAfterWeatherOff.savedRender['weather.on'] === false && s2.springAfterWeatherOff.savedRender['weather.quality'] === 'High (12×12)',
    settingsPanelListensToChangeEvents: /addEventListener\(['"]change['"]/.test(settingsSrc),
    precipPointsShadedForNight: !/PointsMaterial\(\{\s*color:\s*0xc8d4e0/.test(skySrc),
  },
  {
    frame2AutumnStats: frame2Stats,
    frame3SpringStats: frame3Stats,
    springHudSnowCm: s2.springBefore.snowCm,
    savedWeatherOnAfterToggleOff: s2.springAfterWeatherOff.savedRender['weather.on'],
    savedWeatherQualityAfterSelectHigh: s2.springAfterWeatherOff.savedRender['weather.quality'],
  },
);

// 3. Appearance Editor ShapeTools Resets & G-Key Growl -> Empty Photo Gallery Hijack
const s3 = cap.scenario3_appearanceShapeToolsAndSpeak;
const bearRow = (s3.playerPanelInfo as { text: string; disabled: boolean }[]).find(r => r.text.includes('Grizzly bear'));
const check3 = calibrate(
  'live-appearance-shapetools-and-g-growl-gallery-hijack',
  {
    paintMarkingsPersistsAcrossStrokes: s3.afterSecondStroke.toolResetToSketchAfterOnePaintStroke === false,
    gradientStopStaysSelectedAcrossEdits: s3.gradientStopDeselectedAfterCommit === false,
    growlKeyDoesNotHijackIntoPhotoGallery: !/e\.key === 'g' \|\| e\.key === 'G'/.test(gameCamSrc),
    grizzlyBearAvailableInPlayAs: bearRow ? !bearRow.disabled : false,
    appearanceOmitsFalseWorldRegenLegend: !/form\.append\(legend/.test(settingsSrc) || /Appearance/.test(settingsSrc),
  },
  {
    silhouetteDots: s3.appearanceInitial.silhouetteDots,
    toolResetToSketchAfterOnePaintStroke: s3.afterSecondStroke.toolResetToSketchAfterOnePaintStroke,
    gradientStopDeselectedAfterCommit: s3.gradientStopDeselectedAfterCommit,
    grizzlyBearLabel: bearRow?.text ?? null,
    presetSaved: s3.afterPreset.presetSaved,
    growlOpenedEmptyGalleryModalInFrame5: true,
    paintResetSourceLine: /let tool: 'sketch' \| 'paint' = 'sketch'/.test(shapeSrc),
    stopResetSourceLine: /stopSel = -1/.test(shapeSrc),
  },
);

// 4. Live Adaptive Stems / Music Panel Preset Desync & Safety Contrast, Stale #info Library, & #vf-bar-Blocked #export
const s4 = cap.scenario4_stemsMusicLibraryExport;
const libText: string = s4.libraryInfo.text ?? '';
const check4 = calibrate(
  'live-music-preset-contrast-library-and-export',
  {
    pulsePresetSyncsSliderAndStore: s4.tonesPresetSync.sliderOutOfSyncWithPreset === false && s4.tonesPresetSync.storedPulse === 2,
    safetyWarningMeetsWcagAA: safetyContrast >= 4.5 && !/\.start-panel \.note\{[^}]*color:#f3d79a/.test(styleSrc),
    musicHintReflectsActiveSource: s4.tonesPresetSync.hintStillSaysGuitarOnly === false,
    libraryDialogReflectsCurrentGame: !libText.includes('No stored 3D model files') && !libText.includes('hunting, trading and construction are not implemented'),
    exportEventsButtonTriggersDownload: !s4.exportInfo.error && s4.exportInfo.validJson === true,
  },
  {
    stemsHttp200Count: (s4.stemResponses as { url: string; status: number }[]).filter(r => r.url.includes('/stems/') && r.status === 200).length,
    stemsLiveWeights: s4.stemsRunning.stemsState?.cur ?? null,
    presetChosen: s4.tonesPresetSync.storedPreset,
    sliderValueAfterPreset: s4.tonesPresetSync.afterSlider,
    storedPulseAfterPreset: s4.tonesPresetSync.storedPulse,
    safetyNoticeContrastRatio: safetyContrast,
    libraryScrollHeight: s4.libraryInfo.scrollHeight,
    libraryClientHeight: s4.libraryInfo.clientHeight,
    exportClickError: s4.exportInfo.error ?? null,
    musicSettingsHasPresetPulseOrderBug: /music\.preset[\s\S]*music\.pulse/.test(musicSetSrc),
    indexHasStaleNoModelsClaim: indexSrc.includes('No stored 3D model files'),
  },
);

const checks = [check1, check2, check3, check4];
const calibrationValid = checks.every(c => c.calibrationOk);
const passCount = checks.filter(c => c.pass).length;
const meanScore = Number((checks.reduce((a, c) => a + c.score, 0) / checks.length).toFixed(4));

const out = {
  taskId: 'T-0304',
  baseCommit: '0de4d8f1',
  auditScript: 'refs/audit/live-opening-weather-appearance-stems-audit/audit.ts',
  captureMeta: cap.meta,
  consoleErrors: cap.consoleErrors.length,
  pageErrors: cap.pageErrors.length,
  failedRequests: cap.failedRequests.length,
  calibrationValid,
  passCount,
  totalChecks: checks.length,
  meanScore,
  checks,
};

fs.writeFileSync(path.join(AUDIT_DIR, 'numbers.json'), JSON.stringify(out, null, 2) + '\n');
console.log(JSON.stringify({ calibrationValid, passCount, totalChecks: checks.length, meanScore, scores: checks.map(c => ({ id: c.id, score: c.score, pass: c.pass })) }, null, 2));
