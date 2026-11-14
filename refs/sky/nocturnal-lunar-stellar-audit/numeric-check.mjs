/**
 * Calibrated Rule 11 numeric evaluation for T-0231:
 * Nocturnal sky, seasonal lunar ecliptic declination & calendar-year propagation,
 * rendered lunar disc, moonless night cloud silhouette vs glow, sidereal starfield rotation &
 * twilight/daylight star extinction, and Full-Moon vs Moonless night ground illumination & animal sight.
 *
 * Run with: npx tsx refs/sky/nocturnal-lunar-stellar-audit/numeric-check.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { SYNODIC, moonAge, moonLux } from '../../../src/core/light.ts';
import { lighting, sunPosition } from '../../../src/core/timeOfDay.ts';
import { altAz, jdFromDate } from '../../../src/core/planets.ts';
import { DEER_AGENT } from '../../../src/core/species.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const obsPath = resolve(__dirname, 'observations.json');
const obsDoc = JSON.parse(readFileSync(obsPath, 'utf8'));
const [obs0, obs1, obs2] = obsDoc.observations;

const RAD = Math.PI / 180;
const OBLIQ = 23.43928 * RAD; // IAU 2006 J2000 mean obliquity

/** Minimal pure-Node PNG RGBA/RGB decoder for exact rendered-frame pixel verification. */
function decodePng(filePath) {
  const buf = readFileSync(filePath);
  let pos = 8, width = 0, height = 0, colorType = 6;
  const idats = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const chunk = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      width = chunk.readUInt32BE(0);
      height = chunk.readUInt32BE(4);
      colorType = chunk[9];
    } else if (type === 'IDAT') {
      idats.push(chunk);
    } else if (type === 'IEND') break;
    pos += 12 + len;
  }
  const bpp = colorType === 6 ? 4 : 3;
  const raw = inflateSync(Buffer.concat(idats));
  const stride = width * bpp;
  const out = new Uint8Array(height * stride);
  const paeth = (a, b, c) => {
    const p = a + b - c;
    const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
  };
  for (let y = 0; y < height; y++) {
    const f = raw[y * (stride + 1)];
    const rowIn = y * (stride + 1) + 1;
    const rowOut = y * stride;
    for (let i = 0; i < stride; i++) {
      const x = raw[rowIn + i];
      const a = i >= bpp ? out[rowOut + i - bpp] : 0;
      const b = y > 0 ? out[rowOut - stride + i] : 0;
      const c = y > 0 && i >= bpp ? out[rowOut - stride + i - bpp] : 0;
      out[rowOut + i] = (x + (f === 1 ? a : f === 2 ? b : f === 3 ? (a + b) >> 1 : f === 4 ? paeth(a, b, c) : 0)) & 255;
    }
  }
  return { width, height, bpp, data: out };
}

function lumaAt(img, x, y) {
  const i = (y * img.width + x) * img.bpp;
  return (0.2126 * img.data[i] + 0.7152 * img.data[i + 1] + 0.0722 * img.data[i + 2]) / 255;
}

function meanRoiLuma(img, x0, y0, w, h) {
  let sum = 0;
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) sum += lumaAt(img, x, y);
  }
  return sum / (w * h);
}

/**
 * Calibrated metrics (Rule 11):
 * - unitScore: bounded [0, 1] linear distance metric over full physical scale `fullScale`
 * - ratioScore: symmetric bounded [0, 1] positive ratio metric min(a,b)/max(a,b)
 */
export function unitScore(measured, target, fullScale) {
  if (!Number.isFinite(measured) || !Number.isFinite(target) || fullScale <= 0) return 0;
  return +(Math.max(0, 1 - Math.min(1, Math.abs(measured - target) / fullScale))).toFixed(4);
}

export function ratioScore(measured, target) {
  if (!Number.isFinite(measured) || !Number.isFinite(target) || measured <= 0 || target <= 0) return 0;
  return +(Math.min(measured, target) / Math.max(measured, target)).toFixed(4);
}

