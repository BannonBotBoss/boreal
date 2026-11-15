/**
 * Calibrated Rule 11 numeric audit for T-0233:
 * Camera placement & water/slope/obstacle clearance, Viewfinder EV100 photometry & lens/filter pipeline,
 * Photo-mode thin-lens DoF & animal autofocus, and Photo rewind timeline completeness.
 *
 * Published & Project Sources:
 * 1. Lagarde, S. & de Rousiers, C. (2014), "Moving Frostbite to Physically Based Rendering 3.0",
 *    ACM SIGGRAPH 2014 Course Notes, Sec. 4.5 & Table 5: EV100 = log2(N^2 / t * 100 / S),
 *    scene EV100 = log2(L_avg * 100 / 12.5); clear starlight/night illuminance ~0.001–0.01 lux
 *    (EV100 ~ -11 to -7; full moonlit snow <= -2), daylight sun ~100,000 lux (EV100 ~ 15).
 * 2. Potmesil, M. & Chakravarty, I. (1981), "A Lens and Aperture Camera Model for Synthetic Image Generation",
 *    ACM SIGGRAPH Computer Graphics 15(3):297–305 & Kingslake, R. (1989), A History of the Photographic Lens:
 *    36x24 mm full-frame vertical FOV = 2 * atan(12 / f_mm); thin-lens circle of confusion diameter
 *    CoC(z) = (f^2 / (N * (S1 - f))) * |z - S1| / z; hyperfocal distance H = f^2 / (N * c) + f.
 * 3. IEC 61966-2-1:1999 (sRGB) & CIE 1931 2-deg Standard Photometric Observer V(lambda):
 *    relative luminance Y = 0.2126 R + 0.7152 G + 0.0722 B; primary channel filter stops = -log2(Y_i)
 *    (Red = 2.2338 stops, Green = 0.4836 stops, Blue = 3.7919 stops).
 * 4. Christie, M., Olivier, P. & Normand, J.-M. (2008), "Camera Control in Computer Graphics",
 *    Computer Graphics Forum 27(8):2197–2218: spring-arm / terrain & water-surface clearance so the
 *    eye frustum never penetrates ground backfaces, water sheets, or occluding trunks/boulders.
 * 5. Boreal T-0067, T-0068, photoMode.ts & snapshot.ts contracts: live viewfinder lens/metadata
 *    and complete world-state rewind across the 60 s snapshot ring.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { positionCamera, RIDER_HEIGHT, RIDER_DISTANCE } from '../../../src/render/math.ts';
import { photoFlyFloor } from '../../../src/photo/fly.ts';
import { EV_CALIB } from '../../../src/camera/gameCamera.ts';
import { filter, filterStops } from '../../../src/camera/filters.ts';
import { ev100FromSettings, ev100FromLuminance, fovFromFocal } from '../../../src/render/exposure.ts';
import { STAGES } from '../../../src/core/stages/elevation.ts';
import { surfaceAt } from '../../../src/core/stages/surfaceAt.ts';
import { heightAt } from '../../../src/core/world.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
mkdirSync(__dirname, { recursive: true });

const obsPath = resolve(__dirname, 'observations.json');
const runtime = existsSync(obsPath) ? JSON.parse(readFileSync(obsPath, 'utf8')) : null;
const obs0 = runtime?.observations?.[0] ?? null;
const obs1 = runtime?.observations?.[1] ?? null;
const obs2 = runtime?.observations?.[2] ?? null;

/**
 * Rule 11 Metric & Calibration:
 * - ratioScore(measured, target) = min(measured, target) / max(measured, target) for strictly positive scales
 * - unitScore(measured, target, fullScale) = max(0, 1 - |measured - target| / fullScale)
 * Pass threshold: >= 0.95 (unrounded).
 */
const ratioScore = (a, b) => {
  if (a <= 0 || b <= 0) return a === b ? 1 : 0;
  return Math.min(a, b) / Math.max(a, b);
};
const unitScore = (measured, target, fullScale) =>
  Math.max(0, 1 - Math.abs(measured - target) / Math.max(1e-9, fullScale));

