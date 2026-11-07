/**
 * Calibrated numeric check for Boreal animal circadian / seasonal photoperiod (T-0172).
 *
 * Sources:
 * 1. NOAA General Solar Position Calculations (Spencer 1971 Fourier series for solar declination;
 *    local-solar geometric horizon sunrise hour angle cos(h0) = -tan(phi)*tan(delta),
 *    https://gml.noaa.gov/grad/solcalc/solareqns.PDF).
 * 2. Theuerkauf, J., Jedrzejewski, W., Schmidt, K., Okarma, H., Ruczynski, I., Sniezko, S., & Gula, R. (2003).
 *    "Daily patterns and duration of wolf activity in the Bialowieza Forest, Poland."
 *    Journal of Mammalogy, 84(1):243-253. doi:10.1644/1545-1542(2003)084<0243:DPADOW>2.0.CO;2
 *    (Crepuscular bimodal activity peaks anchored to local seasonal sunrise and sunset +-1..1.5 h;
 *    inactivity bouts fill off-peak troughs when rest < 90%).
 *
 * Note on comparisons:
 * - Solar sunrise, sunset, day length, and sun elevation are checked against independently precalculated
 *   NOAA Spencer (1971) local-solar geometric-horizon fixtures (independent of src/core/needs/behaviour.ts).
 * - Activity inclination (activityAt) and goal choice (chooseGoal) comparisons represent the game's
 *   Theuerkauf-parameterized species-schedule model expectations when fed the true site sunrise/sunset
 *   vs the un-propagated 49.5 deg N or hardcoded 06:00/18:00 sunrise/sunset.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sunTimes, activityAt, chooseGoal } from '../../../src/core/needs/behaviour.ts';
import { WOLF_NEEDS } from '../../../src/core/needs/species/index.ts';
import { createNeeds, levelsOf } from '../../../src/core/needs/engine.ts';
import { createWorld, createAnimal, tick } from '../../../src/core/sim/index.ts';
import { sunPosition, LATITUDE } from '../../../src/core/timeOfDay.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
mkdirSync(__dirname, { recursive: true });

const round4 = (n) => Math.round(n * 10000) / 10000;

/**
 * Independently precalculated NOAA Spencer (1971) solar fixtures (local solar time, geometric horizon
 * cos(h0) = -tan(phi)*tan(delta), where gamma = 2*pi*(dayOfYear - 1)/365 at local solar noon):
 * - Day 172 (June 21), gamma = 2.9434605 rad -> decl = +0.4091404 rad (+23.4420 deg):
 *   - phi = 64.5 deg N: -tan(64.5 deg)*tan(23.4420 deg) = -0.9096523 -> h0 = 155.4537 deg = 10.3636 h
 *     -> sunrise = 1.6374 h (01:38), sunset = 22.3626 h (22:22), dayLength = 20.7252 h;
 *     at hour = 21.8 (21:48), solar elevation = +1.6034 deg.
 *   - phi = 49.5 deg N: -tan(49.5 deg)*tan(23.4420 deg) = -0.5072683 -> h0 = 120.4814 deg = 8.0321 h
 *     (exact Spencer series: sunrise = 3.9649 h, sunset = 20.0351 h, dayLength = 16.0702 h);
 *     at hour = 4.2 (04:12), solar elevation = +1.8418 deg.
 * - Day 355 (Dec 21), gamma = 6.0934689 rad -> decl = -0.4090521 rad (-23.4370 deg):
 *   - phi = 64.5 deg N: -tan(64.5 deg)*tan(-23.4370 deg) = +0.9094331 -> h0 = 24.7530 deg = 1.6502 h
 *     -> sunrise = 10.3498 h (10:21), sunset = 13.6502 h (13:39), dayLength = 3.3004 h;
 *     at hour = 8.0 (08:00), solar elevation = -9.2780 deg.
 *   - phi = 49.5 deg N: sunrise = 8.0316 h (08:02), sunset = 15.9684 h (15:58), dayLength = 7.9367 h.
 * - Day 227 (Aug 15), gamma = 3.8901935 rad -> decl = +0.2449730 rad (+14.0359 deg):
 *   - phi = 49.5 deg N: -tan(49.5 deg)*tan(14.0359 deg) = -0.2926940 -> h0 = 107.0195 deg = 7.1346 h
 *     (exact Spencer series: sunrise = 4.8423 h, sunset = 19.1577 h, dayLength = 14.3153 h);
 *     at hour = 6.0 (06:00), solar elevation = +10.8165 deg.
 */