/**
 * Independent reference: Meeus (1998), Astronomical Algorithms (2nd ed., Willmann-Bell),
 * Ch. 47 principal periodic terms for geocentric lunar ecliptic longitude, latitude, RA/Dec,
 * and local horizon altitude/azimuth via GMST (eq. 12.4).
 */
export function meeusLunarAltAz(utDate, latDeg, lonDeg) {
  const jd = jdFromDate(utDate);
  const T = (jd - 2451545.0) / 36525;
  const norm = (deg) => ((deg % 360) + 360) % 360;
  const Lp = norm(218.3164477 + 481267.88123421 * T) * RAD;
  const D = norm(297.8501921 + 445267.1114034 * T) * RAD;
  const M = norm(357.5291092 + 35999.0502909 * T) * RAD;
  const Mp = norm(134.9633964 + 477198.8675055 * T) * RAD;
  const F = norm(93.2720950 + 483202.0175233 * T) * RAD;

  const lonDegMoon =
    Lp / RAD +
    6.288774 * Math.sin(Mp) +
    1.274027 * Math.sin(2 * D - Mp) +
    0.658314 * Math.sin(2 * D) +
    0.213618 * Math.sin(2 * Mp) -
    0.185116 * Math.sin(M) -
    0.114332 * Math.sin(2 * F);
  const latDegMoon =
    5.128122 * Math.sin(F) +
    0.280602 * Math.sin(Mp + F) +
    0.277693 * Math.sin(Mp - F) +
    0.173237 * Math.sin(2 * D - F);

  const lam = norm(lonDegMoon) * RAD;
  const bet = latDegMoon * RAD;
  const x = Math.cos(bet) * Math.cos(lam);
  const y = Math.cos(bet) * Math.sin(lam) * Math.cos(OBLIQ) - Math.sin(bet) * Math.sin(OBLIQ);
  const z = Math.cos(bet) * Math.sin(lam) * Math.sin(OBLIQ) + Math.sin(bet) * Math.cos(OBLIQ);
  const ra = norm(Math.atan2(y, x) / RAD);
  const dec = Math.asin(Math.max(-1, Math.min(1, z))) / RAD;
  const hor = altAz(ra, dec, utDate, latDeg, lonDeg);
  return { ra, dec, lonDegMoon: norm(lonDegMoon), latDegMoon, elevation: hor.elevation, azimuth: hor.azimuth };
}

// Rule 11 Calibration Suite (known match >= 0.95, known mismatch < 0.95)
const calibration = {
  lunarElevationMetric: {
    metric: 'unitScore(elevDeg, meeusElevDeg, 90)',
    knownMatch: unitScore(66.5, 67.8, 90),     // 0.9856 >= 0.95 PASS
    knownMismatch: unitScore(16.8, 67.8, 90),  // 0.4333 < 0.95 FAIL
  },
  ratioMetric: {
    metric: 'ratioScore(measured, target) = min(a,b)/max(a,b)',
    knownMatch: ratioScore(2.24, 2.28),        // 0.9825 >= 0.95 PASS
    knownMismatch: ratioScore(0.927, 2.28),    // 0.4066 < 0.95 FAIL
  },
};

if (calibration.lunarElevationMetric.knownMatch < 0.95 || calibration.lunarElevationMetric.knownMismatch >= 0.95) {
  throw new Error('Calibration failed on lunarElevationMetric');
}
if (calibration.ratioMetric.knownMatch < 0.95 || calibration.ratioMetric.knownMismatch >= 0.95) {
  throw new Error('Calibration failed on ratioMetric');
}

// Decode actual captured frames to measure rendered star coordinates, cloud glow, and wolf brightness
const png0 = decodePng(resolve(__dirname, 'frame-0.png'));
const png1 = decodePng(resolve(__dirname, 'frame-1.png'));
const png2 = decodePng(resolve(__dirname, 'frame-2.png'));