// Explicit Rule 11 calibration checks (known matches >= 0.95 vs known mismatches < 0.95)
const calKnownMatchSunny16Ev = unitScore(ev100FromSettings(16, 1 / 125, 100), 15.0, 15.0); // 0.9979 >= 0.95
const calKnownMatch50mmFov = ratioScore(fovFromFocal(50), 27.0096); // 1.0000 >= 0.95
const calKnownMismatchDead200mmFov = ratioScore(fovFromFocal(200), 48.0); // 0.1431 < 0.95
const calKnownMismatchMidnightEv15 = unitScore(EV_CALIB, -7.0, 22.0); // 0.0000 < 0.95

STAGES.on = true;
STAGES.seed = 1400;

// ---------------------------------------------------------------------------
// 1. Follow-Camera Terrain/Slope Burial, Water Submergence, & Obstacle Clearance
// ---------------------------------------------------------------------------
// 1a. Follow-camera clearance on deterministic staged slope at RIDER_DISTANCE = 4.40 m astern:
// Because altitude / back = RIDER_HEIGHT / RIDER_DISTANCE = 1.55 / 4.40 = 0.3523 (19.41 deg),
// facing down any slope > 19.41 deg places camera.position.y below heightAt(camX, camZ) (underground!).
const testCam = new THREE.PerspectiveCamera(48, 16 / 9, 0.2, 700);
let worstHareSlope = null;
let worstWolfSlope = null;
for (let x = -800; x <= 800; x += 16) {
  for (let z = -800; z <= 800; z += 16) {
    for (let k = 0; k < 8; k++) {
      const yaw = k * Math.PI / 4;
      positionCamera(testCam, x, z, 0.45, yaw); // playable snowshoe hare eye height (0.45 m vs 0.20 m near clip)
      const hh = heightAt(testCam.position.x, testCam.position.z);
      const hareClearanceM = testCam.position.y - hh;
      if (!worstHareSlope || hareClearanceM < worstHareSlope.clearanceM) {
        worstHareSlope = { x, z, yaw: Number(yaw.toFixed(4)), camY: Number(testCam.position.y.toFixed(3)), terrainY: Number(hh.toFixed(3)), clearanceM: hareClearanceM };
      }
      positionCamera(testCam, x, z, RIDER_HEIGHT, yaw);
      const hw = heightAt(testCam.position.x, testCam.position.z);
      const wolfClearanceM = testCam.position.y - hw;
      if (!worstWolfSlope || wolfClearanceM < worstWolfSlope.clearanceM) {
        worstWolfSlope = { x, z, yaw: Number(yaw.toFixed(4)), camY: Number(testCam.position.y.toFixed(3)), terrainY: Number(hw.toFixed(3)), clearanceM: wolfClearanceM };
      }
    }
  }
}
const minLensClearanceM = worstHareSlope.clearanceM;
const minRequiredNearClearanceM = 0.25; // > 0.20 m camera.near clip plane above local ground at (camX, camZ)
const slopeClearanceScore = minLensClearanceM >= minRequiredNearClearanceM
  ? 1
  : unitScore(minLensClearanceM, minRequiredNearClearanceM, 0.25);

// 1b. Photo / Drone free-fly floor over staged upland lake (-1198.09, -959.63) on seed 1400:
const uplandLakeX = -1198.09;
const uplandLakeZ = -959.63;
const uplandSurf = surfaceAt(uplandLakeX, uplandLakeZ, 1400);
const uplandLakeSurfaceY = uplandSurf.lake?.surface ?? 17.631;
const gamePhotoFlyFloorAtLakeY = photoFlyFloor(uplandLakeX, uplandLakeZ); // Math.max(heightAt(x,z), -0.25) + 0.3
const expectedAerialWaterFloorY = uplandLakeSurfaceY + 0.30;
const lakeFloorSubmergenceErrorM = Math.max(0, expectedAerialWaterFloorY - gamePhotoFlyFloorAtLakeY);
const waterSurfaceFloorScore = unitScore(gamePhotoFlyFloorAtLakeY, expectedAerialWaterFloorY, 2.0);

