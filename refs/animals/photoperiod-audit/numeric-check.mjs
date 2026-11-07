/**
 * Calibrated numeric check for Boreal animal circadian / seasonal photoperiod (T-0172).
 *
 * Sources:
 * 1. NOAA General Solar Position Calculations (Spencer 1971 Fourier series for solar declination;
 *    sunrise hour angle cos(h0) = -tan(phi)*tan(delta) geometric, or (sin(-0.833 deg) - sin(phi)*sin(delta))/(cos(phi)*cos(delta))).
 * 2. Theuerkauf, J., Jedrzejewski, W., Schmidt, K., Okarma, H., Ruczynski, I., Sniezko, S., & Gula, R. (2003).
 *    "Daily patterns and duration of wolf activity in the Bialowieza Forest, Poland."
 *    Journal of Mammalogy, 84(1):243-253. doi:10.1644/1545-1542(2003)084<0243:DPADOW>2.0.CO;2
 *    (Crepuscular bimodal activity peaks anchored to local seasonal sunrise and sunset +-1..1.5 h;
 *    inactivity bouts fill off-peak troughs when rest < 90%).
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

// 1. Subarctic summer solstice dusk at 64.5 deg N (T-0165 open woodland, day 172, hour 21.8)
const daySummer = 172;
const latSubarctic = 64.5;
const hourSummerDusk = 21.8;

const refSummerSubarctic = sunTimes(daySummer, latSubarctic); // true siteLat() passed
const gameMainSummerSubarctic = sunTimes(daySummer); // src/main.ts:576 omits siteLat(), defaults to LATITUDE = 49.5
const gameSimHardcoded = { sunrise: 6, sunset: 18 }; // src/core/sim/index.ts:240 hardcoded { sunrise: 6, sunset: 18 }

const levelsRest80 = levelsOf(createNeeds({ water: 90, rest: 80 }), 90);

const refSummerDuskAct = activityAt(WOLF_NEEDS, { hour: hourSummerDusk, ...refSummerSubarctic });
const refSummerDuskChoice = chooseGoal(WOLF_NEEDS, levelsRest80, { hour: hourSummerDusk, ...refSummerSubarctic });

const gameMainSummerDuskAct = activityAt(WOLF_NEEDS, { hour: hourSummerDusk, ...gameMainSummerSubarctic });
const gameMainSummerDuskChoice = chooseGoal(WOLF_NEEDS, levelsRest80, { hour: hourSummerDusk, ...gameMainSummerSubarctic });

// 2. Subarctic winter solstice night at 64.5 deg N (day 355, hour 8.0)
const dayWinter = 355;
const hourWinterNight = 8.0;

const refWinterSubarctic = sunTimes(dayWinter, latSubarctic);
const gameMainWinterSubarctic = sunTimes(dayWinter); // omits siteLat(), uses 49.5 deg N

const refWinterNightAct = activityAt(WOLF_NEEDS, { hour: hourWinterNight, ...refWinterSubarctic });
const refWinterNightChoice = chooseGoal(WOLF_NEEDS, levelsRest80, { hour: hourWinterNight, ...refWinterSubarctic });

const gameMainWinterNightAct = activityAt(WOLF_NEEDS, { hour: hourWinterNight, ...gameMainWinterSubarctic });
const gameMainWinterNightChoice = chooseGoal(WOLF_NEEDS, levelsRest80, { hour: hourWinterNight, ...gameMainWinterSubarctic });

// 3. Headless SimWorld predator step (src/core/sim/index.ts:240 + src/animals/hare.ts:286)
// Even at default LATITUDE = 49.5 deg N on summer solstice (day = 172), dawn is at 4.13 h (04:08).
// At hour = 4.2 (04:12 dawn), true sunTimes(172, 49.5) gives sunrise = 4.1301 h -> |4.2 - 4.1301| = 0.0699 h <= 1.5 h -> active ('explore', state = 'move').
// But stepPredator hardcodes { sunrise: 6, sunset: 18 } -> |4.2 - 6| = 1.8 h > 1.5 h -> off-peak ('rest', state = 'rest', speed = 0).
const hourSummerDawnHome = 4.2;
const refHomeSummer = sunTimes(daySummer, LATITUDE);
const refHomeDawnChoice = chooseGoal(WOLF_NEEDS, levelsRest80, { hour: hourSummerDawnHome, ...refHomeSummer });

const simWorldDawn = createWorld({ seed: 1, step: 0.1, hour: () => hourSummerDawnHome });
const simWolfDawn = createAnimal(simWorldDawn, 'wolf', { x: 0, z: 0 }, { energy: 90, needs: createNeeds({ water: 90, rest: 80 }) });
tick(simWorldDawn, 0.1);

// Also check hare.ts default createWorld without hour option (defaults to hour = 12 noon even when world clock is at dawn):
const simWorldDefaultHour = createWorld({ seed: 1, step: 0.1 });

// 4. Positive control (Known Match): Default LATITUDE = 49.5 deg N on day 227 at hour = 6.0 (dawn)
const dayBaseline = 227;
const hourBaselineDawn = 6.0;
const refBaseline = sunTimes(dayBaseline, LATITUDE);
const gameMainBaseline = sunTimes(dayBaseline); // matches because siteLat == LATITUDE
const refBaselineAct = activityAt(WOLF_NEEDS, { hour: hourBaselineDawn, ...refBaseline });
const gameMainBaselineAct = activityAt(WOLF_NEEDS, { hour: hourBaselineDawn, ...gameMainBaseline });

const knownMatchErrorHours = round4(Math.abs(gameMainBaseline.sunset - refBaseline.sunset));
const knownMismatchErrorHours = round4(Math.abs(gameMainSummerSubarctic.sunset - refSummerSubarctic.sunset));
const simHardcodedMismatchHours = round4(Math.abs(gameSimHardcoded.sunset - refSummerSubarctic.sunset));

const report = {
  audit: 'animal-circadian-photoperiod',
  sources: [
    'NOAA General Solar Position Calculations (Spencer 1971 Fourier series for solar declination and sunrise/sunset hour angle)',
    'Theuerkauf et al. (2003), J. Mammal. 84(1):243-253, doi:10.1644/1545-1542(2003)084<0243:DPADOW>2.0.CO;2 (crepuscular wolf activity anchored to seasonal sunrise/sunset +-1.5 h)',
  ],
  calibration: {
    metric: 'Absolute sunrise/sunset time error |game - reference| in solar hours (threshold <= 0.10 h = 6 min), and activity inclination error |gameActivity - refActivity| (threshold <= 0.05)',
    knownMatch: {
      description: 'Home latitude 49.5 deg N on Day 227 (Aug 15) at dawn hour 6.0: sunTimes(227) vs sunTimes(227, 49.5)',
      gameSunsetHour: round4(gameMainBaseline.sunset),
      refSunsetHour: round4(refBaseline.sunset),
      knownMatchErrorHours,
      gameActivity: round4(gameMainBaselineAct),
      refActivity: round4(refBaselineAct),
      knownMatchActivityError: round4(Math.abs(gameMainBaselineAct - refBaselineAct)),
    },
    knownMismatch: {
      description: 'Subarctic woodland 64.5 deg N on Day 172 (June 21) at dusk hour 21.8: main.ts sunTimes(172) [omits siteLat, uses 49.5 deg N] and sim/index.ts hardcoded {sunrise: 6, sunset: 18} vs sunTimes(172, 64.5)',
      gameMainSunsetHour: round4(gameMainSummerSubarctic.sunset),
      gameSimSunsetHour: gameSimHardcoded.sunset,
      refSunsetHour: round4(refSummerSubarctic.sunset),
      knownMismatchErrorHours,
      simHardcodedMismatchHours,
      gameMainActivityAt21_8: round4(gameMainSummerDuskAct),
      refActivityAt21_8: round4(refSummerDuskAct),
      knownMismatchActivityError: round4(Math.abs(gameMainSummerDuskAct - refSummerDuskAct)),
    },
  },
  cases: {
    case0_subarcticSummerDusk_64_5N_day172_hour21_8: {
      latitudeDeg: latSubarctic,
      dayOfYear: daySummer,
      hour: hourSummerDusk,
      skySunElevationDeg: round4(sunPosition(hourSummerDusk, daySummer, latSubarctic).elevation),
      refSunriseHour: round4(refSummerSubarctic.sunrise),
      refSunsetHour: round4(refSummerSubarctic.sunset),
      refDayLengthHours: round4(refSummerSubarctic.sunset - refSummerSubarctic.sunrise),
      gameMainSunriseHour: round4(gameMainSummerSubarctic.sunrise),
      gameMainSunsetHour: round4(gameMainSummerSubarctic.sunset),
      gameMainDayLengthHours: round4(gameMainSummerSubarctic.sunset - gameMainSummerSubarctic.sunrise),
      sunsetErrorHours: round4(gameMainSummerSubarctic.sunset - refSummerSubarctic.sunset),
      dayLengthErrorHours: round4((gameMainSummerSubarctic.sunset - gameMainSummerSubarctic.sunrise) - (refSummerSubarctic.sunset - refSummerSubarctic.sunrise)),
      refActivity: round4(refSummerDuskAct),
      gameMainActivity: round4(gameMainSummerDuskAct),
      refGoal: refSummerDuskChoice.goal,
      gameMainGoal: gameMainSummerDuskChoice.goal,
      gameMainWhy: gameMainSummerDuskChoice.why,
      resemblesNature: false,
    },
    case1_subarcticWinterNight_64_5N_day355_hour8_0: {
      latitudeDeg: latSubarctic,
      dayOfYear: dayWinter,
      hour: hourWinterNight,
      skySunElevationDeg: round4(sunPosition(hourWinterNight, dayWinter, latSubarctic).elevation),
      refSunriseHour: round4(refWinterSubarctic.sunrise),
      refSunsetHour: round4(refWinterSubarctic.sunset),
      refDayLengthHours: round4(refWinterSubarctic.sunset - refWinterSubarctic.sunrise),
      gameMainSunriseHour: round4(gameMainWinterSubarctic.sunrise),
      gameMainSunsetHour: round4(gameMainWinterSubarctic.sunset),
      gameMainDayLengthHours: round4(gameMainWinterSubarctic.sunset - gameMainWinterSubarctic.sunrise),
      sunriseErrorHours: round4(gameMainWinterSubarctic.sunrise - refWinterSubarctic.sunrise),
      dayLengthErrorHours: round4((gameMainWinterSubarctic.sunset - gameMainWinterSubarctic.sunrise) - (refWinterSubarctic.sunset - refWinterSubarctic.sunrise)),
      refActivity: round4(refWinterNightAct),
      gameMainActivity: round4(gameMainWinterNightAct),
      refGoal: refWinterNightChoice.goal,
      gameMainGoal: gameMainWinterNightChoice.goal,
      gameMainWhy: gameMainWinterNightChoice.why,
      resemblesNature: false,
    },
    case2_simPredatorSummerDawn_49_5N_day172_hour4_2: {
      latitudeDeg: LATITUDE,
      dayOfYear: daySummer,
      hour: hourSummerDawnHome,
      skySunElevationDeg: round4(sunPosition(hourSummerDawnHome, daySummer, LATITUDE).elevation),
      refSunriseHour: round4(refHomeSummer.sunrise),
      refSunsetHour: round4(refHomeSummer.sunset),
      gameSimHardcodedSunriseHour: gameSimHardcoded.sunrise,
      gameSimHardcodedSunsetHour: gameSimHardcoded.sunset,
      sunriseErrorHours: round4(gameSimHardcoded.sunrise - refHomeSummer.sunrise),
      sunsetErrorHours: round4(gameSimHardcoded.sunset - refHomeSummer.sunset),
      refGoal: refHomeDawnChoice.goal,
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
