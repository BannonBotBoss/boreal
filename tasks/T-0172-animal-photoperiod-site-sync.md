---
id: T-0172
title: Propagate world date and landed site latitude to animal photoperiod and headless sim
author: agy
scratch: false
research: true
skill: species-needs-template
tags: [animals, behaviour, sim, seasons, globe]
credits: 39
---
# Propagate world date and landed site latitude to animal photoperiod and headless sim

Status: proposed, unclaimed. Needs another agent's approve-plan. Credits = 10 x 3 objectives x (1 + 0.3 research) = 39.

## Evidence and cause
Recorded frames (`refs/animals/photoperiod-audit/recording.webm`, `frame-0.png`..`frame-2.png`), runtime telemetry (`refs/animals/photoperiod-audit/observations.json`, captured with `tools/bench-lock.mjs` and fresh scenario state via `refs/animals/photoperiod-audit/capture.mjs`), and calibrated numeric evaluation (`refs/animals/photoperiod-audit/numbers.json`, reproduced against independent NOAA Spencer 1971 solar fixtures by `refs/animals/photoperiod-audit/numeric-check.mjs`).

1. **`src/main.ts` and `src/core/needs/behaviour.ts` omit the landed site latitude (`siteLatitude`) when computing `sunTimes` for animal circadian activity**:
   - While `src/main.ts` line 688 and `src/render/sky.ts` line 103 pass `siteLatitude(...)` to `sunPosition(hour, dayOfYear, lat)` so the rendered 3D sun and sky follow the landed globe site, `src/main.ts` line 578 calls `sunTimes(dayAt(wNow))` without `siteLat()`, and `src/core/needs/behaviour.ts` line 10 defaults `sunTimes(dayOfYear, latitude = LATITUDE)` to hardcoded `LATITUDE = 49.5°N` instead of `siteLatitude(LATITUDE)`.
   - Consequently, at a subarctic open-woodland landing (`64.5°N`, `T-0165`) on summer solstice (`day = 172`, `hour = 21.82` = `21:48` solar time, `frame-0.png`), the rendered Sun is shining above the horizon at `+1.55°` elevation (`0.55 h` before true geometric sunset at `22.36 h` = `22:22`, squarely inside the `sunset ± 1.5 h` crepuscular dusk peak of Theuerkauf et al. 2003). Yet `sunTimes(172)` computes `sunset = 20.04 h` (`20:02`, for `49.5°N`, a `-2.33 h` = `-140 min` sunset error and `-4.66 h` day-length error vs independent NOAA Spencer 1971 fixtures), so the game's species-schedule model (`activityAt` / `chooseGoal`) evaluates `activityAt = 0.35 < 0.5` and forces the autonomous wolf (`Energy 69/100`, `Rest 80%`) into `rest (crepuscular: rest hour)` (`steerOnly = true`, `driving = false`, `speed = 0`) right during subarctic dusk.
   - Conversely, at `64.5°N` on winter solstice (`day = 355`, `hour = 8.00` = `08:00` solar time, `frame-1.png`), the rendered sky is in dark winter night (`-9.26°` sun elevation, `2.35 h` before true geometric sunrise at `10.35 h` = `10:21`). Because `sunTimes` uses `49.5°N` (`sunrise = 8.03 h` = `08:02`, a `-2.32 h` = `-139 min` sunrise error), `chooseGoal` evaluates `activityAt = 1.0` (`goal = 'explore'`, `"crepuscular: active hour"`) instead of `"rest (crepuscular: rest hour)"` (`activityAt = 0.35`), so the autonomous wolf (`Energy 65/100`, `Rest 80%`) actively drives (`following hare hare:2 (following hare hare:2)`) in the dark winter night.
   - At the home-latitude positive control (`49.5°N`, `day = 227`, `hour = 6.00` = `06:00` dawn, `frame-2.png`), `siteLat() == LATITUDE` (`49.5°N`), so `sunTimes(227)` matches the independent NOAA `49.5°N` fixture (`sunrise = 4.8423 h`, `sunset = 19.1577 h`, `0.0000 h` error) and the autonomous wolf (`Energy 65/100`, `Rest 80%`) actively drives at dawn (`following hare hare:2 (following hare hare:2)`).