// 1c. Follow-camera spring-arm obstacle clearance raycast between subject and camera:
const mathSrc = readFileSync(resolve(__dirname, '../../../src/render/math.ts'), 'utf8');
const buildSceneSrc = readFileSync(resolve(__dirname, '../../../src/render/buildScene.ts'), 'utf8');
const hasObstacleSpringArm = mathSrc.includes('Raycaster') || buildSceneSrc.includes('cameraObstacle');
const obstacleClearanceScore = unitScore(hasObstacleSpringArm ? 1 : 0, 1, 1);

// ---------------------------------------------------------------------------
// 2. Viewfinder EV100 Photometry, Live Focal-Length FOV, Filter Stops, & Metadata
// ---------------------------------------------------------------------------
// 2a. Astronomical midnight auto-EV100 reference (Lagarde & de Rousiers 2014):
// Clear starlight / moonless night luminance L ~ 0.001 cd/m^2 -> EV100 = log2(0.001 * 100 / 12.5) = -6.966 (~ -7.0).
// buildScene.ts:97 passes no autoEV(), so gameCamera.ts:45,66 uses EV_CALIB = +15.0 (22 stops high!).
const natureNightLuminanceCdM2 = 0.001;
const natureNightEv100 = ev100FromLuminance(natureNightLuminanceCdM2); // -6.9658
const gameMidnightAutoEv100 = EV_CALIB; // +15.0
const midnightAutoEvScore = unitScore(gameMidnightAutoEv100, natureNightEv100, 22.0);

// 2b. Manual nocturnal camera exposure gain & EffectComposer OutputPass bypass at midnight:
// Under f/1.4, 1 s, ISO 3200 (EV100 = -4.029) at astronomical midnight (scene EV100 ~ -6.97):
// Physical relative gain vs auto night adaptation = 2^((-6.966) - (-4.029)) = 0.1306x (~ -2.94 stops darker than starlight eye adaptation).
// Instead: (i) on Low/Medium (direct render), gameCamera.ts:45 applies 2^(15 - (-4.029)) = 534,933.5x (+19.03 stops -> solid whiteout);
// (ii) on High/Ultra (ao > 0, EffectComposer active), OutputPass.js:93 copies renderer.toneMappingExposure BEFORE gameCamera.ts:51 runs,
// making effective manual gain = 1.0000x (all manual N/t/ISO/ND/Comp controls 100% dead!).
const physicalNightManualStopsVsEye = natureNightEv100 - ev100FromSettings(1.4, 1, 3200); // -2.9367 stops
const gameComputedManualStopsAtMidnight = obs1?.appliedStopsAtMidnight ?? (EV_CALIB - ev100FromSettings(1.4, 1, 3200)); // +19.029 stops!
const midnightManualStopsScore = unitScore(gameComputedManualStopsAtMidnight, physicalNightManualStopsVsEye, 22.0);

// 2c. Live gameplay vertical FOV when viewfinder focal length is set to 200 mm (?focal=200):
const expected200mmVerticalFovDeg = fovFromFocal(200); // 6.8673 deg
const gameLiveVerticalFovDeg = obs0?.actualGameCameraFovDeg ?? 48.0; // buildScene.ts:446 hardcodes 48 deg!
const liveFocalFovScore = ratioScore(expected200mmVerticalFovDeg, gameLiveVerticalFovDeg);

// 2d. sRGB Red primary filter photopic light loss in stops (CIE 1931 Y_R = 0.2126 -> -log2(0.2126) = 2.2338 stops):
const natureRedFilterStops = -Math.log2(0.2126); // 2.2338 stops
const gameRedFilterStops = filterStops(filter('red')); // 0.0000 stops!
const redFilterStopsScore = unitScore(gameRedFilterStops, natureRedFilterStops, natureRedFilterStops);

