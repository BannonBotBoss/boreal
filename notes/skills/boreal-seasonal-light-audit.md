# Skill: audit and wire seasonal date and landed-site coordinates across sky, UI and planetary helpers

Use when inspecting or fixing solar elevation, day-length arcs, twilight thresholds, planetary positions (`venusSky`), or circadian readouts (`chronometer`) so every consumer agrees with the simulation date and the landed globe site (`core/sitePhase`).

## Files
- `src/core/worldClock.ts`: single monotonic simulation clock (`worldSec()`).
- `src/core/timeOfDay.ts`: `dayAt(sec)`, `hourAt(sec)`, `clockDate(sec)`, `sunPosition(hour, dayOfYear, latitude)`, `lighting(elevation)`.
- `src/core/sitePhase.ts`: landed globe site state (`SITE`, `siteLatitude(homeLat)`, `siteLongitude(homeLon)`, `setSite`, `clearSite`).
- `src/core/weather.ts`: home station coordinates (`SITE.lat = 49.79`, `SITE.lon = -94.36`, `SITE.tz = -6`) and `solar()`.
- `src/render/sky.ts`: ground-view sky consumer (`sunPosition(hour, dayAt(time), siteLatitude(VENUS_SITE.lat))`).
- `src/render/venusSky.ts`: ground-view Venus point light (`utOf(date, hour, lon)`, `venusSky(t, lat, lon)`, `siteVenusSky(date, hour)`).
- `src/ui/chronometer.ts`: interactive 24-hour Chronometer dialog (`chronoSunState`, `dialGradient`, `createChronometer`).

## Steps
1. **Trace clock and coordinate conventions first**:
   - `timeOfDay.sunPosition(hour, day, lat)` takes **local solar hour** (`12` = local solar noon), 1-based `dayOfYear`, and observer latitude in degrees. Omitting `day` or `lat` silently pins a live consumer to `DAY_OF_YEAR = 227` (Aug 15) and `LATITUDE = 49.5°N`.
   - `weather.solar(day, localHour, lat, lon, tz)` takes **civil clock hour** with longitude and timezone offset. Never mix civil-hour and local-solar-hour formulas in one comparison table without converting explicitly.
   - `venusSky` converts local solar `hour` on `date` to UT via `utOf(date, hour, lon)` (`UT = hour - lon / 15`), then evaluates topocentric horizon coordinates (`altAz(ra, dec, t, lat, lon)`). Both `utOf` and `altAz` must receive `siteLongitude(SITE.lon)` and `siteLatitude(SITE.lat)` so a remote globe landing (`setSite`) does not evaluate Kenora's UT instant or horizon.
2. **Cache DOM gradients by `(Math.floor(day), lat.toFixed(4))`**:
   - Rebuilding a 25-stop `conic-gradient` string in `chronometer.ts` every animation frame wastes DOM style parsing when neither the date nor the landed site changed, whereas building it only once at construction freezes the dial face to August 15. Cache by `(Math.floor(day), lat.toFixed(4))` inside `draw()` so midnight rollover, `?day=` / `?date=`, and remote globe landings update immediately with zero per-frame churn.
3. **Verify numerically against independent published equations (Rule 11)**:
   - Solar elevation: compare `chronoSunState` / `sunPosition` against NOAA General Solar Position Calculations (Spencer 1971 Fourier declination series, `https://gml.noaa.gov/grad/solcalc/solareqns.PDF`). Calibrate the script with a known match (`<= 0.05°`) and the pre-fix undated/home-pinned mismatch (`> 25°`).
   - Planetary topocentric altitude: compare `siteVenusSky(date, hour)` against Standish (1992) JPL Keplerian elements + Meeus (1998) *Astronomical Algorithms* eq. 12.4 GMST/LST at both home (`clearSite()`) and a remote southern-hemisphere landing (`setSite({ latDeg: -23.44, lonDeg: 15.0, ... })`).
4. **Capture live browser frames and canvas recording**:
   - Launch headless Edge on an isolated `--user-data-dir` inside the worktree against an agent preview port (`5250–5269`), never killing port `5173`. Always terminate only the spawned Edge PID in `finally`.
   - Note that `canvas.captureStream` records WebGL sky/ground while `Page.captureScreenshot` captures both WebGL and HTML HUD dialogs (`.chronometer`). Archive `recording.webm`, `frame-*.png`, `observations.json`, and `numbers.json`.

## Checks that proved it worked
- `npx tsc --noEmit` and `npx tsx --test tests/chronometer.test.ts tests/planets.test.ts tests/chronometer-venus-site.test.ts tests/rules.test.ts`.
- Calibrated numeric check (`refs/sky/chrono-season-fix/numeric-check.mjs`): `<= 0.03°` solar error vs independent NOAA Spencer (1971) across winter solstice noon (`16.79°`), winter post-sunset `16:30` (`-4.40°`, `☾`), remote `-23.44°S` noon (`89.96°`), and Aug 15 baseline (`54.51°`), and `0.0000°` Venus/Sun topocentric error at `-23.44°S, 15.0°E`.

## Mistakes to avoid
- Calling `sunPosition(h)` with 1 argument in UI or lighting code (silently pins to Aug 15, `49.5°N`).
- Passing `siteLatitude(SITE.lat)` to `venusSky` while forgetting `siteLongitude(SITE.lon)` in `utOf(date, hour, lon)` (shifts UT by `(lon - (-94.36)) / 15` hours, corrupting both GMST and twilight sun altitude).
- Mutating `SITE` in unit tests without calling `clearSite()` in `try / finally`.