const NOAA_FIXTURES = {
  summer64_5N_day172: {
    declinationDeg: 23.4420,
    sunriseHour: 1.6374,
    sunsetHour: 22.3626,
    dayLengthHours: 20.7252,
    elevationAt21_8Deg: 1.6034,
  },
  winter64_5N_day355: {
    declinationDeg: -23.4370,
    sunriseHour: 10.3498,
    sunsetHour: 13.6502,
    dayLengthHours: 3.3004,
    elevationAt8_0Deg: -9.2780,
  },
  summer49_5N_day172: {
    declinationDeg: 23.4420,
    sunriseHour: 3.9649,
    sunsetHour: 20.0351,
    dayLengthHours: 16.0702,
    elevationAt4_2Deg: 1.8418,
  },
  august49_5N_day227: {
    declinationDeg: 14.0359,
    sunriseHour: 4.8423,
    sunsetHour: 19.1577,
    dayLengthHours: 14.3153,
    elevationAt6_0Deg: 10.8165,
  },
};

// 1. Subarctic summer solstice dusk at 64.5 deg N (T-0165 open woodland, day 172, hour 21.8)
const daySummer = 172;
const latSubarctic = 64.5;
const hourSummerDusk = 21.8;

const noaaSummerSubarctic = {
  sunrise: NOAA_FIXTURES.summer64_5N_day172.sunriseHour,
  sunset: NOAA_FIXTURES.summer64_5N_day172.sunsetHour,
};
const gameMainSummerSubarctic = sunTimes(daySummer); // src/main.ts:578 omits siteLat(), defaults to LATITUDE = 49.5
const gameSimHardcoded = { sunrise: 6, sunset: 18 }; // src/core/sim/index.ts:240 hardcoded { sunrise: 6, sunset: 18 }

// Needs state with energy = 75 (above hunger drive threshold 60, below full 90) and rest = 80 (above bed-down 30, below 90)
const levelsRest80 = levelsOf(createNeeds({ water: 90, rest: 80 }), 75);

const modelExpectedSummerDuskAct = activityAt(WOLF_NEEDS, { hour: hourSummerDusk, ...noaaSummerSubarctic });
const modelExpectedSummerDuskChoice = chooseGoal(WOLF_NEEDS, levelsRest80, { hour: hourSummerDusk, ...noaaSummerSubarctic });

const gameMainSummerDuskAct = activityAt(WOLF_NEEDS, { hour: hourSummerDusk, ...gameMainSummerSubarctic });
const gameMainSummerDuskChoice = chooseGoal(WOLF_NEEDS, levelsRest80, { hour: hourSummerDusk, ...gameMainSummerSubarctic });

// 2. Subarctic winter solstice night at 64.5 deg N (day 355, hour 8.0)
const dayWinter = 355;
const hourWinterNight = 8.0;

const noaaWinterSubarctic = {
  sunrise: NOAA_FIXTURES.winter64_5N_day355.sunriseHour,
  sunset: NOAA_FIXTURES.winter64_5N_day355.sunsetHour,
};
const gameMainWinterSubarctic = sunTimes(dayWinter); // omits siteLat(), uses 49.5 deg N

const modelExpectedWinterNightAct = activityAt(WOLF_NEEDS, { hour: hourWinterNight, ...noaaWinterSubarctic });
const modelExpectedWinterNightChoice = chooseGoal(WOLF_NEEDS, levelsRest80, { hour: hourWinterNight, ...noaaWinterSubarctic });

const gameMainWinterNightAct = activityAt(WOLF_NEEDS, { hour: hourWinterNight, ...gameMainWinterSubarctic });
const gameMainWinterNightChoice = chooseGoal(WOLF_NEEDS, levelsRest80, { hour: hourWinterNight, ...gameMainWinterSubarctic });

// 3. Headless SimWorld predator step (src/core/sim/index.ts:240 + src/animals/hare.ts:286)
const hourSummerDawnHome = 4.2;
const noaaHomeSummer = {
  sunrise: NOAA_FIXTURES.summer49_5N_day172.sunriseHour,
  sunset: NOAA_FIXTURES.summer49_5N_day172.sunsetHour,
};
const modelExpectedHomeDawnChoice = chooseGoal(WOLF_NEEDS, levelsRest80, { hour: hourSummerDawnHome, ...noaaHomeSummer });