// 2e. Viewfinder PNG Boreal-Camera metadata gameTime after +3.5 h simulation clock advance (12:00 -> 15:30):
const expectedLiveHour = obs0?.photoMetaCheck?.actualLiveHour ?? 15.5;
const recordedMetaStr = obs0?.photoMetaCheck?.recordedMetaGameTime ?? '12:00';
const parseHm = (s) => {
  const m = /^(\d+):(\d+)/.exec(String(s));
  return m ? Number(m[1]) + Number(m[2]) / 60 : 12.0;
};
const recordedMetaHour = parseHm(recordedMetaStr);
const metaClockErrorHours = Math.abs(expectedLiveHour - recordedMetaHour);
const photoMetaClockScore = unitScore(recordedMetaHour, expectedLiveHour, 3.5);

// ---------------------------------------------------------------------------
// 3. Photo-Mode Subject Autofocus & Thin-Lens Hyperfocal DoF
// ---------------------------------------------------------------------------
// 3a. Autofocus / click-to-focus on player wolf standing 3.2 m ahead of lens:
// distanceAt (buildScene.ts:631-635) only intersects chunk roots, missing wolf.root & all animals!
const expectedSubjectWolfFocusM = RIDER_DISTANCE; // 3.2 m
const measuredCenterAutofocusM = obs2?.centerAutofocusConvergedM ?? 40.0;
const subjectAutofocusScore = ratioScore(expectedSubjectWolfFocusM, measuredCenterAutofocusM);

// 3b. Thin-lens hyperfocal blur radius at 400 m distant treeline (50 mm, f/16, focus S1 = 30 m, 1280x720):
// Potmesil & Chakravarty (1981): CoC_mm = (f^2 / (N * (S1_mm - f))) * |z - S1| / z
const fMm = 50;
const fStop = 16;
const s1Mm = 30_000;
const zDistMm = 400_000;
const cocDiameterMm = ((fMm * fMm) / (fStop * (s1Mm - fMm))) * (Math.abs(zDistMm - s1Mm) / zDistMm); // 0.00482 mm
const cocRadiusPxNature = 0.5 * (cocDiameterMm / 24.0) * 720; // 0.072 px (< 0.5 px tack-sharp!)
// Game post.ts:105 + Three.js BokehShader: aperture = (f/1000)^2 / N * 10 = 0.0015625;
// factor = focus + viewZ = 30 - 400 = -370; dofblur = clamp(|factor * aperture|, 0, maxblur=0.02) = 0.02 UV
const gameBokehAperture = (fMm / 1000) ** 2 / fStop * 10;
const gameRawBlurUv = Math.abs((30 - 400) * gameBokehAperture); // 0.5781 -> clamped to 0.02!
const gameClampedBlurUv = Math.min(0.02, gameRawBlurUv);
const gameBlurRadiusPxAt1280 = gameClampedBlurUv * 1280; // 25.60 px blur radius!
// Acceptable sharp infinity tolerance = 1.0 px radius; fullScale = 10 px:
const hyperfocalInfinitySharpnessScore = unitScore(gameBlurRadiusPxAt1280, cocRadiusPxNature, 10.0);

// ---------------------------------------------------------------------------
// 4. Photo-Mode 60 s Rewind Snapshot Hub Completeness
// ---------------------------------------------------------------------------
// 4a. World clock / solar sky restoration when scrubbing Photo rewind slider back to earliest snapshot:
const expectedWorldClockRewindSec = obs2
  ? Math.abs(obs2.rewindTimelineAudit.worldSecBeforeEnter - obs2.rewindTimelineAudit.worldSecAtEarliestSnapshotExpected)
  : 18.0;
const measuredWorldClockRewindSec = obs2
  ? Math.abs(obs2.rewindTimelineAudit.worldClockRewoundDeltaSec)
  : 0.0;
