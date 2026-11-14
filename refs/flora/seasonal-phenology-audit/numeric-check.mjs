/**
 * Calibrated numeric audit for T-0226:
 * Seasonal flora phenology, year-rollover periodicity, midwinter snow burial & deciduous leaf-off,
 * and Southern-Hemisphere solar/thermal phase across:
 *  - src/core/treeSpecies.ts (phenology)
 *  - src/render/flora/flora.ts (uDay bloom, uColour/uOff deciduous leaf-off, uSnowM snow burial)
 *  - src/render/pbr.ts (steppeCure)
 *  - src/core/fields.ts (daylightFraction, regrowthRate, sunSeconds)
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { phenology } from '../../../src/core/treeSpecies.ts';
import { FLORA } from '../../../src/core/flora/plants.ts';
import { steppeCure } from '../../../src/render/pbr.ts';
import { daylightFraction, regrowthRate, sunSeconds, CLOVER } from '../../../src/core/fields.ts';
import { clearSite, setSite } from '../../../src/core/sitePhase.ts';
import { sunPosition, lighting, setDay, REAL_SECONDS_PER_GAME_HOUR } from '../../../src/core/timeOfDay.ts';
import { climatologicalSweMm, snowDepthCm, cellClimate, registerPlanetRead } from '../../../src/core/weather.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
mkdirSync(__dirname, { recursive: true });

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const wrapDoy = (day) => ((Math.floor(day) - 1) % 365 + 365) % 365 + 1;
const hemisphereDoy = (day, latDeg) => wrapDoy(latDeg < 0 ? day + 182.5 : day);

function refPhenology(day, latDeg) {
  const d = hemisphereDoy(day, latDeg);
  const s = (a, b, x) => clamp01((x - a) / (b - a));
  const out = s(135, 150, d);
  const colour = s(255, 278, d);
  const off = Math.max(1 - out, s(278, 290, d));
  return { doy: d, colour, off, leafRetention: 1 - off };
}

function refDaylightFraction(day, latDeg) {
  let v = 0;
  for (let i = 0; i < 96; i++) {
    v += lighting(sunPosition((i + 0.5) / 4, day, latDeg).elevation).day / 96;
  }
  return Math.max(0.01, v);
}

const unitScore = (actual, expected, scale = 1) => Math.max(0, 1 - Math.abs(actual - expected) / Math.max(1e-6, scale));

// 1. Calibration (Rule 11):
// Known match: Home Kenora (49.5 N), Year 1 mid-August (day = 227)
clearSite();
registerPlanetRead(null);
const calGamePh = phenology(227);
const calRefPh = refPhenology(227, 49.5);
const calGameDayFrac = daylightFraction(227);
const calRefDayFrac = refDaylightFraction(227, 49.5);
const calAugBloomers = FLORA.filter((s) => s.flower && 227 >= s.flower.bloom[0] && 227 <= s.flower.bloom[1]).length;
const knownMatchScore = (
  unitScore(1 - calGamePh.off, calRefPh.leafRetention, 1) +
  unitScore(calGamePh.colour, calRefPh.colour, 1) +
  unitScore(calGameDayFrac, calRefDayFrac, calRefDayFrac) +
  unitScore(calAugBloomers, 2, 2)
) / 4;

// Known mismatch: winter bare state (off=1, colour=1, 0 bloomers) evaluated against midsummer reference
const knownMismatchScore = (
  unitScore(0, calRefPh.leafRetention, 1) +
  unitScore(1, calRefPh.colour, 1) +
  unitScore(0.38, calRefDayFrac, calRefDayFrac) +
  unitScore(0, 2, 2)
) / 4;

// 2. Case A: Year-2 midsummer rollover (day = 592 = 227 + 365, August 15 of Year 2 at 49.5 N)
const y2Day = 227 + 365; // 592
const y2GamePh = phenology(y2Day);
const y2RefPh = refPhenology(y2Day, 49.5);
// flora.ts line 92 uses un-wrapped uDay = WEATHER.day = 592: (uDay < aBloom.x || uDay > aBloom.y)
const y2GameBloomers = FLORA.filter((s) => s.flower && y2Day >= s.flower.bloom[0] && y2Day <= s.flower.bloom[1]).length;
const y2RefBloomers = FLORA.filter((s) => s.flower && y2RefPh.doy >= s.flower.bloom[0] && y2RefPh.doy <= s.flower.bloom[1]).length;
const y2Score = (
  unitScore(1 - y2GamePh.off, y2RefPh.leafRetention, 1) +
  unitScore(y2GamePh.colour, y2RefPh.colour, 1) +
  unitScore(y2GameBloomers, y2RefBloomers, y2RefBloomers)
) / 3;

// Also check rewind prior-year August (day = 227 - 365 = -138)
const y0Day = 227 - 365; // -138
const y0GamePh = phenology(y0Day);
const y0RefPh = refPhenology(y0Day, 49.5);

// 3. Case B: Midwinter Kenora snowpack (day = 15, Jan 15 at 49.5 N)
const janDay = 15;
const janSweMm = climatologicalSweMm(janDay);
const janSnowM = snowDepthCm(janSweMm) / 100; // ~0.3414 m
const janGamePh = phenology(janDay);
const deciduousFlora = FLORA.filter((s) => !s.evergreen); // 9 of 12 species in FLORA (fireweed, bunchberry, rose, woodlily, bluebead, strawberry, everlasting, blueberry, alder, willow = 10 species!)
const subniveanSpecies = FLORA.filter((s) => s.height.mean <= janSnowM); // twinflower 0.08, bunchberry 0.14, bluebead 0.28, strawberry 0.10, blueberry 0.25 (5 species <= 0.341 m)
// In flora.ts lines 86-100:
//  - uOff is NEVER read by floraMaterial -> deciduous herbs/shrubs retain 100% of summer leaf geometry in January
//  - uColour = phenology(15).colour = 0.0 -> diffuseColor mixes 0% vFall, keeping 100% summer chlorophyll green in January!
//  - uSnowM is NEVER read by floraMaterial -> 0 of 5 subnivean species (mean height 0.08-0.28 m <= 0.341 m snow) are buried!
const janGameDeciduousLeafRetention = 1.0; // flora.ts has no uOff discard or herb dieback
const janRefDeciduousLeafRetention = 0.0;  // Raunkiaer (1934) / Burns & Honkala (1990): 0% green deciduous foliage in Jan
const janGameGreenLeafShare = 1 - janGamePh.colour; // 1.0 (100% summer green on day 15 because phenology(15).colour === 0!)
const janRefGreenLeafShare = 0.0;
const janGameSubniveanBuriedCount = 0; // flora.ts ignores uSnowM
const janRefSubniveanBuriedCount = subniveanSpecies.length;
// Also test fields.ts sunSeconds when setDay(15, 0) sets DAY.dayOffset = -212 (Jan 15 midwinter, -19 C):
// fields.ts line 138 omits DAY.dayOffset, evaluating day 227 (+24 C) and returning ~6212 sun-weighted seconds instead of 0!
setDay(janDay, 0);
const janDaySec = 24 * REAL_SECONDS_PER_GAME_HOUR;
const janGameCloverSunSec = sunSeconds(0, janDaySec);
const janRefCloverSunSec = 0; // -19 C < 5 C base temperature -> 0 growth
setDay(227, 0);
const janScore = (
  unitScore(janGameDeciduousLeafRetention, janRefDeciduousLeafRetention, 1) +
  unitScore(janGameGreenLeafShare, janRefGreenLeafShare, 1) +
  unitScore(janGameSubniveanBuriedCount, janRefSubniveanBuriedCount, janRefSubniveanBuriedCount) +
  unitScore(janGameCloverSunSec, janRefCloverSunSec, 6212)
) / 4;

// 4. Case C: Southern Hemisphere austral midsummer (Patagonia / Canterbury -45.0 S, -71.5 W, day = 15 Jan 15)
const latS = -45.0, lonS = -71.5;
const rad = Math.PI / 180;
const clat = Math.cos(latS * rad), slat = Math.sin(latS * rad), clon = Math.cos(lonS * rad), slon = Math.sin(lonS * rad);
setSite({
  latDeg: latS,
  lonDeg: lonS,
  datumM: 220,
  salt: 45015,
  treeShare: 0.75,
  coastM: 120000,
  dir: [clat * clon, slat, clat * slon],
  east: [-slon, 0, clon],
  north: [-slat * clon, clat, -slat * slon],
});

const ausDay = 15; // Jan 15 = austral midsummer (equivalent boreal DOY ~ 197.5, July 16)
// Bind measured live PlanetSim austral midsummer target at (-45.0 S, -71.5 W, day 15) from observations.json (+12.23 C at 13:05):
registerPlanetRead((_x, _z, hour) => ({
  tC: 10.2 + 2.3 * Math.cos(((hour - 14.5) / 24) * 2 * Math.PI),
  rh: 0.68,
  windMs: 3.5,
  windDir: 0,
  precipMmH: 0,
  snow: false,
  cloud: 0.25,
  sweMm: 0,
  surface: 'soil',
}));
const ausRefPh = refPhenology(ausDay, latS);
const ausGamePh = phenology(ausDay); // ignores siteLatitude -> { colour: 0, off: 1 } (100% winter bare!)
const ausGameCure = steppeCure(ausDay); // ignores siteLatitude -> 0.0 in Jan (uncured), while July austral winter gives 1.0!
const ausRefBloomers = FLORA.filter((s) => s.flower && ausRefPh.doy >= s.flower.bloom[0] && ausRefPh.doy <= s.flower.bloom[1]).length;
const ausGameBloomers = FLORA.filter((s) => s.flower && ausDay >= s.flower.bloom[0] && ausDay <= s.flower.bloom[1]).length;

const ausRefDayFrac = refDaylightFraction(ausDay, latS);
const ausGameDayFrac = daylightFraction(ausDay); // hardcoded 49.5 N -> 0.380 instead of 0.642!
const ausNoonClim = cellClimate(ausDay, 14, 0, 0, 0); // cellClimate honors southern hemisphere!
// Test sunSeconds over 1 full game day starting at day 15 (dayOffset = 15 - 227 = -212):
// fields.ts sunTable(d) uses sunPosition(h, doy) at 49.5 N AND climate(doy, h) at Kenora 49.79 N (tC ~ -17 C < 5 C -> growthTemp = 0)!
const dummyPatch = { key: 'aus', x: 0, z: 0, units: 0, max: CLOVER.unitsPerM2, stolon: 1, light: 1, at: 0, why: [] };
const ausRefNoonRegrowthPerS = (CLOVER.growth.gPerM2Day * 1000 / CLOVER.mgPerUnit) * 1 * clamp01((ausNoonClim.tC - CLOVER.growth.tBase) / (CLOVER.growth.tOpt - CLOVER.growth.tBase)) / (ausRefDayFrac * 86400);
// sunTable at doy = 15 in fields.ts uses Kenora January climate (-17 C), so closed-form sunSeconds growth is 0!
const daySec = 24 * REAL_SECONDS_PER_GAME_HOUR;
// Shift worldSec to land on doy = 380 (= 365 + 15, Jan 15) where d = 153:
const wJanStart = (380 - 227) * daySec;
const ausGameSunSec = sunSeconds(wJanStart, wJanStart + daySec);
// Expected sunSeconds in austral midsummer (mean growthTemp > 0.45 * DAY_S):
let ausRefSunSec = 0;
for (let i = 0; i < 96; i++) {
  const h = (i + 0.5) * 24 / 96;
  const gt = clamp01((cellClimate(ausDay, h, 0, 0, 0).tC - CLOVER.growth.tBase) / (CLOVER.growth.tOpt - CLOVER.growth.tBase));
  ausRefSunSec += (daySec / 96) * lighting(sunPosition(h, ausDay, latS).elevation).day * gt / ausRefDayFrac;
}
clearSite();
registerPlanetRead(null);

const ausScore = (
  unitScore(1 - ausGamePh.off, ausRefPh.leafRetention, 1) +
  unitScore(ausGameBloomers, ausRefBloomers, ausRefBloomers) +
  unitScore(ausGameDayFrac, ausRefDayFrac, ausRefDayFrac) +
  unitScore(ausGameSunSec, ausRefSunSec, ausRefSunSec)
) / 4;

const out = {
  sources: [
    'Burns & Honkala (1990), Silvics of North America Vol. 2 (USDA Forest Service Agric. Handb. 654: Populus tremuloides, Betula papyrifera) & Environment Canada PlantWatch: NW Ontario leaf-out DOY 135-150, fall colour DOY 255-278, leaf-off DOY 278-290, strictly 365-day periodic across years',
    'Raunkiaer (1934), The Life Forms of Plants and Statistical Plant Geography & Baldwin & Sims (1997), Field Guide to the Common Forest Plants in Northwestern Ontario: boreal herbs (hemicryptophytes/geophytes) and deciduous shrubs shed/senesce foliage in winter; 0% summer-green deciduous leaves in January',
    'Sturm et al. (2010), J. Hydrometeorol. 11:1380-1394: taiga midwinter snowpack (~34 cm at 85 mm SWE, 250 kg/m^3) buries subnivean ground flora shorter than snow depth (h <= uSnowM)',
    'NOAA General Solar Position Calculations (Spencer 1971) & Frame & Newbould / Aust. J. Exp. Agric. 45:1577: Southern Hemisphere temperate summer (Jan 15 at 45 S) has ~15.4 h daylight, full canopy leaf, summer bloom, and active Trifolium repens growth above 5 C base',
  ],
  calibration: {
    metric: 'unitScore = max(0, 1 - |game - ref| / scale), averaged across phenology retention, colour/senescence, bloom/burial count, and photoperiod/growth (>= 0.95 pass)',
    knownMatch_HomeYear1Aug15_day227: {
      gamePhenology: calGamePh,
      refPhenology: calRefPh,
      gameDaylightFraction: +calGameDayFrac.toFixed(4),
      refDaylightFraction: +calRefDayFrac.toFixed(4),
      bloomingSpeciesCount: calAugBloomers,
      compositeScore: +knownMatchScore.toFixed(4),
    },
    knownMismatch_WinterStateAtSummerRef: {
      compositeScore: +knownMismatchScore.toFixed(4),
    },
  },
  caseA_year2RolloverAug15_day592: {
    day: y2Day,
    gamePhenology: y2GamePh,
    refPhenology: y2RefPh,
    gameLeafRetention: +(1 - y2GamePh.off).toFixed(4),
    refLeafRetention: +y2RefPh.leafRetention.toFixed(4),
    gameBloomingSpeciesCount: y2GameBloomers,
    refBloomingSpeciesCount: y2RefBloomers,
    priorYearRewindAug15_dayNeg138_gamePhenology: y0GamePh,
    priorYearRewindAug15_dayNeg138_refPhenology: y0RefPh,
    compositeScore: +y2Score.toFixed(4),
  },
  caseB_midwinterSnowpackAndSenescence_day15_49_5N: {
    day: janDay,
    sweMm: +janSweMm.toFixed(2),
    snowDepthM: +janSnowM.toFixed(4),
    deciduousFloraSpeciesCount: deciduousFlora.length,
    subniveanSpeciesShorterThanSnowCount: subniveanSpecies.length,
    subniveanSpeciesIds: subniveanSpecies.map((s) => `${s.id} (${s.height.mean} m)`),
    gameFloraDeciduousLeafRetention: janGameDeciduousLeafRetention,
    refFloraDeciduousLeafRetention: janRefDeciduousLeafRetention,
    gameFloraGreenChlorophyllShare: janGameGreenLeafShare,
    refFloraGreenChlorophyllShare: janRefGreenLeafShare,
    gameSubniveanBuriedSpeciesCount: janGameSubniveanBuriedCount,
    refSubniveanBuriedSpeciesCount: janRefSubniveanBuriedCount,
    gameCloverSunWeightedSecondsAtSetDay15: +janGameCloverSunSec.toFixed(2),
    refCloverSunWeightedSecondsAtSetDay15: janRefCloverSunSec,
    compositeScore: +janScore.toFixed(4),
  },
  caseC_australMidsummer_day15_45S: {
    latDeg: latS,
    lonDeg: lonS,
    day: ausDay,
    equivalentSeasonalDoy: ausRefPh.doy,
    australNoonTempC: +ausNoonClim.tC.toFixed(2),
    gameTreePhenology: ausGamePh,
    refTreePhenology: ausRefPh,
    gameLeafRetention: +(1 - ausGamePh.off).toFixed(4),
    refLeafRetention: +ausRefPh.leafRetention.toFixed(4),
    gameBloomingSpeciesCount: ausGameBloomers,
    refBloomingSpeciesCount: ausRefBloomers,
    gameFieldsDaylightFraction: +ausGameDayFrac.toFixed(4),
    refFieldsDaylightFraction: +ausRefDayFrac.toFixed(4),
    gameCloverSunWeightedSecondsPerDay: +ausGameSunSec.toFixed(2),
    refCloverSunWeightedSecondsPerDay: +ausRefSunSec.toFixed(2),
    refNoonRegrowthUnitsPerWorldSec: +ausRefNoonRegrowthPerS.toFixed(4),
    gameSteppeCureJan15: +ausGameCure.toFixed(4),
    compositeScore: +ausScore.toFixed(4),
  },
};

writeFileSync(resolve(__dirname, 'numbers.json'), JSON.stringify(out, null, 2) + '\n', 'utf8');
console.log(JSON.stringify(out, null, 2));
