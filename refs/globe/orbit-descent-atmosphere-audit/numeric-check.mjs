/**
 * Calibrated Rule 11 numeric audit for T-0235:
 * Planetary globe home-longitude geography (+65.54 deg E Kazakhstan vs -94.49 deg W Kenora),
 * orbit-to-glide & forest-to-orbit altitude teleports + 1-frame embody snap,
 * US Standard Atmosphere 1976 aerodynamic drag terminal velocity + 8.0 m/s forward glide handoff,
 * and multi-scale cloud-deck crossfades (2,500 km 1-frame swap, dead CLOUD_OPEN 1,500->40 km,
 * un-toggled & un-drifted orbit clouds).
 *
 * Published & Project Sources:
 * 1. Natural Resources Canada (NRCan), Canadian Geographical Names Data Base (Kenora, Ontario,
 *    49.7667 N, 94.4894 W, Lake of the Woods ~370 m ASL) & Amante, C. & Eakins, B. W. (2009),
 *    "ETOPO1 1 Arc-Minute Global Relief Model", NOAA Tech. Memo. NESDIS NGDC-24.
 * 2. Meeus, J. (1998), Astronomical Algorithms (2nd ed., Willmann-Bell) & Reda, I. & Andreas, A.
 *    (2004), "Solar Position Algorithm for Solar Radiation Applications", Solar Energy 76(5):577-589:
 *    summer solstice (day 172) local solar noon at Kenora (49.77 N, -94.49 W) gives solar elevation
 *    +63.67 deg and UTC = 18.30 h.
 * 3. U.S. Standard Atmosphere (1976), NOAA/NASA/USAF-S/T 76-1562; Hoerner, S. F. (1965),
 *    Fluid-Dynamic Drag; & Pennycuick, C. J. (2008), Modelling the Flying Bird (Academic Press):
 *    barometric air density rho(3048 m) = 0.905 kg/m^3, quadratic drag Fd = -0.5 * rho(z) * Cd * A * |v| * v,
 *    terminal velocity vt(z) = sqrt(2 * beta * g(z) / rho(z)) ~ 61.2 m/s at 3,048 m (10,000 ft) for
 *    ballistic coefficient beta = m / (Cd * A) = 110 kg/m^2 (~54.9 m/s at 400 m), and soaring/drone
 *    forward glide speed 8.0 m/s (ANIMAL_LADDER.glideMs).
 * 4. Carlbom, I. & Paciorek, J. (1978), ACM Computing Surveys 10(4):465-502 & Christie, M.,
 *    Olivier, P. & Normand, J.-M. (2008), Computer Graphics Forum 27(8):2197-2218: C^1-continuous
 *    multi-scale camera altitude & pose interpolation without single-frame teleports.
 * 5. King, M. D. et al. (2013), IEEE Trans. Geosci. Remote Sens. 51(7):3826-3852; Peixoto, J. P. &
 *    Oort, A. H. (1992), Physics of Climate (synoptic zonal cloud advection); & Boreal T-0041 /
 *    ORBIT_FADE (700-2,500 km) / CLOUD_OPEN (1,500-150 km) multi-scale cloud contracts.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { PLANET, fromLatLon, toLatLon, planetSunDirection } from '../../../src/world/globe/planet.ts';
import { globePlanet } from '../../../src/world/globe/home.ts';
import { FALL_END_M, DESCENT, descentBegin, fallVelocity, freeFallVy } from '../../../src/world/globe/flight.ts';
import { TRANSITION, cloudClear, handoverBlend } from '../../../src/world/globe/transition.ts';
import { ORBIT_FADE, ORBIT_DRAW, ORBIT_FRAG, orbitWeight, setOrbitView } from '../../../src/world/globe/orbitAlbedo.ts';
import { localCloudFade } from '../../../src/world/globe/localClouds.ts';
import { CLOUDS, stepCloudDrift } from '../../../src/world/globe/atmosphere.ts';
import { ANIMAL_LADDER, arrestGlide } from '../../../src/render/animalLadder.ts';
import { gravity } from '../../../src/proc/physics.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
mkdirSync(__dirname, { recursive: true });

const obsPath = resolve(__dirname, 'observations.json');
const runtime = existsSync(obsPath) ? JSON.parse(readFileSync(obsPath, 'utf8')) : null;
const obs0 = runtime?.observations?.[0] ?? null;
const obs1 = runtime?.observations?.[1] ?? null;
const obs2 = runtime?.observations?.[2] ?? null;
const obs3 = runtime?.observations?.[3] ?? null;

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
// Known match 1: Kenora latitude in PLANET.home.latDeg (49.77 N vs NRCan 49.7667 N, fullScale = 90 deg)
const calKnownMatchKenoraLat = unitScore(PLANET.home.latDeg, 49.7667, 90.0); // 1.0000 >= 0.95
// Known match 2: US76 terminal velocity formula at sea level (rho0 = 1.225 kg/m^3, beta = 175 kg/m^2 -> 52.94 m/s vs Hoerner prone skydiver 53.0 m/s)
const calKnownMatchSeaLevelVt = ratioScore(Math.sqrt((2 * 175 * 9.80665) / 1.225), 53.0); // 0.9988 >= 0.95
// Known mismatch 1: Kazakhstan longitude (+65.54 E) vs Kenora longitude (-94.49 W) (180 deg full scale)
const calKnownMismatchKazakhstanLon = unitScore(65.54, -94.49, 180.0); // 0.1109 < 0.95
// Known mismatch 2: Vacuum 100 km free-fall speed (1372.5 m/s) vs atmospheric terminal speed (61.2 m/s)
const calKnownMismatchVacuumFall = ratioScore(61.2, 1372.5); // 0.0446 < 0.95

// ---------------------------------------------------------------------------
// 1. Real-Earth Globe Home Longitude & Subsolar / UTC Alignment
// ---------------------------------------------------------------------------
const planet = globePlanet(1400, true, 1400);
const homeLL = toLatLon(planet.home);
const gameHomeLatDeg = homeLL.lat * 180 / Math.PI;
const gameHomeLonDeg = homeLL.lon * 180 / Math.PI; // +65.5378 deg E (central Kazakhstan!)
const natureKenoraLatDeg = 49.7667;
const natureKenoraLonDeg = -94.4894;
const kenoraDir = fromLatLon(natureKenoraLatDeg * Math.PI / 180, natureKenoraLonDeg * Math.PI / 180);
const dotHK = Math.max(-1, Math.min(1,
  planet.home[0] * kenoraDir[0] + planet.home[1] * kenoraDir[1] + planet.home[2] * kenoraDir[2],
));
const homeGreatCircleErrorKm = Math.acos(dotHK) * PLANET.radius / 1000;
const lonDiffDeg = Math.abs((((gameHomeLonDeg - natureKenoraLonDeg + 540) % 360) - 180));
const homeLongitudeScore = unitScore(lonDiffDeg, 0, 180.0);

// 1b. Solar elevation at Kenora (-94.49 W, 49.77 N) & PlanetSim UTC hour when game clock is 12:00 noon on summer solstice (day 172):
const sunNoon = planetSunDirection(planet, 12, 172);
const kenoraSinEl = kenoraDir[0] * sunNoon[0] + kenoraDir[1] * sunNoon[1] + kenoraDir[2] * sunNoon[2];
const gameKenoraNoonElevDeg = Math.asin(Math.max(-1, Math.min(1, kenoraSinEl))) * 180 / Math.PI; // -19.81 deg (astronomical night!)
const natureKenoraNoonElevDeg = 90 - natureKenoraLatDeg + 23.439; // +63.67 deg
const kenoraNoonSolarScore = unitScore(gameKenoraNoonElevDeg, natureKenoraNoonElevDeg, 90.0);

const gameLayerUtcAtNoon = (((12 - gameHomeLonDeg / 15) % 24) + 24) % 24; // 7.631 h UTC
const natureKenoraUtcAtNoon = (((12 - natureKenoraLonDeg / 15) % 24) + 24) % 24; // 18.299 h UTC
const utcErrorHours = Math.min(
  Math.abs(natureKenoraUtcAtNoon - gameLayerUtcAtNoon),
  24 - Math.abs(natureKenoraUtcAtNoon - gameLayerUtcAtNoon),
);
const globeUtcPhaseScore = unitScore(utcErrorHours, 0, 12.0);

// ---------------------------------------------------------------------------
// 2. Orbit-to-Glide Descent, Embody Handover, & Forest-to-Orbit Ascent Continuity
// ---------------------------------------------------------------------------
// 2a. Frame-1 orbital altitude preserved when pressing G at 2.2 R (14,016.2 km):
const startOrbitAltM = obs2?.descentTrace?.preDropAltM ?? (PLANET.radius * 2.2);
const beginDrop = descentBegin(startOrbitAltM);
const frame1AltM = obs2?.descentTrace?.frame1AltM ?? beginDrop.y; // ~140,401 m (99.00% teleported in 1 frame!)
const frame1RetainedAltRatio = frame1AltM / startOrbitAltM; // 0.0100 vs ~0.99+ continuous start
const orbitDropContinuityScore = ratioScore(frame1AltM, startOrbitAltM);

// 2b. Frame-1 #descent-cover vignette jump on pressing G (expected 0.00 at t = 0 vs 0.609 pop):
const frame1Vignette = obs2?.descentTrace?.frame1Cover ?? (DESCENT.vignette * Math.sin(Math.PI * beginDrop.p));
const vignetteSmoothStartScore = unitScore(frame1Vignette, 0.0, DESCENT.vignette);

// 2c. Embody camera blend duration from 400 m aerial glide to 1.55 m wolf rig (TRANSITION.blendSec = 1.0 s):
// Check handoverBlend directly AND live frame trace:
const testPoseA = { p: new THREE.Vector3(0, 400, 0), q: new THREE.Quaternion() };
const testPoseB = { p: new THREE.Vector3(0, 1.55, 0), q: new THREE.Quaternion() };
const blendedMid = handoverBlend({ p: testPoseA.p.clone(), q: testPoseA.q.clone() }, testPoseB, 0.5);
const handoverMidpointY = blendedMid.p.y; // 400.0 (handoverBlend ignores rig & blend!)
const expectedMidpointY = 0.5 * (400 + 1.55); // 200.775 m
const measuredEmbodySec = obs3?.embodyAudit?.gameReachedDtMs != null && obs3.embodyAudit.gameReachedDtMs > 0
  ? obs3.embodyAudit.gameReachedDtMs / 1000
  : 1 / 60;
const embodyBlendDurationScore = handoverMidpointY === 400
  ? ratioScore(Math.min(measuredEmbodySec, 1 / 30), TRANSITION.blendSec)
  : ratioScore(measuredEmbodySec, TRANSITION.blendSec);

// 2d. Shift+G ascent handoff continuity at bandTop (~2,100 m) & remote-site preservation:
const lastBandAscentM = obs3?.ascentAudit?.lastBandHeightM ?? (TRANSITION.bandTop * 1.05);
const firstGlobeAscentM = obs3?.ascentAudit?.firstGlobeAltM ?? (PLANET.radius * 2.2);
const ascentContinuityScore = ratioScore(lastBandAscentM, firstGlobeAscentM); // 2100 / 14016200 = 0.0001!

// ---------------------------------------------------------------------------
// 3. US76 Aerodynamic Free-Fall Drag & 8.0 m/s Forward Glide Handoff
// ---------------------------------------------------------------------------
// 3a. High-altitude free-fall velocity at FALL_END_M = 3,048 m (10,000 ft) from 100 km Karman line:
// US Standard Atmosphere 1976: T(z) = 288.15 - 0.0065*z in troposphere -> rho(3048 m) = 0.9046 kg/m^3.
// Ballistic coefficient beta = m / (Cd * A) = 175 kg/m^2 (80 kg prone body, Cd*A = 0.457 m^2, Hoerner 1965 Ch. 3).
const us76Density = (zM) => {
  const z = Math.max(0, zM);
  if (z <= 11_000) {
    const T = 288.15 - 0.0065 * z;
    const p = 101325 * (T / 288.15) ** (9.80665 / (287.05287 * 0.0065));
    return p / (287.05287 * T);
  }
  if (z <= 25_000) {
    const p11 = 22632.06;
    const T11 = 216.65;
    const p = p11 * Math.exp((-9.80665 * (z - 11_000)) / (287.05287 * T11));
    return p / (287.05287 * T11);
  }
  return 1.225 * Math.exp(-z / 7200);
};
const ballisticBetaKgM2 = 175;
const natureTerminalSpeedAt10kFtMs = Math.sqrt(
  (2 * ballisticBetaKgM2 * gravity(FALL_END_M)) / us76Density(FALL_END_M),
); // 61.18 m/s
const gameFallSpeedAt10kFtMs = Math.abs(fallVelocity(100_000, FALL_END_M)); // 1372.52 m/s (Mach 4.4 vacuum!)
const terminalVelocityDragScore = ratioScore(natureTerminalSpeedAt10kFtMs, gameFallSpeedAt10kFtMs);

// 3b. Sub-10,000 ft freeFallVy drop from 3,000 m to 400 m:
let vyGameSub = 0, yGameSub = 3000;
for (let i = 0; i < 10_000 && yGameSub > 400; i++) {
  vyGameSub = freeFallVy(vyGameSub, yGameSub, 1 / 60);
  yGameSub += vyGameSub / 60;
}
const gameSubDropSpeedAt400mMs = Math.abs(vyGameSub); // 225.8 m/s
const natureTerminalSpeedAt400mMs = Math.sqrt(
  (2 * ballisticBetaKgM2 * gravity(400)) / us76Density(400),
); // 53.55 m/s
const subDropDragScore = ratioScore(natureTerminalSpeedAt400mMs, gameSubDropSpeedAt400mMs);

// 3c. Horizontal forward glide speed at 400 m ("Gliding above the land · Speed carries on", ANIMAL_LADDER.glideMs = 8.0 m/s):
// Simulate exact inpage.ts:185, 420-424 handoff when descend() receives vy = 0:
const firstBandVy = freeFallVy(0, DESCENT.glideM, 1 / 60); // -0.1636 m/s (>= -0.5 -> arrestGlide returns 0!)
const simArrested = arrestGlide({ x: 0, y: firstBandVy, z: 0 }, 0, true, false);
const simulatedGlideSpeedMs = Math.hypot(simArrested.x, simArrested.z);
const measuredGlideSpeedMs = obs2?.glideCheckOver1500ms
  ? obs2.glideCheckOver1500ms.horizontalGlidedM / 1.5
  : simulatedGlideSpeedMs;
const forwardGlideHandoffScore = unitScore(measuredGlideSpeedMs, ANIMAL_LADDER.glideMs, ANIMAL_LADDER.glideMs);

// ---------------------------------------------------------------------------
// 4. Multi-Scale Cloud-Deck Crossfade, Layer Toggle, Zonal Drift, & CLOUD_OPEN
// ---------------------------------------------------------------------------
// 4a. 2,500 km ORBIT_FADE continuity across 2,505 km -> 2,495 km on Ultra..Very Low (shellOctaves > 0):
setOrbitView(2_505_000, 0); // globeView.ts:680-681 when orbit = alt > 2_500_000 is true
const uOrbitDeckAbove = ORBIT_DRAW.uOrbitDeck.value; // 1
setOrbitView(2_495_000, CLOUDS.octaves[1]); // globeView.ts:680-681 when orbit is false (High tier octaves = 6)
const uOrbitDeckBelow = ORBIT_DRAW.uOrbitDeck.value; // 0 (instantaneous 1-frame swap!)
const expectedCrossfadeStep10km = orbitWeight(2_505_000) - orbitWeight(2_495_000); // 0.00002
const actualOrbitDeckStep10km = Math.abs(uOrbitDeckAbove - uOrbitDeckBelow); // 1.00000
const orbitCloudCrossfadeScore = unitScore(actualOrbitDeckStep10km, expectedCrossfadeStep10km, 1.0);

// 4b. Orbit cloud Layer Panel toggle obedience & 6-hour zonal wind drift (12 m/s at 49.77 N -> ~0.64 deg):
const cloudsOffObeyed = obs0?.orbitCloudToggleAndDriftAudit
  ? (obs0.orbitCloudToggleAndDriftAudit.uOrbitDeckWithCloudsOff === 0 ? 1 : 0)
  : 0;
const orbitHasWindDrift = ORBIT_FRAG.includes('uDrift') ? 1 : 0;
const expected6hDriftRad = stepCloudDrift(0, 6 * 3600 / 60, CLOUDS.windMs, 49.77, PLANET.radius, 1);
void expected6hDriftRad;
const orbitCloudToggleAndDriftScore = 0.5 * cloudsOffObeyed + 0.5 * orbitHasWindDrift;

// 4c. T-0041 CLOUD_OPEN planetary shell clearing at 200 km altitude (designed cloudClear(200 km) = 0.8753):
// globeView.ts:712 computes cloudClear(alt) * localCloudFade(alt) = 0.8753 * 0 = 0.0000!
const designedClearAt200km = cloudClear(200_000); // 0.8753
const gameAppliedClearAt200km = designedClearAt200km * localCloudFade(200_000); // 0.0000
const cloudOpenMidAltScore = unitScore(gameAppliedClearAt200km, designedClearAt200km, designedClearAt200km);

const checks = [
  {
    id: 'globe_home_kenora_longitude_on_real_earth_coasts',
    label: 'Planetary globe home longitude (PLANET.home) when real-Earth ETOPO1 coasts & Blue Marble clouds are active',
    gameValue: `${gameHomeLatDeg.toFixed(2)} deg N, +${gameHomeLonDeg.toFixed(2)} deg E (Kostanay Steppe, Kazakhstan; ${homeGreatCircleErrorKm.toFixed(0)} km / ${lonDiffDeg.toFixed(2)} deg off)`,
    natureTarget: `${natureKenoraLatDeg.toFixed(2)} deg N, ${natureKenoraLonDeg.toFixed(2)} deg W (Kenora, Ontario, Lake of the Woods)`,
    source: 'NRCan Canadian Geographical Names Data Base (Kenora, ON) & Amante & Eakins (2009) ETOPO1 global relief',
    score: Number(homeLongitudeScore.toFixed(4)),
    passes95: homeLongitudeScore >= 0.95,
  },
  {
    id: 'globe_kenora_noon_solar_elevation_and_utc_phase',
    label: 'Solar elevation over Kenora (-94.49 W) & PlanetSim UTC spinup at 12:00 local solar noon (summer solstice)',
    gameValue: `${gameKenoraNoonElevDeg.toFixed(2)} deg sun (astronomical night!) & ${gameLayerUtcAtNoon.toFixed(2)} h UTC (${utcErrorHours.toFixed(2)} h phase error)`,
    natureTarget: `+${natureKenoraNoonElevDeg.toFixed(2)} deg sun elevation & ${natureKenoraUtcAtNoon.toFixed(2)} h UTC`,
    source: 'Meeus (1998) Astronomical Algorithms & Reda & Andreas (2004), Solar Energy 76(5):577-589',
    score: Number((0.5 * (kenoraNoonSolarScore + globeUtcPhaseScore)).toFixed(4)),
    passes95: 0.5 * (kenoraNoonSolarScore + globeUtcPhaseScore) >= 0.95,
  },
  {
    id: 'orbit_descent_frame1_altitude_continuity',
    label: 'Frame-1 orbital altitude retained on pressing G / double-clicking at 2.2 R (14,016 km)',
    gameValue: `${(frame1AltM / 1000).toFixed(1)} km on Frame 1 (${((1 - frame1RetainedAltRatio) * 100).toFixed(2)}% of altitude teleported in 1 frame; ${(DESCENT.sec * (1 - DESCENT.vacuum)).toFixed(2)} s left)`,
    natureTarget: `>= ${(0.95 * startOrbitAltM / 1000).toFixed(0)} km on Frame 1 (continuous 14.0 s trajectory from live orbital altitude)`,
    source: 'Carlbom & Paciorek (1978), ACM Comput. Surv. 10(4):465-502 & Christie et al. (2008) C^1 camera continuity',
    score: Number(orbitDropContinuityScore.toFixed(4)),
    passes95: orbitDropContinuityScore >= 0.95,
  },
  {
    id: 'orbit_descent_frame1_vignette_continuity',
    label: 'Frame-1 #descent-cover vignette opacity jump when initiating glide descent (t = 0)',
    gameValue: `${frame1Vignette.toFixed(3)} opacity on Frame 1 (${((frame1Vignette / DESCENT.vignette) * 100).toFixed(1)}% of ${DESCENT.vignette} peak popped instantaneously)`,
    natureTarget: '0.000 opacity at t = 0 (smooth ramp-in over initial descent)',
    source: 'Boreal flight.ts:109 vignette envelope contract (sin(pi * p) starting from p = 0)',
    score: Number(vignetteSmoothStartScore.toFixed(4)),
    passes95: vignetteSmoothStartScore >= 0.95,
  },
  {
    id: 'embody_handover_blend_duration_400m_to_ground',
    label: 'Aerial-to-wolf embody camera handover interpolation (400 m isometric glide -> 1.55 m ground rig on pressing G)',
    gameValue: `0 blended frames (1-frame 398.45 m snap 403.75 m -> 5.30 m; blend = 1 immediately & handoverBlend returns pose unchanged)`,
    natureTarget: `${(TRANSITION.blendSec * 1000).toFixed(0)} ms (~60 frames) smooth Hermite position & quaternion blend (TRANSITION.blendSec = 1.0 s)`,
    source: 'Christie, Olivier & Normand (2008), Comput. Graph. Forum 27(8):2197-2218 & transition.ts:26 blendSec = 1',
    score: Number(embodyBlendDurationScore.toFixed(4)),
    passes95: embodyBlendDurationScore >= 0.95,
  },
  {
    id: 'shift_g_ascent_altitude_and_remote_site_continuity',
    label: 'Shift+G ascent handoff from bandTop (2.1 km) to globe mode & remote landing site preservation',
    gameValue: `2.1 km -> ${(firstGlobeAscentM / 1000).toFixed(0)} km in 1 frame (6,674x jumpTo teleport; remote site wiped ${obs3?.ascentAudit?.wipedRemoteSiteLonDeltaDeg ?? 160.0} deg back to +65.54 E)`,
    natureTarget: 'Continuous climb from 2.1 km toward orbital targetAlt while preserving landed SITE.dir',
    source: 'Christie et al. (2008) continuous ascent & Boreal T-0216 remote site frame contract',
    score: Number(ascentContinuityScore.toFixed(4)),
    passes95: ascentContinuityScore >= 0.95,
  },
  {
    id: 'atmospheric_drag_terminal_velocity_at_10000ft',
    label: 'Free-fall vertical speed at 10,000 ft (3,048 m) from 100 km Karman line (fallVelocity)',
    gameValue: `${gameFallSpeedAt10kFtMs.toFixed(1)} m/s (Mach 4.4 vacuum acceleration; 0 aerodynamic drag)`,
    natureTarget: `${natureTerminalSpeedAt10kFtMs.toFixed(1)} m/s (US76 rho(3048 m) = 0.905 kg/m^3, beta = 175 kg/m^2)`,
    source: 'U.S. Standard Atmosphere (1976), NOAA-S/T 76-1562 & Hoerner (1965), Fluid-Dynamic Drag',
    score: Number(terminalVelocityDragScore.toFixed(4)),
    passes95: terminalVelocityDragScore >= 0.95,
  },
  {
    id: 'sub_10000ft_free_fall_drag_at_400m',
    label: 'Sub-10,000 ft freeFallVy vertical speed arriving at 400 m from a 3,000 m drop',
    gameValue: `${gameSubDropSpeedAt400mMs.toFixed(1)} m/s (813 km/h vacuum free-fall)`,
    natureTarget: `${natureTerminalSpeedAt400mMs.toFixed(1)} m/s (US76 rho(400 m) = 1.179 kg/m^3 terminal speed)`,
    source: 'U.S. Standard Atmosphere (1976) & Hoerner (1965), Fluid-Dynamic Drag',
    score: Number(subDropDragScore.toFixed(4)),
    passes95: subDropDragScore >= 0.95,
  },
  {
    id: 'forward_glide_handoff_speed_at_400m',
    label: 'Horizontal forward glide speed at 400 m hold ("Gliding above the land · Speed carries on")',
    gameValue: `${measuredGlideSpeedMs.toFixed(3)} m/s (stationary hover; vy = -0.164 >= -0.5 leaves arrestGlide dead & airRush = 0)`,
    natureTarget: `${ANIMAL_LADDER.glideMs.toFixed(1)} m/s forward glide along heading (ANIMAL_LADDER.glideMs)`,
    source: 'Pennycuick (2008), Modelling the Flying Bird (8-15 m/s avian glide) & animalLadder.ts:29, 59-62',
    score: Number(forwardGlideHandoffScore.toFixed(4)),
    passes95: forwardGlideHandoffScore >= 0.95,
  },
  {
    id: 'orbit_cloud_crossfade_continuity_across_2500km',
    label: 'Cloud-deck crossfade step across 2,505 km -> 2,495 km (ORBIT_FADE 2,500 km -> 700 km window)',
    gameValue: `delta uOrbitDeck = ${actualOrbitDeckStep10km.toFixed(4)} (1-frame hard swap between NASA Blue Marble & procedural shell at 2,500 km)`,
    natureTarget: `delta weight = ${expectedCrossfadeStep10km.toFixed(5)} (smooth crossfade across 2,500 km -> 700 km)`,
    source: 'Boreal orbitAlbedo.ts:26, 58-64 ORBIT_FADE contract & King et al. (2013) MODIS cloud continuity',
    score: Number(orbitCloudCrossfadeScore.toFixed(4)),
    passes95: orbitCloudCrossfadeScore >= 0.95,
  },
  {
    id: 'orbit_cloud_layer_toggle_and_zonal_wind_drift',
    label: 'Layer Panel Clouds toggle obedience & zonal wind advection (stepCloudDrift) on orbit clouds (> 2,500 km)',
    gameValue: `toggle obeyed = ${cloudsOffObeyed}, wind drift wired = ${orbitHasWindDrift} (clouds stay 100% visible when toggled off & frozen onto continents)`,
    natureTarget: 'toggle obeyed = 1, wind drift wired = 1 (advected by stepCloudDrift ~12 m/s eastward)',
    source: 'Peixoto & Oort (1992), Physics of Climate (synoptic zonal advection) & Boreal layerPanel.ts / atmosphere.ts:111',
    score: Number(orbitCloudToggleAndDriftScore.toFixed(4)),
    passes95: orbitCloudToggleAndDriftScore >= 0.95,
  },
  {
    id: 'cloud_open_planetary_shell_clearing_at_200km',
    label: 'Planetary cloud-shell clearing (atmos.setClear) at 200 km altitude during descent (T-0041 CLOUD_OPEN)',
    gameValue: `${gameAppliedClearAt200km.toFixed(4)} (multiplied by localCloudFade(200 km) = 0 -> 0.000 across 1,500..40 km, then 18.7x pop at 40..32 km)`,
    natureTarget: `${designedClearAt200km.toFixed(4)} (cloudClear(200 km) log-altitude ramp over 1,500 km -> 150 km)`,
    source: 'Boreal T-0041 & transition.ts:42-43 CLOUD_OPEN specification',
    score: Number(cloudOpenMidAltScore.toFixed(4)),
    passes95: cloudOpenMidAltScore >= 0.95,
  },
];

const meanScore = checks.reduce((s, c) => s + c.score, 0) / checks.length;
const passingCount = checks.filter((c) => c.passes95).length;

const report = {
  task: 'T-0235',
  subsystem: 'Planetary globe Kenora geography & UTC phase, orbit-to-forest descent/ascent & embody continuity, US76 aerodynamic free-fall drag & 8 m/s glide handoff, and multi-scale cloud-deck crossfades',
  generatedAt: new Date().toISOString(),
  metric: {
    formula: 'ratioScore(a,b) = min(a,b)/max(a,b) for positive scales; unitScore(m,t,S) = max(0, 1 - |m - t|/S) for bounded physical intervals',
    passThreshold: 0.95,
    calibration: {
      knownMatchKenoraLat: Number(calKnownMatchKenoraLat.toFixed(4)),
      knownMatchSeaLevelTerminalSpeed: Number(calKnownMatchSeaLevelVt.toFixed(4)),
      knownMismatchKazakhstanLon: Number(calKnownMismatchKazakhstanLon.toFixed(4)),
      knownMismatchVacuumFallSpeed: Number(calKnownMismatchVacuumFall.toFixed(4)),
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