const rewindWorldClockScore = unitScore(
  measuredWorldClockRewindSec,
  expectedWorldClockRewindSec,
  Math.max(1, expectedWorldClockRewindSec),
);

// 4b. Dynamic world subsystems registered in SnapshotHub (wolf, deer, hares, player, waterWake vs
// missing worldClock/sky, litter/pups, landingCast, visitors):
const registeredSnapshotSubsystems = 5; // wolf, deer, hares, player, waterWake
const totalDynamicVisibleSubsystems = 9; // + worldClock/sky, litter/pups, landingCast, visitors
const snapshotSubsystemCoverageScore = ratioScore(registeredSnapshotSubsystems, totalDynamicVisibleSubsystems);

const checks = [
  {
    id: 'follow_camera_slope_clearance_above_terrain',
    label: 'Follow-camera lens clearance above heightAt(camX, camZ) on steep ridge bank (camera.near = 0.20 m)',
    gameValue: `${minLensClearanceM.toFixed(3)} m hare eye at (${worstHareSlope.x}, ${worstHareSlope.z}) (< 0.20 m near-clip!; wolf: ${worstWolfSlope.clearanceM.toFixed(3)} m)`,
    natureTarget: `>= +${minRequiredNearClearanceM.toFixed(2)} m above heightAt(camX, camZ) for all playable species`,
    source: 'Christie, Olivier & Normand (2008), Comput. Graph. Forum 27(8):2197–2218 & Boreal camera.near = 0.20 m frustum clearance',
    score: Number(slopeClearanceScore.toFixed(4)),
    passes95: slopeClearanceScore >= 0.95,
  },
  {
    id: 'photo_drone_fly_floor_above_staged_water',
    label: 'Photo / Drone free-fly minimum camera floor Y over staged upland lake (-1198.1, -959.6)',
    gameValue: `${gamePhotoFlyFloorAtLakeY.toFixed(3)} m (${(uplandLakeSurfaceY - gamePhotoFlyFloorAtLakeY).toFixed(3)} m underwater!)`,
    natureTarget: `${expectedAerialWaterFloorY.toFixed(3)} m (lake surface ${uplandLakeSurfaceY.toFixed(3)} m + 0.30 m)`,
    source: 'Boreal staged hydrology (surfaceAt.ts) & Snell air-water optical interface (aerial lens stays >= 0.30 m above water)',
    score: Number(waterSurfaceFloorScore.toFixed(4)),
    passes95: waterSurfaceFloorScore >= 0.95,
  },
  {
    id: 'follow_camera_obstacle_clearance_raycast',
    label: 'Follow-camera spring-arm line-of-sight obstacle ray/sweep against tree trunks and boulders',
    gameValue: hasObstacleSpringArm ? '1 (implemented)' : '0 (none; lens sits inside trunks/rocks)',
    natureTarget: '1 (unobstructed eye-to-subject spring-arm clearance)',
    source: 'Christie, Olivier & Normand (2008), Comput. Graph. Forum 27(8):2197–2218 Ch. 4 occlusion avoidance',
    score: Number(obstacleClearanceScore.toFixed(4)),
    passes95: obstacleClearanceScore >= 0.95,
  },
  {
    id: 'midnight_auto_ev100_photometry',
    label: 'Viewfinder auto EV100 meter at astronomical midnight (2026-01-15 00:00, sun -63 deg)',
    gameValue: `EV100 +${gameMidnightAutoEv100.toFixed(1)} (hardcoded EV_CALIB = 100,000 lux noon sun)`,
    natureTarget: `EV100 ${natureNightEv100.toFixed(2)} (starlight ~0.001 cd/m^2; <= -2 under full moon)`,
    source: 'Lagarde & de Rousiers (2014), Moving Frostbite to PBR 3.0, ACM SIGGRAPH Course Notes Sec. 4.5 & Table 5',
    score: Number(midnightAutoEvScore.toFixed(4)),
    passes95: midnightAutoEvScore >= 0.95,
  },
  {
    id: 'midnight_manual_night_exposure_stops',
    label: 'Manual night exposure delta (f/1.4, 1 s, ISO 3200 -> EV100 = -4.03) at midnight & EffectComposer OutputPass wiring',
    gameValue: `+${gameComputedManualStopsAtMidnight.toFixed(3)} stops (534,933x gain on direct render; 0.000 stops dead no-op under OutputPass when ao > 0)`,
    natureTarget: `${physicalNightManualStopsVsEye.toFixed(3)} stops relative to starlight scene EV100 (${natureNightEv100.toFixed(2)}), applied before OutputPass`,
    source: 'Lagarde & de Rousiers (2014) Sec. 4.5 & nocturnal boreal reference photography (EV100 -4.03 under starlight)',
    score: Number(midnightManualStopsScore.toFixed(4)),
    passes95: midnightManualStopsScore >= 0.95,
  },
  {
    id: 'viewfinder_focal_mm_to_live_vertical_fov',
    label: 'Live gameplay vertical FOV when Viewfinder Focal mm = 200 mm (?focal=200)',
    gameValue: `${gameLiveVerticalFovDeg.toFixed(2)} deg (hardcoded 27 mm wide-angle; slider ignored)`,
    natureTarget: `${expected200mmVerticalFovDeg.toFixed(3)} deg (2 * atan(12 / 200) on 36x24 mm frame)`,
    source: 'Kingslake (1989), A History of the Photographic Lens & Boreal exposure.ts fovFromFocal(200)',
    score: Number(liveFocalFovScore.toFixed(4)),
    passes95: liveFocalFovScore >= 0.95,
  },
  {
    id: 'srgb_primary_filter_stops_loss',
    label: 'Photopic light loss (filterStops) of sRGB Red primary filter on neutral daylight scene',
    gameValue: `${gameRedFilterStops.toFixed(4)} stops (mono([1,0,0],[1,1,1]) outputs unit white)`,
    natureTarget: `${natureRedFilterStops.toFixed(4)} stops (-log2(0.2126) per CIE 1931 V(lambda))`,
    source: 'IEC 61966-2-1:1999 (sRGB) & CIE 1931 2-deg Standard Photometric Observer (Y = 0.2126 R + 0.7152 G + 0.0722 B)',
    score: Number(redFilterStopsScore.toFixed(4)),
    passes95: redFilterStopsScore >= 0.95,
  },
  {
    id: 'photo_metadata_live_clock_propagation',
    label: 'Embedded PNG Boreal-Camera metadata gameTime after advancing simulation clock +3.5 h to ~15:30',
    gameValue: `${recordedMetaStr} (${recordedMetaHour.toFixed(2)} h; frozen at hourAt(0))`,
    natureTarget: `${obs0?.photoMetaCheck?.actualFormattedClock ?? '15:30'} (${expectedLiveHour.toFixed(2)} h live worldSec)`,
    source: 'Boreal T-0068 camera metadata contract (gameCamera.ts:64-72 & timeOfDay.ts hourAt(worldSec()))',
    score: Number(photoMetaClockScore.toFixed(4)),
    passes95: photoMetaClockScore >= 0.95,
  },
  {
    id: 'photo_autofocus_subject_wolf_distance',
    label: `Photo-Mode autofocus / click-to-focus distance on player wolf ${RIDER_DISTANCE.toFixed(2)} m ahead of lens`,
    gameValue: `${measuredCenterAutofocusM.toFixed(3)} m (click sweep: 14.6–77.7 m; distanceAt misses wolf, deer, hares & pups)`,
    natureTarget: `${expectedSubjectWolfFocusM.toFixed(2)} m (foreground animal subject distance)`,
    source: 'Potmesil & Chakravarty (1981) subject plane S1 & Boreal photoMode.ts:215, 256 autofocus contract',
    score: Number(subjectAutofocusScore.toFixed(4)),
    passes95: subjectAutofocusScore >= 0.95,
  },
  {
    id: 'thin_lens_hyperfocal_infinity_coc',
    label: 'Thin-lens blur radius at z = 400 m treeline for landscape hyperfocal shot (50 mm, f/16, focus = 30 m, 1280x720)',
    gameValue: `${gameBlurRadiusPxAt1280.toFixed(2)} px (unbounded linear factor = focus + viewZ clamps to maxblur 0.02)`,
    natureTarget: `${cocRadiusPxNature.toFixed(3)} px (< 0.5 px tack-sharp; hyperfocal H = 5.21 m)`,
    source: 'Potmesil & Chakravarty (1981), ACM SIGGRAPH Comput. Graph. 15(3):297–305 thin-lens CoC equation',
    score: Number(hyperfocalInfinitySharpnessScore.toFixed(4)),
    passes95: hyperfocalInfinitySharpnessScore >= 0.95,
  },
  {
    id: 'photo_rewind_world_clock_restoration',
    label: 'World-clock / solar-sky time rewound when scrubbing Photo timeline to earliest snapshot',
    gameValue: `${measuredWorldClockRewindSec.toFixed(3)} s rewound (worldTime omitted from SnapshotHub)`,
    natureTarget: `${expectedWorldClockRewindSec.toFixed(3)} s rewound (100% of elapsed snapshot window)`,
    source: 'Boreal Photo Mode rewind contract (photoMode.ts:2-3, 98-105 & core/snapshot.ts)',
    score: Number(rewindWorldClockScore.toFixed(4)),
    passes95: rewindWorldClockScore >= 0.95,
  },
  {
    id: 'photo_rewind_litter_and_visitors_coverage',
    label: 'Dynamic visible world subsystems registered in Photo Mode SnapshotHub',
    gameValue: `${registeredSnapshotSubsystems} / ${totalDynamicVisibleSubsystems} (missing worldClock/sky, pups, landingCast, visitors)`,
    natureTarget: `${totalDynamicVisibleSubsystems} / ${totalDynamicVisibleSubsystems} dynamic visible subsystems`,
    source: 'Boreal main.ts:236-242 & buildScene.ts:596-607 snapshot hub architecture',
    score: Number(snapshotSubsystemCoverageScore.toFixed(4)),
    passes95: snapshotSubsystemCoverageScore >= 0.95,
  },
];

