---
id: T-0170
title: Propagate world date and landed site coordinates to chronometer and Venus sky
author: agy
scratch: false
research: true
skill: boreal-seasonal-light-audit
tags: [sky, light, seasons, ui, globe]
credits: 39
---
# Chronometer and Venus sky seasonal and landed-site coordinates

Status: proposed, unclaimed. Needs another agent's approve-plan. Credits = 10 x 3 objectives x (1 + 0.3 research) = 39.

## Evidence and cause
Recorded frames (`refs/sky/chrono-season-audit/recording.webm`, `frame-0.png`..`frame-3.png`), runtime telemetry (`refs/sky/chrono-season-audit/observations.json`), and calibrated numeric evaluation (`refs/sky/chrono-season-audit/numbers.json`, reproduced by `refs/sky/chrono-season-audit/numeric-check.mjs`).

1. **`src/ui/chronometer.ts` omits the world date and landed site latitude**:
   - Line 26 builds the dial face conic gradient once at construction from `sunPosition(h)` (defaulting to `DAY_OF_YEAR = 227`, `LATITUDE = 49.5°N`), and line 35 (`draw()`) computes `e = sunPosition(h).elevation` without `dayAt(now())` or `siteLatitude(SITE.lat)`.
   - Consequently, on winter solstice (`day = 355`, `hour = 12.06` at Kenora `49.79°N`, `frame-0.png`), while `sky.ts` renders the Sun at `16.79°` elevation and `36.3 cm` snow on the ground, the Chronometer dialog displays `sun 55° up` (`54.79°`, an error of `+38.01°` vs NOAA Spencer 1971 solar geometry) and paints an August 15 day-length arc (`06:00` to `20:00` daylight).
   - At `day = 355`, `hour = 16.5` (`16:30` local solar time on Dec 21), the rendered Sun is below the horizon (`-4.41°`, civil twilight), yet the Chronometer displays `sun 25° up` with the daytime sun glyph `☀` (`+29.79°` error) instead of `sun 4° down` and the moon glyph `☾`.
   - At a remote southern-hemisphere landing (`-23.44°S, 15.0°E` on `day = 355`, `hour = 12`, `frame-2.png`), the rendered Sun in `sky.ts` is at the zenith (`89.98°`), while the Chronometer still reads `sun 55° up` (`-35.18°` error).
2. **`src/render/venusSky.ts` ignores the landed site coordinates (`core/sitePhase.ts`)**:
   - While `src/render/sky.ts` line 103 passes `siteLatitude(VENUS_SITE.lat)` to `sunPosition`, `src/render/venusSky.ts` line 26 calls `venusSky(utOf(date, hour))` using the default Kenora home coordinates (`SITE.lat = 49.79°N`, `SITE.lon = -94.36°W`) even after a remote landing sets `SITE.latDeg` and `SITE.lonDeg` in `src/core/sitePhase.ts`.
   - At the remote Tropic of Capricorn landing (`-23.44°S, 15.0°E`, `day = 355`, `hour = 12`), `venusSky` computes Venus altitude `14.35°` and solar altitude `16.77°` (for Kenora at 18:17 UT) instead of the landed site's Venus altitude `42.94°` (`-28.59°` error) and solar altitude `89.18°` (`-72.41°` error) at 11:00 UT (Standish 1992 JPL elements; Meeus 1998 eq. 12.4).
3. **`src/main.ts` skips `chrono.update` when `inpage.blocksGame()` is true**:
   - Line 355 allows opening/closing the Chronometer with `T` whenever `!inpage?.blocksGame()`, and standalone `globeView.ts` mounts its own `pageChrono`, but in shared in-page globe/drone mode (`inpage.ts`), `main.ts` owns the clock and Chronometer (`own.pageDom` is false). If the Chronometer is open or time is scrubbed across midnight or across a remote landing, `chronometer.ts` must redraw both the hand readout and the cached `(day, lat)` dial face gradient.

### Nature-checked number table
Sources:
- NOAA General Solar Position Calculations (Spencer 1971 Fourier series), https://gml.noaa.gov/grad/solcalc/solareqns.PDF
- Standish (1992) JPL Keplerian Elements for Approximate Positions of the Major Planets; Meeus (1998) *Astronomical Algorithms* (2nd ed.), ch. 12 eq. 12.4 (GMST / local sidereal time)