// Detect pinpoint star spikes in top clear sky strip (x=640..780, y=4..36, above the status card) in frame-0 (Dec 24 00:08) vs frame-2 (Aug 15 19:57)
function starSpikes(img) {
  const pts = new Set();
  for (let y = 4; y < 36; y++) {
    for (let x = 640; x < 780; x++) {
      const c = lumaAt(img, x, y);
      const bg = 0.25 * (lumaAt(img, x - 2, y) + lumaAt(img, x + 2, y) + lumaAt(img, x, y - 2) + lumaAt(img, x, y + 2));
      if (c - bg > 0.08) pts.add(`${x},${y}`);
    }
  }
  return pts;
}
const spikes0 = starSpikes(png0);
const spikes2 = starSpikes(png2);
let exactSamePixelStars = 0;
for (const k of spikes0) {
  if (spikes2.has(k)) exactSamePixelStars++;
}
const stationaryStarFractionRendered = spikes0.size > 0 ? exactSamePixelStars / spikes0.size : 1.0;
const randomOverlapExpectation = spikes0.size > 0 ? spikes2.size / ((780 - 640) * (36 - 4)) : 0;
const renderedMoonlessCloudSkyLuma = +meanRoiLuma(png1, 300, 8, 280, 70).toFixed(4);
// Pure wolf dorsal coat ROI (x=655..690, y=390..450) and distant south-shore hill ROI (x=1060..1240, y=245..290)
const renderedWolfBackLumaFullMoon = +meanRoiLuma(png0, 655, 390, 35, 60).toFixed(4);
const renderedWolfBackLumaNewMoon = +meanRoiLuma(png1, 655, 390, 35, 60).toFixed(4);
const renderedShoreHillLumaFullMoon = +meanRoiLuma(png0, 1060, 245, 180, 45).toFixed(4);
const renderedShoreHillLumaNewMoon = +meanRoiLuma(png1, 1060, 245, 180, 45).toFixed(4);

const KENORA_LAT = 49.79;
const KENORA_LON = -94.36;

// 1. Winter Full Moon elevation at Kenora (2026-12-24 00:00 local solar time)
const utWinFull = new Date(Date.UTC(2026, 11, 24, 0, 0, 0) - (KENORA_LON / 15) * 3600e3);
const meeusWinFull = meeusLunarAltAz(utWinFull, KENORA_LAT, KENORA_LON);
const ageWinFull = moonAge(358, 2026);
const gameWinFull = sunPosition(0 - (ageWinFull / SYNODIC) * 24, 358, KENORA_LAT);

// 2. Arctic Polar-Night Full Moon illuminance (68.0 N, 2026-12-24 00:00 local solar time)
const meeusArcticFull = meeusLunarAltAz(utWinFull, 68.0, KENORA_LON);
const gameArcticFull = sunPosition(0 - (ageWinFull / SYNODIC) * 24, 358, 68.0);
const EmoonArcticTarget = moonLux(ageWinFull, Math.sin(meeusArcticFull.elevation * RAD));
const EmoonArcticGame = moonLux(ageWinFull, Math.sin(gameArcticFull.elevation * RAD));

// 3. Summer Full Moon elevation at Kenora (2026-06-29 23:50 local solar time, doy = 180)
const utSumFull = new Date(Date.UTC(2026, 5, 29, 23, 50, 0) - (KENORA_LON / 15) * 3600e3);
const meeusSumFull = meeusLunarAltAz(utSumFull, KENORA_LAT, KENORA_LON);
const ageSumFull = moonAge(180, 2026);
const gameSumFull = sunPosition(23.8333 - (ageSumFull / SYNODIC) * 24, 180, KENORA_LAT);

// 4. Non-2026 calendar year lunar age on 2025-01-14 Wolf Full Moon (DAY.year = 2025, doy = 14)
const gameAge2025Jan14 = obs2.year2025Jan14Check.gameReportedMoonAge;
const realAge2025Jan14 = moonAge(14, 2025);

// 5. Visible Moon disc angular diameter in ground-view sky (deg)
const gameMoonDiscDeg = 0.0;
const realMoonDiscDeg = 0.5181; // Meeus (1998) Ch. 55 mean lunar angular diameter 31'05"

