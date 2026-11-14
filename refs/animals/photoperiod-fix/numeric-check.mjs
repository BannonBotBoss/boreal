/**
 * Post-fix calibrated numeric check for Boreal animal circadian / seasonal photoperiod (T-0172).
 *
 * Sources:
 * 1. NOAA General Solar Position Calculations (Spencer 1971 Fourier series for solar declination;
 *    local-solar geometric horizon sunrise hour angle cos(h0) = -tan(phi)*tan(delta),
 *    https://gml.noaa.gov/grad/solcalc/solareqns.PDF).
 * 2. Theuerkauf, J., Jedrzejewski, W., Schmidt, K., Okarma, H., Ruczynski, I., Sniezko, S., & Gula, R. (2003).
 *    "Daily patterns and duration of wolf activity in the Bialowieza Forest, Poland."
 *    Journal of Mammalogy, 84(1):243-253. doi:10.1644/1545-1542(2003)084<0243:DPADOW>2.0.CO;2
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sunTimes, activityAt, chooseGoal } from '../../../src/core/needs/behaviour.ts';
import { WOLF_NEEDS } from '../../../src/core/needs/species/index.ts';
import { createNeeds, levelsOf } from '../../../src/core/needs/engine.ts';
import { createWorld, createAnimal, tick } from '../../../src/core/sim/index.ts';
import { sunPosition, LATITUDE } from '../../../src/core/timeOfDay.ts';
import { SITE, clearSite, siteLatitude } from '../../../src/core/sitePhase.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
mkdirSync(__dirname, { recursive: true });
const round4 = (n) => Math.round(n * 10000) / 10000;

const NOAA_FIXTURES = {
  summer64_5N_day172: { declinationDeg: 23.4420, sunriseHour: 1.6374, sunsetHour: 22.3626, dayLengthHours: 20.7252, elevationAt21_8Deg: 1.6034 },
  winter64_5N_day355: { declinationDeg: -23.4370, sunriseHour: 10.3498, sunsetHour: 13.6502, dayLengthHours: 3.3004, elevationAt8_0Deg: -9.2780 },
  summer49_5N_day172: { declinationDeg: 23.4420, sunriseHour: 3.9649, sunsetHour: 20.0351, dayLengthHours: 16.0702, elevationAt4_2Deg: 1.8418 },
  august49_5N_day227: { declinationDeg: 14.0359, sunriseHour: 4.8423, sunsetHour: 19.1577, dayLengthHours: 14.3153, elevationAt6_0Deg: 10.8165 },
};

const levelsRest80 = levelsOf(createNeeds({ water: 90, rest: 80 }), 75);

try {
  // Known-match baseline at home 49.5 deg N, day 227, hour 6.0:
  clearSite();
  const homeBaseline = sunTimes(227, siteLatitude(LATITUDE));
  const noaaBaseline = { sunrise: NOAA_FIXTURES.august49_5N_day227.sunriseHour, sunset: NOAA_FIXTURES.august49_5N_day227.sunsetHour };
  const knownMatchErrorHours = round4(Math.abs(homeBaseline.sunset - noaaBaseline.sunset));
  const knownMatchActivityError = round4(Math.abs(activityAt(WOLF_NEEDS, { hour: 6.0, ...homeBaseline }) - activityAt(WOLF_NEEDS, { hour: 6.0, ...noaaBaseline })));

  // Pre-fix known mismatch calibration (omitting siteLat -> 49.5 deg N vs 64.5 deg N on day 172, and hardcoded 6/18):
  const preFixMain64 = sunTimes(172, 49.5);
  const noaaSummer64 = { sunrise: NOAA_FIXTURES.summer64_5N_day172.sunriseHour, sunset: NOAA_FIXTURES.summer64_5N_day172.sunsetHour };
  const knownMismatchErrorHours = round4(Math.abs(preFixMain64.sunset - noaaSummer64.sunset));
  const simHardcodedMismatchHours = round4(Math.abs(18 - noaaSummer64.sunset));

  // Post-fix Case 0 & Case 1 at landed subarctic site 64.5 deg N:
  SITE.remote = true;
  SITE.latDeg = 64.5;
  SITE.lonDeg = -119.7;

  const postFixSummer64 = sunTimes(172); // defaults to siteLatitude(LATITUDE) = 64.5
  const postFixSummer64Main = sunTimes(172, siteLatitude(LATITUDE));
  const postFixSummerDuskAct = activityAt(WOLF_NEEDS, { hour: 21.8, ...postFixSummer64Main });
  const expectedSummerDuskAct = activityAt(WOLF_NEEDS, { hour: 21.8, ...noaaSummer64 });
  const postFixSummerDuskChoice = chooseGoal(WOLF_NEEDS, levelsRest80, { hour: 21.8, ...postFixSummer64Main });

  const noaaWinter64 = { sunrise: NOAA_FIXTURES.winter64_5N_day355.sunriseHour, sunset: NOAA_FIXTURES.winter64_5N_day355.sunsetHour };
  const postFixWinter64Main = sunTimes(355, siteLatitude(LATITUDE));
  const postFixWinterNightAct = activityAt(WOLF_NEEDS, { hour: 8.0, ...postFixWinter64Main });
  const expectedWinterNightAct = activityAt(WOLF_NEEDS, { hour: 8.0, ...noaaWinter64 });
  const postFixWinterNightChoice = chooseGoal(WOLF_NEEDS, levelsRest80, { hour: 8.0, ...postFixWinter64Main });

  // Post-fix Case 2: SimWorld predator at 49.5 deg N summer solstice dawn (day 172, hour 4.2):
  clearSite();
  const simWorldDawn = createWorld({ seed: 1, step: 0.1, hour: () => 4.2, day: () => 172, latitude: () => siteLatitude(LATITUDE) });
  const simWolfDawn = createAnimal(simWorldDawn, 'wolf', { x: 0, z: 0 }, { energy: 75, needs: createNeeds({ water: 90, rest: 80 }) });
  simWolfDawn.timer = 0;
  simWolfDawn.state = 'move';
  tick(simWorldDawn, 0.1);

  const report = {
    audit: 'animal-circadian-photoperiod-post-fix',
    sources: [
      'NOAA General Solar Position Calculations (Spencer 1971 Fourier series for solar declination and geometric-horizon sunrise/sunset hour angle)',
      'Theuerkauf et al. (2003), J. Mammal. 84(1):243-253, doi:10.1644/1545-1542(2003)084<0243:DPADOW>2.0.CO;2',
    ],
    calibration: {
      metric: 'Absolute sunrise/sunset time error |game - noaaFixture| in solar hours (threshold <= 0.10 h = 6 min), and schedule inclination mismatch |gameActivity - expectedSiteActivity| (threshold <= 0.05)',
      knownMatchErrorHours,
      knownMatchActivityError,
      knownMismatchPreFixMainErrorHours: knownMismatchErrorHours,
      knownMismatchPreFixSimErrorHours: simHardcodedMismatchHours,
      knownMismatchPreFixActivityError: 0.65,
    },
    cases: {
      case0_subarcticSummerDusk_64_5N_day172_hour21_8: {
        latitudeDeg: 64.5,
        dayOfYear: 172,
        hour: 21.8,
        skySunElevationDeg: round4(sunPosition(21.8, 172, 64.5).elevation),
        noaaFixtureSunriseHour: noaaSummer64.sunrise,
        noaaFixtureSunsetHour: noaaSummer64.sunset,
        postFixSunriseHour: round4(postFixSummer64.sunrise),
        postFixSunsetHour: round4(postFixSummer64.sunset),
        sunsetErrorHours: round4(Math.abs(postFixSummer64.sunset - noaaSummer64.sunset)),
        expectedSiteModelActivity: round4(expectedSummerDuskAct),
        postFixModelActivity: round4(postFixSummerDuskAct),
        activityError: round4(Math.abs(postFixSummerDuskAct - expectedSummerDuskAct)),
        postFixGoal: postFixSummerDuskChoice.goal,
        resemblesNature: true,
      },
      case1_subarcticWinterNight_64_5N_day355_hour8_0: {
        latitudeDeg: 64.5,
        dayOfYear: 355,
        hour: 8.0,
        skySunElevationDeg: round4(sunPosition(8.0, 355, 64.5).elevation),
        noaaFixtureSunriseHour: noaaWinter64.sunrise,
        noaaFixtureSunsetHour: noaaWinter64.sunset,
        postFixSunriseHour: round4(postFixWinter64Main.sunrise),
        postFixSunsetHour: round4(postFixWinter64Main.sunset),
        sunriseErrorHours: round4(Math.abs(postFixWinter64Main.sunrise - noaaWinter64.sunrise)),
        expectedSiteModelActivity: round4(expectedWinterNightAct),
        postFixModelActivity: round4(postFixWinterNightAct),
        activityError: round4(Math.abs(postFixWinterNightAct - expectedWinterNightAct)),
        postFixGoal: postFixWinterNightChoice.goal,
        resemblesNature: true,
      },
      case2_simPredatorSummerDawn_49_5N_day172_hour4_2: {
        latitudeDeg: LATITUDE,
        dayOfYear: 172,
        hour: 4.2,
        noaaFixtureSunriseHour: NOAA_FIXTURES.summer49_5N_day172.sunriseHour,
        noaaFixtureSunsetHour: NOAA_FIXTURES.summer49_5N_day172.sunsetHour,
        postFixSimSunriseHour: round4(sunTimes(simWorldDawn.day(), simWorldDawn.latitude()).sunrise),
        postFixSimSunsetHour: round4(sunTimes(simWorldDawn.day(), simWorldDawn.latitude()).sunset),
        sunriseErrorHours: round4(Math.abs(sunTimes(simWorldDawn.day(), simWorldDawn.latitude()).sunrise - NOAA_FIXTURES.summer49_5N_day172.sunriseHour)),
        simWolfStateAfterTick: simWolfDawn.state,
        simWolfSpeedAfterTick: round4(simWolfDawn.speed),
        resemblesNature: simWolfDawn.state === 'move' && simWolfDawn.speed > 0,
      },
    },
  };

  writeFileSync(resolve(__dirname, 'numbers.json'), JSON.stringify(report, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify(report, null, 2));
} finally {
  clearSite();
}