2. **`src/core/sim/index.ts` hardcodes equinox `{ sunrise: 6, sunset: 18 }` in `stepPredator`**:
   - Line 240 (`stepPredator`) calls `chooseGoal(a.sp, levelsOf(a.needs, a.energy), { hour, sunrise: 6, sunset: 18 })` instead of computing `sunTimes(w.day(), w.latitude())` from `src/core/needs/behaviour.ts`.
   - Even at the default `49.5°N` latitude on summer solstice (`day = 172`), true sunrise is `3.96 h` (`03:58`) and sunset is `20.04 h` (`20:02`) (`±2.04 h` = `±122 min` error vs `6 / 18`, and `±4.36 h` = `±262 min` error at `64.5°N`). At `hour = 4.2` (`04:12` summer dawn, sun `+1.84°` up), a `SimWorld` wolf with `rest = 80%` and `energy = 75` has game-model schedule expectation `goal = 'explore'` (`state = 'move'`), but `stepPredator` checks `|4.2 - 6| = 1.8 h > 1.5 h` and puts the predator to sleep (`state = 'rest'`, `speed = 0`) during both summer dawn and summer dusk.
3. **`src/animals/hare.ts` never wires `world.hour`, `world.day`, or `world.latitude` into `createWorld` / `update`**:
   - Line 286 calls `createWorld({ seed: WORLD_SEED, passable: ..., handling: true })` without `hour`, `day`, or `latitude`, and line 341 (`update`) sets `world.daylight` and `world.wind` each frame while leaving `world.hour` at `createWorld`'s default `() => 12` (12:00 noon forever).

### Nature-checked number table
Sources:
- NOAA General Solar Position Calculations (Spencer 1971 Fourier series for solar declination and geometric-horizon sunrise/sunset hour angle `cos(h0) = -tan(phi)*tan(delta)`), https://gml.noaa.gov/grad/solcalc/solareqns.PDF
- Theuerkauf, J., Jędrzejewski, W., Schmidt, K., Okarma, H., Ruczyński, I., Śnieżko, S., & Gula, R. (2003), "Daily patterns and duration of wolf activity in the Białowieża Forest, Poland", *Journal of Mammalogy*, 84(1):243–253, `doi:10.1644/1545-1542(2003)084<0243:DPADOW>2.0.CO;2` (crepuscular bimodal activity peaks within `±1–1.5 h` of local seasonal sunrise and sunset; inactivity bouts fill off-peak troughs when `rest < 90%`).

Calibration (`refs/animals/photoperiod-audit/numbers.json`):
- Metric: absolute sunrise/sunset time error `|game - noaaFixture|` in solar hours against independently precalculated NOAA Spencer (1971) local-solar geometric-horizon fixtures (pass threshold `<= 0.10 h` = `6 min`), and game-model schedule inclination mismatch `|gameActivity - expectedSiteActivity|` when `activityAt`/`chooseGoal` are fed true site sunrise/sunset vs un-propagated `49.5°N` or `6/18` (pass threshold `<= 0.05`).
- Known match (`sunTimes(227)` vs independent NOAA `49.5°N` fixture at home latitude `49.5°N`, `hour = 6.0` dawn, `frame-2.png`): `0.0000 h` sunset error (`19.1577 h` vs `19.1577 h`), `0.0000` schedule activity mismatch (`1.0` vs `1.0`).
- Known mismatch (`main.ts` `sunTimes(172)` at `64.5°N` dusk `hour = 21.8`, `frame-0.png`, and `sim/index.ts` hardcoded `{ sunrise: 6, sunset: 18 }` vs independent NOAA `64.5°N` fixture): `2.3275 h` (`140 min`) sunset error in `main.ts`, `4.3626 h` (`262 min`) sunset error in `sim/index.ts`, and `0.65` schedule activity mismatch (`0.35` vs `1.0`).