const simWorldDawn = createWorld({ seed: 1, step: 0.1, hour: () => hourSummerDawnHome });
const simWolfDawn = createAnimal(simWorldDawn, 'wolf', { x: 0, z: 0 }, { energy: 75, needs: createNeeds({ water: 90, rest: 80 }) });
tick(simWorldDawn, 0.1);

const simWorldDefaultHour = createWorld({ seed: 1, step: 0.1 });

// 4. Positive control (Known Match): Default LATITUDE = 49.5 deg N on day 227 at hour = 6.0 (dawn) vs independent NOAA fixture
const dayBaseline = 227;
const hourBaselineDawn = 6.0;
const noaaBaseline = {
  sunrise: NOAA_FIXTURES.august49_5N_day227.sunriseHour,
  sunset: NOAA_FIXTURES.august49_5N_day227.sunsetHour,
};
const gameMainBaseline = sunTimes(dayBaseline); // matches NOAA 49.5 deg N fixture because siteLat == LATITUDE
const modelExpectedBaselineAct = activityAt(WOLF_NEEDS, { hour: hourBaselineDawn, ...noaaBaseline });
const gameMainBaselineAct = activityAt(WOLF_NEEDS, { hour: hourBaselineDawn, ...gameMainBaseline });

const knownMatchErrorHours = round4(Math.abs(gameMainBaseline.sunset - noaaBaseline.sunset));
const knownMismatchErrorHours = round4(Math.abs(gameMainSummerSubarctic.sunset - noaaSummerSubarctic.sunset));
const simHardcodedMismatchHours = round4(Math.abs(gameSimHardcoded.sunset - noaaSummerSubarctic.sunset));