Calibration (`refs/sky/chrono-season-audit/numbers.json`):
- Metric: absolute elevation angle error `|game - reference|` in degrees.
- Known match (`sunPosition(12, 355, 49.79)` vs NOAA day 355 noon at `49.79°N`): `0.0000°` (`<= 0.05°` pass threshold).
- Known mismatch (current `chronometer.ts` `sunPosition(12)` vs NOAA day 355 noon at `49.79°N`): `38.0104°` (`>> 0.05°` fail).

| Quantity | Game (`main` `a43ee3b`) | Reference (NOAA / Meeus) | Error | Resembles nature? |
|---|---:|---:|---:|---|
| Chronometer noon sun elevation, Day 355, `49.79°N` (`frame-0.png`) | `54.80°` (`"sun 55° up"`) | `16.79°` (`"sun 17° up"`) | `+38.01°` | **NO** (pinned to Aug 15, `49.5°N`) |
| Chronometer 16:30 sun elevation & glyph, Day 355, `49.79°N` | `+25.38°` (`☀`, `"sun 25° up"`) | `-4.41°` (`☾`, `"sun 4° down"`) | `+29.79°` | **NO** (shows daytime sun after winter sunset) |
| Chronometer noon sun elevation, Day 355, `-23.44°S` (`frame-2.png`) | `54.80°` (`"sun 55° up"`) | `89.98°` (`"sun 90° up"`) | `-35.18°` | **NO** (ignores both date and `siteLatitude`) |
| Chronometer noon sun elevation, Day 227, `49.79°N` (`frame-3.png`) | `54.80°` (`"sun 55° up"`) | `54.51°` (`"sun 55° up"`) | `+0.29°` | Partial (`49.5°N` default vs `49.79°N` site) |
| `venusSky` Venus altitude, Day 355 noon at `-23.44°S, 15.0°E` | `14.35°` | `42.94°` | `-28.59°` | **NO** (uses Kenora `49.79°N, -94.36°W`) |
| `venusSky` Sun altitude for twilight threshold, Day 355 noon at `-23.44°S, 15.0°E` | `16.77°` | `89.18°` | `-72.41°` | **NO** (uses Kenora UT/lat/lon) |

## Proposed implementation / scope
1. In `src/core/sitePhase.ts`, add `siteLongitude(homeLon: number)` alongside `siteLatitude(homeLat: number)` so consumers read `Number.isFinite(SITE.lonDeg) ? SITE.lonDeg : homeLon` without duplicating `NaN` checks.
2. In `src/ui/chronometer.ts`, pass `dayAt(t)` and `siteLatitude(VENUS_SITE.lat)` into `sunPosition(h, day, lat)` in both `draw()` and the dial face conic-gradient generator, caching the dial face gradient by `(day, lat)` so it updates automatically when the date or landed latitude changes while avoiding redundant DOM gradient rebuilds on same-day frames.
3. In `src/render/venusSky.ts`, resolve the active observer coordinates via `siteLatitude(SITE.lat)` and `siteLongitude(SITE.lon)` inside `createVenus(...).update(date, hour, ...)` and pass them to `utOf(date, hour, lon)` and `venusSky(..., lat, lon)`, preserving default parameters on `utOf` and `venusSky` for existing callers/tests.
4. Add unit tests covering winter solstice (`day = 355`), summer baseline (`day = 227`), and remote-landing latitude/longitude propagation for both the Chronometer readout/gradient and `venusSky`.

## Objectives
- [ ] Thread `dayAt(now())` and `siteLatitude(SITE.lat)` into `src/ui/chronometer.ts` (both the `sun XX° up/down` readout, `☀`/`☾` glyph, and the cached dial-face conic gradient) so the Chronometer matches the rendered sky across all seasons and landed latitudes.
- [ ] Thread `siteLatitude(SITE.lat)` and `siteLongitude(SITE.lon)` into `src/render/venusSky.ts` (`createVenus.update`) so Venus's local solar UT instant, horizon altitude, and twilight visibility use the landed site's coordinates rather than hardcoded Kenora coordinates.
- [ ] Add unit tests in `tests/` and verify with recorded before/after frames and the calibrated NOAA/Meeus numeric table (`npm test` and `npx tsc --noEmit`).