// 6. Moonless midnight cloud linear luminance in natural dark sky (Kyba et al. 2015)
const gameNightCloudLinearLuma = +(0.2126 * 0.16 + 0.7152 * 0.17 + 0.0722 * 0.22).toFixed(4);
const targetMoonlessCloudLinearLuma = 0.0025;

// 7. Sidereal starfield angular rotation rate (deg/h): sky.ts:77 hashes local camera-horizon vector `d` directly (0.0000 deg/h),
// confirmed in rendered frames: 47/66 (71.2%, vs 1.9% random chance; remaining 28.8% modulated only by sin(uTime*3) twinkle & cloud veil)
// sit on the exact same (x, y) pixel across 169.8 deg of sidereal rotation between Dec 24 00:08 and Aug 15 19:57.
const targetSiderealRateDegPerHour = 15.0411; // 360.985647 deg / 24 h (Meeus 1998 eq. 12.4)
const gameSiderealRateDegPerHour = 0.0;

// 8. Daylight / low-sun faint-star visibility suppression (sun.elevation = +2.0 deg above horizon)
const gameStarAlphaAtSunPlus2Deg = +(1 - lighting(2.0).day).toFixed(4);
const targetStarAlphaAtSunPlus2Deg = 0.0;

// 9. Star scintillation angular frequency under 60x clock dial (rad/s in real observer wall time)
const gameScintillationRadPerWallSecAt60x = 3.0 * 60;
const targetScintillationRadPerWallSec = 3.0;

// 10. Full-Moon vs Moonless New-Moon adapted ground luminance ratio (L_full / L_new)
const gameFullToNewGroundRatio = +(obs0.fillFullMoon.ground / obs1.fillNewMoon.ground).toFixed(4);
const targetFullToNewGroundRatio = +((0.245 / 0.001) ** 0.15).toFixed(4); // 2.2827

// 11. Nocturnal animal visual range multiplier under Clear Full Moon (0.25 lx) vs Moonless Starlight (0.001 lx)
const deerVisionNewMoonGame = Math.max(DEER_AGENT.senses.sight.night, lighting(-35).day);
const deerVisionFullMoonGame = Math.max(DEER_AGENT.senses.sight.night, lighting(-35).day);
const gameLunarSightGain = +(deerVisionFullMoonGame / deerVisionNewMoonGame).toFixed(4);
const targetLunarSightGain = +((0.35 + (1 - 0.35) * (Math.log10(0.25 / 0.001) / Math.log10(3.4 / 0.001))) / 0.35).toFixed(4);