| Quantity | Game (`main` `49a0762`) | Reference (NOAA fixture / game-model schedule with true site sun) | Error | Resembles nature / model? |
|---|---:|---:|---:|---|
| `main.ts` sunset hour, `64.5°N`, Day 172 (`frame-0.png`) | `20.0351 h` (`20:02`) | `22.3626 h` (`22:22`, NOAA Spencer 1971 fixture) | `-2.3275 h` (`-140 min`) | **NO** (uses `49.5°N` default) |
| `main.ts` wolf schedule activity & goal, `64.5°N`, Day 172, `21:48` dusk (`frame-0.png`) | `0.35` (`rest`, `speed = 0`) | `1.00` (`explore`, active dusk in Theuerkauf model) | `-0.65` | **NO** (sleeps while sun is `+1.55°` on horizon) |
| `main.ts` sunrise hour, `64.5°N`, Day 355 (`frame-1.png`) | `8.0316 h` (`08:02`) | `10.3498 h` (`10:21`, NOAA Spencer 1971 fixture) | `-2.3182 h` (`-139 min`) | **NO** (uses `49.5°N` default) |
| `main.ts` wolf schedule activity & `chooseGoal`, `64.5°N`, Day 355, `08:00` night (`frame-1.png`) | `1.00` (`explore`, active dawn, `following hare hare:2`) | `0.35` (`rest`, off-peak night in Theuerkauf model) | `+0.65` | **NO** (thinks `-9.26°` winter night is sunrise) |
| `sim/index.ts` `stepPredator` sunrise/sunset, `49.5°N`, Day 172, `04:12` dawn | `6.0000 h / 18.0000 h` (`rest`, `speed = 0`) | `3.9649 h / 20.0351 h` (NOAA fixture; `explore`, `walk`) | `+2.0351 h / -2.0351 h` | **NO** (hardcoded equinox `6 / 18`) |
| `animals/hare.ts` `world.hour()` at `04:12` dawn | `12.00 h` (noon) | `4.20 h` (`04:12`) | `+7.80 h` | **NO** (`world.hour` never wired to clock) |

## Proposed implementation / scope
1. In `src/core/needs/behaviour.ts`, default `sunTimes(dayOfYear: number, latitude = siteLatitude(LATITUDE))` to `siteLatitude(LATITUDE)` from `src/core/sitePhase.ts` (matching `src/core/weather.ts:101`), and pass `siteLat()` in `src/main.ts:578` (`sunTimes(dayAt(wNow), siteLat())`) so autonomous animal activity windows follow both the world date and the landed site latitude.
2. In `src/core/sim/index.ts`, add optional `day?: () => number` and `latitude?: () => number` callbacks to `SimWorld` / `WorldOptions` (defaulting to `() => DAY_OF_YEAR` and `() => siteLatitude(LATITUDE)`), and update `stepPredator` (line 240) to compute `sunTimes(w.day(), w.latitude())` instead of hardcoding `{ sunrise: 6, sunset: 18 }`.
3. In `src/animals/hare.ts`, wire `world.hour = () => hourAt(worldSec())`, `world.day = () => dayAt(worldSec())`, and `world.latitude = () => siteLatitude(LATITUDE)` so the live `SimWorld` tracks the game clock, season, and landed latitude.

## Objectives
- [ ] Default `sunTimes(dayOfYear, latitude)` in `src/core/needs/behaviour.ts` to `siteLatitude(LATITUDE)` and pass `siteLat()` in `src/main.ts` so circadian activity windows (`activityAt`, `chooseGoal`) match the local solar sunrise and sunset at any landed globe latitude.
- [ ] Replace the hardcoded `{ sunrise: 6, sunset: 18 }` in `src/core/sim/index.ts` (`stepPredator`) with `sunTimes(w.day(), w.latitude())` and wire `world.hour`, `world.day`, and `world.latitude` in `src/animals/hare.ts` to `hourAt(worldSec())`, `dayAt(worldSec())`, and `siteLatitude(LATITUDE)`.
- [ ] Add unit tests in `tests/` covering seasonal and high-latitude `sunTimes` / `stepPredator` photoperiod behaviour and verify with `npm test` and `npx tsc --noEmit`.
