/**
 * Calibrated Rule 11 audit for T-0303 (zero overlap with T-0001..T-0302):
 *   1. Live Photo Mode Rewind Completeness, Focal-Length Default Clamp, Exit-While-Recording Race, & Viewfinder Gallery Edit Live-World Leak:
 *      - Opening Gallery from #vf-bar after leaving Photo Mode and clicking Edit calls photoMode.ts:134 edit(c) without
 *        setting active=true or body.photo-mode -> world never freezes (shaderTimeDeltaDuringEdit > 0.25 s), W walks the wolf
 *        (2.60 m) instead of flying the camera, and full gameplay HUD stays visible colliding with #photo-edit and #photo-panel (frame-1).
 *      - Pressing Esc/P while MediaRecorder is actively recording (gallery.count === 0) exits Photo Mode before async
 *        recorder.onstop fires -> gallery never opens (galleryOpen=false) and "Video kept" toast fires in live gameplay (photoMode.ts:239-243).
 *      - buildScene.ts:626-637 snapshotSources omits litter (wolf pups), driveBridge (Red Fox), needs, and worldSec/sky.
 *      - PHOTO_PARAMS focalLength default value=0 is below min=12 (post.ts:22), clamping the range slider to 12 mm vs ~27 mm (48 deg FOV).
 *   2. Live V Camera Adjust Mode Desktop Dead-End, Hardcoded Xbox Labels on Desktop HUD, & Silent Low-Energy Jump Block:
 *      - With 0 gamepads connected, pressing V (cameraMode) with #camera-panel closed hijacks desktop keyboard into Pad Menu
 *        Badges tab (padRouter.ts:53); with badges unlocked, V opens Xbox-only .padx bar over footer buttons, yet 0 keyboard keys
 *        can navigate/adjust/dismiss it (padRouter.ts:106 passes empty [] keys) and Escape opens Pause Menu behind .padx (frame-3).
 *      - With 0 gamepads connected, #status hardcodes "RT run · LT stealth · LB focus · Q lock" (frame-2) and when exhausted
 *        "Recover to 20 stamina; release triggers" (frame-3, main.ts:795).
 *      - Pressing Space at Energy <= 10 (e.g. ?needs=energy:8) silently ignores jump with 0 user feedback (main.ts:645).
 *   3. Live Audio Hotkey Hijack (Ctrl+-/Ctrl+M & Focused <select>), Split-Window 640x720 HUD Overlap, & Unrecoverable WebGL Context Loss:
 *      - borealSound.ts:127-135 omits modifier checks (e.ctrlKey/e.metaKey/e.altKey) and SELECT/TEXTAREA guards -> Ctrl+- and Ctrl+M
 *        silently mutate volume.music & volume.muted with 0 notice, and typing n/[/- while a #photo-panel <select> has focus
 *        mutates master/music/muted (selectKeyHijackedAudio=true).
 *      - On WEBGL_lose_context, main.ts:485 shows a plain text notice with 0 Reload button, keeps requestAnimationFrame spinning
 *        (42 ticks in 1.5 s) into the lost context, and leaves Pause/Photo/footer HUD buttons clickable over a blank screen (frame-5).
 *      - On desktop 640x720 split resize, Data (U) covers header and #interaction ("Explore") overlaps #status (frame-4).
 *   4. Live In-Page Mid-Altitude Drone Flight Band (Shift+G Ascent Snap, 1-Frame Embody Teleport, Blocky 400m Day Ground, & Midnight Whiteout + Blue Fog):
 *      - Shift+G climbs to 2,100 m then snaps 6,674.4x instantaneously to 14,016,219 m in toGlobe(true) (inpage.ts:218, 456).
 *      - Pressing G to embody from 401 m teleports camera Y 404.35 m -> 4.47 m in 1 frame (blend=1; handoverBlend is a no-op, inpage.ts:412, 444).
 *      - At 01:05 AM midnight (?hour=1, 400 m), inpage.ts:476 forces hardcoded midday blue fog RGB(0.45, 0.62, 0.9) and
 *        inpage.ts:473-474 blows out >80% of the frame into blinding clipped white/chartreuse vs dark midnight reference ref-1 (frame-7).
 *      - At daytime 400 m (frame-6), ground renders flat blocky brown-ochre polygons with near-zero conifer green dominance vs ref-0.
 *
 * Run: npx tsx refs/audit/live-photo-needs-webgl-drone-audit/audit.ts [repoRoot]
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

interface CheckMetrics {
  [k: string]: boolean | number | string | string[] | Record<string, unknown> | null;
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

function analyzePng(filePath: string) {
  const png = readPngRgba(filePath);
  let sumLum = 0;
  let clippedWhite = 0;
  let greenDominant = 0;
  let rSum = 0, gSum = 0, bSum = 0;
  const total = png.width * png.height;
  for (let i = 0; i < png.data.length; i += 4) {
    const r = png.data[i] / 255;
    const g = png.data[i + 1] / 255;
    const b = png.data[i + 2] / 255;
    rSum += r; gSum += g; bSum += b;
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    sumLum += lum;
    if (lum > 0.92) clippedWhite++;
    if (g > r + 0.03 && g > b + 0.03 && lum > 0.08 && lum < 0.75) greenDominant++;
  }
  return {
    width: png.width,
    height: png.height,
    meanLum: Number((sumLum / total).toFixed(4)),
    meanRgb: [Number((rSum / total).toFixed(3)), Number((gSum / total).toFixed(3)), Number((bSum / total).toFixed(3))],
    clippedWhiteFrac: Number((clippedWhite / total).toFixed(4)),
    greenDominantFrac: Number((greenDominant / total).toFixed(4)),
  };
}

const live = JSON.parse(fs.readFileSync(path.join(AUDIT_DIR, 'live-capture.json'), 'utf8'));
const photoModeSrc = fs.readFileSync(path.join(REPO, 'src/photo/photoMode.ts'), 'utf8');
const buildSceneSrc = fs.readFileSync(path.join(REPO, 'src/render/buildScene.ts'), 'utf8');
const postSrc = fs.readFileSync(path.join(REPO, 'src/render/post.ts'), 'utf8');
const padRouterSrc = fs.readFileSync(path.join(REPO, 'src/input/padRouter.ts'), 'utf8');
const mainSrc = fs.readFileSync(path.join(REPO, 'src/main.ts'), 'utf8');
const borealSoundSrc = fs.readFileSync(path.join(REPO, 'src/audio/borealSound.ts'), 'utf8');
const inpageSrc = fs.readFileSync(path.join(REPO, 'src/world/globe/inpage.ts'), 'utf8');

// =============================================================================
// CHECK 1: Photo Mode Rewind Sources, Focal Default, Exit-While-Recording Race, & VF-Bar Gallery Edit
// =============================================================================
const p1 = live.part1_photoRewindVideoSeqEdit;
const editFreezesWorldAndHidesHud = p1?.editFromVfBar?.bodyHasPhotoModeClass === true
  && p1?.editFromVfBar?.worldKeptSimulatingWhileEditing === false
  && (p1?.editFromVfBar?.wolfWalkedInsteadOfCameraFly ?? 99) < 0.05;

const exitAwaitsActiveRecorder = p1?.exitWhileRecordingRace?.galleryOpen === true
  && !/if \(recorder\) recorder\.stop\(\);/.test(photoModeSrc);

const snapshotCoversLitterAndFox = /litter|pups/.test(buildSceneSrc.slice(buildSceneSrc.indexOf('snapshotSources'), buildSceneSrc.indexOf('snapshotSources') + 900))
  && /drive|fox/.test(buildSceneSrc.slice(buildSceneSrc.indexOf('snapshotSources'), buildSceneSrc.indexOf('snapshotSources') + 900));

const focalDefaultWithinRange = !/key:\s*'focalLength'[^}]*min:\s*12[^}]*value:\s*0/.test(postSrc)
  && Number(p1?.photoInit?.focalAttrVal ?? 12) >= 24;

const check1 = calibrate('photo-rewind-sources-focal-default-exit-record-race-and-vfbar-edit', {
  vfBarGalleryEditFreezesWorldAndMovesCamera: editFreezesWorldAndHidesHud,
  exitPhotoModeAwaitsActiveMediaRecorderBeforeGallery: exitAwaitsActiveRecorder,
  rewindSnapshotSourcesIncludePupsAndFox: snapshotCoversLitterAndFox,
  focalLengthDefaultWithinSliderRange: focalDefaultWithinRange,
}, {
  liveEditFromVfBarBodyHasPhotoMode: p1?.editFromVfBar?.bodyHasPhotoModeClass ?? null,
  liveEditFromVfBarShaderTimeDelta: p1?.editFromVfBar?.shaderTimeDeltaDuringEdit ?? null,
  liveEditFromVfBarWolfWalkedM: p1?.editFromVfBar?.wolfWalkedInsteadOfCameraFly ?? null,
  liveExitWhileRecordingGalleryOpen: p1?.exitWhileRecordingRace?.galleryOpen ?? null,
  liveExitWhileRecordingNotice: p1?.exitWhileRecordingRace?.notice ?? null,
  liveFocalAttrMin: p1?.photoInit?.focalAttrMin ?? null,
  liveFocalAttrVal: p1?.photoInit?.focalAttrVal ?? null,
  liveWolfRewoundDistM: p1?.wolfRewoundDistFromLive ?? null,
  liveZipExportBytes: p1?.zipCheck?.last?.size ?? null,
  liveZipMagicHex: p1?.zipCheck?.magic ?? null,
});

// =============================================================================
// CHECK 2: V Camera Adjust Mode Desktop Support, Desktop HUD Prompts, & Low-Energy Jump Feedback
// =============================================================================
const p2 = live.part2_needsThoughtsHaloVCamWolfModes;
const vDoesNotHijackToPadMenuWhenClosed = p2?.vClosedPanel?.padMenuOpen === false;
const vCameraModeSupportsKeyboardAndEsc = p2?.vUnlockedBefore?.padxExists === true
  && p2?.vKeyboardCannotChangeSetting === false
  && p2?.vUnlockedAfterKeys?.pauseMenuOpenedBehind === false
  && !/atomValues\(\[\],\s*pad\)/.test(padRouterSrc);
const statusHudMatchesActiveDevice = p2?.hardcodedXboxPromptWithZeroPads === false
  && !/RT run · LT stealth · LB focus/.test(mainSrc)
  && !/Recover to 20 stamina; release triggers/.test(mainSrc);
const lowEnergyJumpGivesFeedback = (p2?.lowEnergyJumpNotice ?? '').trim().length > 0;

const check2 = calibrate('v-camera-mode-keyboard-support-desktop-hud-prompts-and-energy-feedback', {
  vKeyDoesNotHijackDesktopIntoPadMenuWhenLocked: vDoesNotHijackToPadMenuWhenClosed,
  vCameraModeSupportsKeyboardNavigationAndEscape: vCameraModeSupportsKeyboardAndEsc,
  statusHudShowsKeyboardBindingsWhenNoGamepadConnected: statusHudMatchesActiveDevice,
  lowEnergyJumpRejectionShowsFeedback: lowEnergyJumpGivesFeedback,
}, {
  liveConnectedGamepads: p2?.needsInitial?.connectedGamepads ?? null,
  liveStatusTextSample: p2?.needsInitial?.statusText?.split('\n')[1] ?? null,
  liveVClosedPanelPadMenuOpen: p2?.vClosedPanel?.padMenuOpen ?? null,
  liveVUnlockedPadxText: p2?.vUnlockedBefore?.padxText ?? null,
  liveVUnlockedPauseOpenedBehind: p2?.vUnlockedAfterKeys?.pauseMenuOpenedBehind ?? null,
  liveMaxSprintModeSeen: p2?.wolfSprintExhaustion?.maxSprintModeSeen ?? null,
  liveLowEnergyJumpNotice: p2?.lowEnergyJumpNotice ?? '',
});

// =============================================================================
// CHECK 3: Audio Hotkey Modifier/Select Guards, Split-Window HUD, & WebGL Context Loss Recovery
// =============================================================================
const p3 = live.part3_audioHotkeysResizeWebglLoss;
const audioGuardsModifiers = (p3?.audioHotkeys?.volAfterCtrlMinusAndCtrlM?.vol?.['volume.muted'] !== true)
  && (p3?.audioHotkeys?.volAfterCtrlMinusAndCtrlM?.vol?.['volume.music'] !== 0.6)
  && /ctrlKey|metaKey|altKey/.test(borealSoundSrc.slice(borealSoundSrc.indexOf("addEventListener('keydown'"), borealSoundSrc.indexOf("addEventListener('keydown'") + 450));
const audioGuardsSelectAndTextarea = p3?.audioHotkeys?.selectKeyHijackedAudio === false
  && /SELECT|TEXTAREA|matches\(['"]input,textarea,select/i.test(borealSoundSrc.slice(borealSoundSrc.indexOf("addEventListener('keydown'"), borealSoundSrc.indexOf("addEventListener('keydown'") + 450));
const webglLossHasReloadAndStopsLoop = (p3?.webglContextLoss?.noticeReloadButtonCount ?? 0) >= 1
  && (p3?.webglContextLoss?.rafTicksAfterLoss ?? 99) <= 2
  && p3?.webglContextLoss?.hudStillInteractive?.pauseClickable === false;
const audioKeysGiveFeedback = (p3?.audioHotkeys?.volAfterCtrlMinusAndCtrlM?.noticeVisible === true)
  || /notice\(/.test(borealSoundSrc);

const check3 = calibrate('audio-hotkey-guards-and-webgl-context-loss-recovery', {
  audioHotkeysIgnoreBrowserCtrlMetaAltShortcuts: audioGuardsModifiers,
  audioHotkeysIgnoreFocusedSelectAndTextarea: audioGuardsSelectAndTextarea,
  webglContextLossProvidesReloadButtonStopsRafAndDisablesHud: webglLossHasReloadAndStopsLoop,
  audioVolumeHotkeysProvideVisualFeedback: audioKeysGiveFeedback,
}, {
  liveVolumeAfterCtrlMinusAndCtrlM: p3?.audioHotkeys?.volAfterCtrlMinusAndCtrlM?.vol ?? null,
  liveActiveTagInPhotoSelect: p3?.audioHotkeys?.activeTagInPhotoSelect ?? null,
  liveSelectKeyHijackedAudio: p3?.audioHotkeys?.selectKeyHijackedAudio ?? null,
  liveWebglReloadButtonCount: p3?.webglContextLoss?.noticeReloadButtonCount ?? null,
  liveWebglRafTicksAfterLoss: p3?.webglContextLoss?.rafTicksAfterLoss ?? null,
  liveWebglHudStillInteractive: p3?.webglContextLoss?.hudStillInteractive ?? null,
  liveResize1280Canvas: `${p3?.liveResize?.layout1280?.canvasW}x${p3?.liveResize?.layout1280?.canvasH}`,
  liveResize640Canvas: `${p3?.liveResize?.layout640?.canvasW}x${p3?.liveResize?.layout640?.canvasH}`,
});

// =============================================================================
// CHECK 4: In-Page Mid-Altitude Drone Flight Band (Ascent Snap, 1-Frame Embody, Day Ground & Midnight Whiteout/Fog)
// =============================================================================
const p4 = live.part4_inpageDroneFlightBand;
const dayFrame = analyzePng(path.join(AUDIT_DIR, 'frame-6-live-drone-band-day-400m.png'));
const nightFrame = analyzePng(path.join(AUDIT_DIR, 'frame-7-live-drone-band-midnight-blue-fog.png'));

const noAscentSnap = (p4?.ascentSnapFactor ?? 9999) < 10;
const embodyTrace: Array<{ mode: string; camY: number }> = p4?.embodyTrace ?? [];
let maxSingleFrameCamYDrop = 0;
for (let i = 1; i < embodyTrace.length; i++) {
  maxSingleFrameCamYDrop = Math.max(maxSingleFrameCamYDrop, Math.abs(embodyTrace[i - 1].camY - embodyTrace[i].camY));
}
const smoothEmbodyHandover = maxSingleFrameCamYDrop < 50 && !/no-op: blendSec is not applied/.test(inpageSrc);

const midnightFog = p4?.midnightDrone?.fogColorRgb as [number, number, number] | null;
const midnightFogNotHardcodedMiddayBlue = !!midnightFog
  && !(Math.abs(midnightFog[0] - 0.45) < 0.02 && Math.abs(midnightFog[1] - 0.62) < 0.02 && Math.abs(midnightFog[2] - 0.9) < 0.02)
  && !/scene\.fog\.color\.setRGB\(0\.45,\s*0\.62,\s*0\.9\)/.test(inpageSrc);

const midnightDroneDarkNotWhiteout = nightFrame.meanLum < 0.25 && nightFrame.clippedWhiteFrac < 0.05;
const daytimeDroneHasConiferGreenCanopy = dayFrame.greenDominantFrac >= 0.15;

const check4 = calibrate('inpage-drone-band-ascent-embody-day-canopy-and-midnight-fog-whiteout', {
  shiftGAscentHasNoThousandfoldSnap: noAscentSnap,
  gEmbodyUsesSmoothHandoverBlendInsteadOf1FrameTeleport: smoothEmbodyHandover,
  midnightDroneFogFollowsNightSkyInsteadOfHardcodedMiddayBlue: midnightFogNotHardcodedMiddayBlue,
  midnightDroneFrameIsDarkNotClippedWhiteout: midnightDroneDarkNotWhiteout,
  daytime400mDroneShowsConiferGreenCanopyVsBrownTiles: daytimeDroneHasConiferGreenCanopy,
}, {
  liveAscentPeakBandHM: p4?.ascentPeakBandH ?? null,
  liveAscentFirstGlobeAltM: p4?.ascentFirstGlobeAlt ?? null,
  liveAscentSnapFactor: p4?.ascentSnapFactor ?? null,
  liveEmbodyMaxSingleFrameDropM: Number(maxSingleFrameCamYDrop.toFixed(2)),
  liveDroneMovedXZ: p4?.droneMovedXZ ?? null,
  liveDroneClimbedM: p4?.droneClimbedM ?? null,
  liveMidnightFogColorRgb: midnightFog,
  liveMidnightFrameMeanLum: nightFrame.meanLum,
  liveMidnightFrameClippedWhiteFrac: nightFrame.clippedWhiteFrac,
  liveMidnightFrameMeanRgb: nightFrame.meanRgb,
  liveDay400mFrameMeanLum: dayFrame.meanLum,
  liveDay400mFrameMeanRgb: dayFrame.meanRgb,
  liveDay400mGreenDominantFrac: dayFrame.greenDominantFrac,
  liveAfterDroneEscGlobeAltM: p4?.afterDroneEsc?.globeAltM ?? null,
});

const checks = [check1, check2, check3, check4];
const calibrationValid = checks.every(c => c.calibrationOk);
const passCount = checks.filter(c => c.pass).length;
const meanScore = Number((checks.reduce((s, c) => s + c.score, 0) / checks.length).toFixed(4));

const out = {
  task: 'T-0303',
  auditedAt: new Date().toISOString(),
  liveCaptureMeta: live.meta,
  consoleErrorsCount: (live.consoleErrors ?? []).length,
  pageErrorsCount: (live.pageErrors ?? []).length,
  calibrationValid,
  passCount,
  totalChecks: checks.length,
  meanScore,
  checks,
};

fs.writeFileSync(path.join(AUDIT_DIR, 'numbers.json'), JSON.stringify(out, null, 2) + '\n', 'utf8');
console.log(JSON.stringify({ calibrationValid, passCount, totalChecks: checks.length, meanScore, scores: checks.map(c => ({ id: c.id, score: c.score, pass: c.pass })) }, null, 2));