const checks = [
  {
    id: 'winter_full_moon_elevation_kenora_deg',
    description: 'Winter Full Moon (2026-12-24 00:00) meridian elevation at Kenora (49.79 N)',
    game: +gameWinFull.elevation.toFixed(4),
    target: +meeusWinFull.elevation.toFixed(4),
    source: 'Meeus (1998) Astronomical Algorithms Ch. 47 & eq. 12.4 (+27.6 deg standstill decl vs game -23.4 deg solar decl)',
    metric: 'unitScore(game, target, 90)',
    score: unitScore(gameWinFull.elevation, meeusWinFull.elevation, 90),
  },
  {
    id: 'arctic_polar_night_full_moon_lux',
    description: 'Arctic polar-night (68.0 N, 2026-12-24 00:00) Full Moon horizontal illuminance (lx)',
    game: +EmoonArcticGame.toFixed(4),
    target: +EmoonArcticTarget.toFixed(4),
    source: 'Meeus (1998) Ch. 47 & Krisciunas & Schaefer (1991) PASP 103:1033 (circumpolar +49.6 deg winter Full Moon vs game -4.6 deg below horizon)',
    metric: 'unitScore(game, target, target)',
    score: unitScore(EmoonArcticGame, EmoonArcticTarget, EmoonArcticTarget),
  },
  {
    id: 'summer_full_moon_elevation_kenora_deg',
    description: 'Summer Full Moon (2026-06-29 23:50) meridian elevation at Kenora (49.79 N)',
    game: +gameSumFull.elevation.toFixed(4),
    target: +meeusSumFull.elevation.toFixed(4),
    source: 'Meeus (1998) Ch. 47 (low summer Full Moon at -27.5 deg decl vs game +23.2 deg overhead)',
    metric: 'unitScore(game, target, 90)',
    score: unitScore(gameSumFull.elevation, meeusSumFull.elevation, 90),
  },
  {
    id: 'non_2026_year_lunar_age_days',
    description: 'Lunar phase age (days) on 2025-01-14 Wolf Full Moon (DAY.year = 2025, doy = 14)',
    game: +gameAge2025Jan14.toFixed(4),
    target: +realAge2025Jan14.toFixed(4),
    source: 'Meeus (1998) Ch. 49 synodic epoch 2000-01-06 18:14 UT (sky.ts omits DAY.year -> 25.42 d crescent instead of 14.79 d Full Moon)',
    metric: 'unitScore(phaseDaysDiff, 0, SYNODIC/2)',
    score: unitScore(
      Math.min(Math.abs(gameAge2025Jan14 - realAge2025Jan14), SYNODIC - Math.abs(gameAge2025Jan14 - realAge2025Jan14)),
      0,
      SYNODIC / 2,
    ),
  },
  {
    id: 'rendered_moon_disc_angular_diameter_deg',
    description: 'Rendered Moon disc angular diameter in clear night sky (deg)',
    game: gameMoonDiscDeg,
    target: realMoonDiscDeg,
    source: 'Meeus (1998) Ch. 55 & Kieffer & Stone (2005) AJ 129:2887 (mean lunar disc 0.5181 deg; sky.ts draws 0 Moon geometry/shader)',
    metric: 'ratioScore(game, target)',
    score: ratioScore(gameMoonDiscDeg, realMoonDiscDeg),
  },
  {
    id: 'moonless_night_cloud_linear_luma',
    description: 'Moonless midnight (age = 0.05 d, sun -63.6 deg) cloud linear luminance in natural dark sky',
    game: gameNightCloudLinearLuma,
    target: targetMoonlessCloudLinearLuma,
    source: 'Kyba et al. (2015) Sci. Rep. 5:8409 (unpolluted moonless clouds silhouette dark ~0.0025 vs sky.ts fixed 0.1715 grey-white glow; frame-1 sRGB luma=' + renderedMoonlessCloudSkyLuma + ')',
    metric: 'ratioScore(game, target)',
    score: ratioScore(gameNightCloudLinearLuma, targetMoonlessCloudLinearLuma),
  },
  {
    id: 'sidereal_star_rotation_rate_deg_h',
    description: 'Sidereal starfield angular rotation rate around celestial pole (deg/h)',
    game: gameSiderealRateDegPerHour,
    target: targetSiderealRateDegPerHour,
    source: `IAU 1982 GMST / Meeus (1998) eq. 12.4 (15.0411 deg/h vs sky.ts:77 alt-az hash 0.0000 deg/h; ${exactSamePixelStars}/${spikes0.size} star pixels unmoved vs ${(randomOverlapExpectation * 100).toFixed(1)}% chance across 169.8 deg ΔLST)`,
    metric: 'unitScore(game, target, target)',
    score: unitScore(gameSiderealRateDegPerHour, targetSiderealRateDegPerHour, targetSiderealRateDegPerHour),
  },
  {
    id: 'daylight_low_sun_star_alpha_leak',
    description: 'Faint-star shader visibility factor when Sun is +2.0 deg above horizon',
    game: gameStarAlphaAtSunPlus2Deg,
    target: targetStarAlphaAtSunPlus2Deg,
    source: 'Schaefer (1993) Vistas Astron. 36:311 (daytime sky >1000 cd/m^2 has V_lim < -2.5 mag -> 0% starfield vs sky.ts 39.39% leak)',
    metric: 'unitScore(game, target, 1.0)',
    score: unitScore(gameStarAlphaAtSunPlus2Deg, targetStarAlphaAtSunPlus2Deg, 1.0),
  },
  {
    id: 'star_scintillation_60x_dial_rad_s',
    description: 'Real-time star twinkle angular rate (rad/s) under 60x clock dial',
    game: gameScintillationRadPerWallSecAt60x,
    target: targetScintillationRadPerWallSec,
    source: 'Dravins et al. (1997) PASP 109:173 (observer real-time atmospheric scintillation ~3 rad/s vs sky.ts worldSec 180 rad/s strobe)',
    metric: 'ratioScore(game, target)',
    score: ratioScore(gameScintillationRadPerWallSecAt60x, targetScintillationRadPerWallSec),
  },
  {
    id: 'full_moon_to_new_moon_ground_luminance_ratio',
    description: 'Adapted ground luminance ratio between Clear Full Moon (0.245 lx) and Moonless New Moon (0.001 lx)',
    game: gameFullToNewGroundRatio,
    target: targetFullToNewGroundRatio,
    source: `Krisciunas & Schaefer (1991) & core/light.ts (E_ref/E)^0.85 law (245^0.15 = 2.2827x brighter Full Moon vs game 0.9271x inverted floor; wolf sRGB ${renderedWolfBackLumaFullMoon} vs ${renderedWolfBackLumaNewMoon})`,
    metric: 'ratioScore(game, target)',
    score: ratioScore(gameFullToNewGroundRatio, targetFullToNewGroundRatio),
  },
  {
    id: 'full_moon_animal_visual_range_gain',
    description: 'Cervid/prey nocturnal visual range multiplier under Clear Full Moon (0.25 lx) vs Moonless Starlight (0.001 lx)',
    game: gameLunarSightGain,
    target: targetLunarSightGain,
    source: 'Prugh et al. (2019) J. Anim. Ecol. 88:1158 & Kemp & Jacobs (1992) (~2.26x mesopic lunar sight gain vs game 1.0000x solar-only daylight=0)',
    metric: 'ratioScore(game, target)',
    score: ratioScore(gameLunarSightGain, targetLunarSightGain),
  },
];