const report = {
  audit: 'animal-circadian-photoperiod',
  sources: [
    'NOAA General Solar Position Calculations (Spencer 1971 Fourier series for solar declination and geometric-horizon sunrise/sunset hour angle)',
    'Theuerkauf et al. (2003), J. Mammal. 84(1):243-253, doi:10.1644/1545-1542(2003)084<0243:DPADOW>2.0.CO;2 (crepuscular wolf activity anchored to seasonal sunrise/sunset +-1.5 h; game-model schedule expectation when fed true local solar sunrise/sunset)',
  ],
  calibration: {
    metric: 'Absolute sunrise/sunset time error |game - noaaFixture| in solar hours (threshold <= 0.10 h = 6 min), and game-model schedule inclination mismatch |gameActivity - expectedSiteActivity| (threshold <= 0.05)',
    knownMatch: {
      description: 'Home latitude 49.5 deg N on Day 227 (Aug 15) at dawn hour 6.0: sunTimes(227) vs independent NOAA Spencer (1971) 49.5 deg N fixture',
      gameSunsetHour: round4(gameMainBaseline.sunset),
      noaaFixtureSunsetHour: noaaBaseline.sunset,
      knownMatchErrorHours,
      gameModelActivity: round4(gameMainBaselineAct),
      expectedSiteModelActivity: round4(modelExpectedBaselineAct),
      knownMatchActivityError: round4(Math.abs(gameMainBaselineAct - modelExpectedBaselineAct)),
    },
    knownMismatch: {
      description: 'Subarctic woodland 64.5 deg N on Day 172 (June 21) at dusk hour 21.8: main.ts sunTimes(172) [omits siteLat, uses 49.5 deg N] and sim/index.ts hardcoded {sunrise: 6, sunset: 18} vs independent NOAA Spencer (1971) 64.5 deg N fixture',
      gameMainSunsetHour: round4(gameMainSummerSubarctic.sunset),
      gameSimSunsetHour: gameSimHardcoded.sunset,
      noaaFixtureSunsetHour: noaaSummerSubarctic.sunset,
      knownMismatchErrorHours,
      simHardcodedMismatchHours,
      gameMainModelActivityAt21_8: round4(gameMainSummerDuskAct),
      expectedSiteModelActivityAt21_8: round4(modelExpectedSummerDuskAct),
      knownMismatchActivityError: round4(Math.abs(gameMainSummerDuskAct - modelExpectedSummerDuskAct)),
    },
  },
  cases: {
    case0_subarcticSummerDusk_64_5N_day172_hour21_8: {
      latitudeDeg: latSubarctic,
      dayOfYear: daySummer,
      hour: hourSummerDusk,
      skySunElevationDeg: round4(sunPosition(hourSummerDusk, daySummer, latSubarctic).elevation),
      noaaFixtureSunElevationDeg: NOAA_FIXTURES.summer64_5N_day172.elevationAt21_8Deg,
      noaaFixtureSunriseHour: noaaSummerSubarctic.sunrise,
      noaaFixtureSunsetHour: noaaSummerSubarctic.sunset,
      noaaFixtureDayLengthHours: NOAA_FIXTURES.summer64_5N_day172.dayLengthHours,
      gameMainSunriseHour: round4(gameMainSummerSubarctic.sunrise),
      gameMainSunsetHour: round4(gameMainSummerSubarctic.sunset),
      gameMainDayLengthHours: round4(gameMainSummerSubarctic.sunset - gameMainSummerSubarctic.sunrise),
      sunsetErrorHours: round4(gameMainSummerSubarctic.sunset - noaaSummerSubarctic.sunset),
      dayLengthErrorHours: round4((gameMainSummerSubarctic.sunset - gameMainSummerSubarctic.sunrise) - NOAA_FIXTURES.summer64_5N_day172.dayLengthHours),
      expectedSiteModelActivity: round4(modelExpectedSummerDuskAct),
      gameMainModelActivity: round4(gameMainSummerDuskAct),
      expectedSiteModelGoal: modelExpectedSummerDuskChoice.goal,
      gameMainModelGoal: gameMainSummerDuskChoice.goal,
      gameMainModelWhy: gameMainSummerDuskChoice.why,
      resemblesNature: false,
    },
    case1_subarcticWinterNight_64_5N_day355_hour8_0: {
      latitudeDeg: latSubarctic,
      dayOfYear: dayWinter,
      hour: hourWinterNight,
      skySunElevationDeg: round4(sunPosition(hourWinterNight, dayWinter, latSubarctic).elevation),
      noaaFixtureSunElevationDeg: NOAA_FIXTURES.winter64_5N_day355.elevationAt8_0Deg,
      noaaFixtureSunriseHour: noaaWinterSubarctic.sunrise,
      noaaFixtureSunsetHour: noaaWinterSubarctic.sunset,
      noaaFixtureDayLengthHours: NOAA_FIXTURES.winter64_5N_day355.dayLengthHours,
      gameMainSunriseHour: round4(gameMainWinterSubarctic.sunrise),
      gameMainSunsetHour: round4(gameMainWinterSubarctic.sunset),
      gameMainDayLengthHours: round4(gameMainWinterSubarctic.sunset - gameMainWinterSubarctic.sunrise),
      sunriseErrorHours: round4(gameMainWinterSubarctic.sunrise - noaaWinterSubarctic.sunrise),
      dayLengthErrorHours: round4((gameMainWinterSubarctic.sunset - gameMainWinterSubarctic.sunrise) - NOAA_FIXTURES.winter64_5N_day355.dayLengthHours),
      expectedSiteModelActivity: round4(modelExpectedWinterNightAct),
      gameMainModelActivity: round4(gameMainWinterNightAct),
      expectedSiteModelGoal: modelExpectedWinterNightChoice.goal,
      gameMainModelGoal: gameMainWinterNightChoice.goal,
      gameMainModelWhy: gameMainWinterNightChoice.why,
      resemblesNature: false,
    },
    case2_simPredatorSummerDawn_49_5N_day172_hour4_2: {
      latitudeDeg: LATITUDE,
      dayOfYear: daySummer,
      hour: hourSummerDawnHome,
      skySunElevationDeg: round4(sunPosition(hourSummerDawnHome, daySummer, LATITUDE).elevation),
      noaaFixtureSunElevationDeg: NOAA_FIXTURES.summer49_5N_day172.elevationAt4_2Deg,
      noaaFixtureSunriseHour: noaaHomeSummer.sunrise,
      noaaFixtureSunsetHour: noaaHomeSummer.sunset,
      gameSimHardcodedSunriseHour: gameSimHardcoded.sunrise,
      gameSimHardcodedSunsetHour: gameSimHardcoded.sunset,
      sunriseErrorHours: round4(gameSimHardcoded.sunrise - noaaHomeSummer.sunrise),
      sunsetErrorHours: round4(gameSimHardcoded.sunset - noaaHomeSummer.sunset),
      expectedSiteModelGoal: modelExpectedHomeDawnChoice.goal,
      simWolfStateAfterTick: simWolfDawn.state,
      simWolfSpeedAfterTick: round4(simWolfDawn.speed),
      hareAdapterDefaultWorldHour: simWorldDefaultHour.hour(),
      resemblesNature: false,
    },
  },
};

const outPath = resolve(__dirname, 'numbers.json');
writeFileSync(outPath, JSON.stringify(report, null, 2) + '\n', 'utf8');
console.log(JSON.stringify(report, null, 2));