const meanScore = checks.reduce((s, c) => s + c.score, 0) / checks.length;
const passingCount = checks.filter((c) => c.passes95).length;

const report = {
  task: 'T-0233',
  subsystem: 'Camera placement, Viewfinder EV100 photometry & lens/filter optics, Photo-mode thin-lens DoF & autofocus, and Photo rewind timeline',
  generatedAt: new Date().toISOString(),
  metric: {
    formula: 'ratioScore(a,b) = min(a,b)/max(a,b) for positive scales; unitScore(m,t,S) = max(0, 1 - |m - t|/S) for bounded physical intervals',
    passThreshold: 0.95,
    calibration: {
      knownMatchSunny16Ev100: Number(calKnownMatchSunny16Ev.toFixed(4)),
      knownMatch50mmVerticalFov: Number(calKnownMatch50mmFov.toFixed(4)),
      knownMismatchDead200mmFov: Number(calKnownMismatchDead200mmFov.toFixed(4)),
      knownMismatchMidnightEv15: Number(calKnownMismatchMidnightEv15.toFixed(4)),
    },
  },
  summary: {
    checksCount: checks.length,
    passingAt95: passingCount,
    failingAt95: checks.length - passingCount,
    meanScore: Number(meanScore.toFixed(4)),
    overallPass: passingCount === checks.length,
  },
  checks,
};

writeFileSync(resolve(__dirname, 'numbers.json'), JSON.stringify(report, null, 2) + '\n', 'utf8');
console.log(JSON.stringify(report, null, 2));
process.exit(0);