const passingCount = checks.filter((c) => c.score >= 0.95).length;
const meanScore = +(checks.reduce((s, c) => s + c.score, 0) / checks.length).toFixed(4);

const summary = {
  task: 'T-0231',
  evaluatedAt: new Date().toISOString(),
  threshold: 0.95,
  passingChecks: passingCount,
  totalChecks: checks.length,
  meanScore,
  allPass: passingCount === checks.length,
  renderedFrameDiagnostics: {
    frame0StarSpikesInClearStrip: spikes0.size,
    frame2StarSpikesInClearStrip: spikes2.size,
    exactSamePixelOverlapBetweenDec24AndAug15: exactSamePixelStars,
    stationaryStarFractionRendered: +stationaryStarFractionRendered.toFixed(4),
    renderedMoonlessCloudSkyLumaFrame1: renderedMoonlessCloudSkyLuma,
    renderedWolfBackLumaFullMoonFrame0: renderedWolfBackLumaFullMoon,
    renderedWolfBackLumaNewMoonFrame1: renderedWolfBackLumaNewMoon,
    renderedShoreHillLumaFullMoonFrame0: renderedShoreHillLumaFullMoon,
    renderedShoreHillLumaNewMoonFrame1: renderedShoreHillLumaNewMoon,
  },
  calibration,
  checks,
};

writeFileSync(resolve(__dirname, 'numbers.json'), JSON.stringify(summary, null, 2));
console.log(`Evaluated ${checks.length} calibrated checks: ${passingCount}/${checks.length} pass >= 0.95 (meanScore = ${meanScore})`);
console.log('Rendered diagnostics:', JSON.stringify(summary.renderedFrameDiagnostics));
for (const c of checks) {
  console.log(`  [${c.score >= 0.95 ? 'PASS' : 'FAIL'} ${c.score.toFixed(4)}] ${c.id}: game=${c.game} vs target=${c.target}`);
}
