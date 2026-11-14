---
id: T-0226
title: Synchronize seasonal tree/flora phenology, multi-year rollover, midwinter snow burial, and Southern Hemisphere phase
author: agy
scratch: false
research: true
skill: flora-seasonal-phenology
tags: [flora, trees, seasons, snow, fields]
credits: 52
---
# Seasonal tree/flora phenology, multi-year rollover, midwinter snow burial, and Southern Hemisphere phase

Status: proposed, unclaimed. Needs another agent's approve-plan. Credits = 10 x 4 objectives x (1 + 0.3 research) = 52.

## Evidence and cause
Recorded frames (`refs/flora/seasonal-phenology-audit/recording.webm`, `frame-0.png`..`frame-3.png`), live runtime telemetry (`refs/flora/seasonal-phenology-audit/observations.json`), and calibrated numeric evaluation (`refs/flora/seasonal-phenology-audit/numbers.json`, reproduced by `refs/flora/seasonal-phenology-audit/numeric-check.mjs`).

While `timeOfDay.ts` (`sunPosition`), `planetWeather.ts` (`openForestPlanet`), and `pbr.ts` (`steppeCure` line 32) treat `dayAt(worldSec)` as an unbounded multi-year counter and `planetWeather.ts` resolves Southern Hemisphere thermal seasons (`+12.25 °C` at `-45.0°S, -71.5°W` on Jan 15, `frame-3.png`), four plant/vegetation consumers break across year boundaries, midwinter snowpack, and Southern Hemisphere sites (note: interactive ground props are covered separately by `T-0050` and excluded here):

1. **Year-2+ and prior-year rollover strips midsummer deciduous canopies bare and kills summer bloom (`src/core/treeSpecies.ts`, `src/render/flora/flora.ts`)**:
   - `dayAt(worldSec)` (`src/core/timeOfDay.ts:29`) advances monotonically past `365` in Year 2 (`day = 592 = 227 + 365` on Year-2 August 15) and below `1` when rewinding (`day = -138` on prior-year August 15).
   - `phenology(day)` (`src/core/treeSpecies.ts:95-98`) evaluates raw un-wrapped `day`: `phenology(592)` returns `{ colour: 1, off: 1 }` and `phenology(-138)` returns `{ colour: 0, off: 1 }`, while `flora.ts:92` tests raw `uDay < aBloom.x || uDay > aBloom.y` (`uDay = 592`).
   - Comparing `frame-0.png` (`day = 227`, Year-1 Aug 15, `+23.95 °C`, `52.4°` sun) against `frame-1.png` (`day = 592`, Year-2 Aug 15 at the exact same forest clearing `(-1144.1, -948.5)`, `+23.96 °C`, `52.71°` sun): every paper birch and trembling aspen crown strips `100%` bare to white sticks, ground bunchberry/bluebead foliage turns crimson autumn red (`uColour = 1`), and `0 / 2` August-blooming species flower (`compositeScore = 0.0000`).
2. **Midwinter understory keeps `100%` summer-green deciduous leaves and ignores snowpack burial (`src/render/trees.ts`, `src/render/flora/flora.ts`)**:
   - `WIND_UNIFORMS` (`src/render/trees.ts:48`) exports `uColour` (`leafColour`) and omits `uOff` (`leafOff`, `windUniformHasOff = false` in `observations.json`).
   - On `day = 15` (Jan 15 at `49.5°N`, `-19.02 °C`), `phenology(15)` returns `{ colour: 0, off: 1 }`. Because `floraMaterial` (`src/render/flora/flora.ts:86-99`) reads only `uColour` (`0.0`) and never reads `uOff` or `uSnowM` (unlike `grass.ts:74`), all `10` non-evergreen `FLORA` species retain `100%` of their summer leaf geometry in bright summer chlorophyll green (`frame-2.png` foreground bunchberry/bluebead clumps beside white snow-covered grass!) and `0 / 4` subnivean species shorter than climatological snow depth (`0.276 m` at `69 mm` SWE: `twinflower 0.08 m`, `strawberry 0.10 m`, `bunchberry 0.14 m`, `blueberry 0.25 m`) are buried under snowpack (`compositeScore = 0.0023`).
3. **Southern Hemisphere summer renders winter-bare deciduous trees and zero summer flowers (`src/core/treeSpecies.ts`, `src/render/flora/flora.ts`, `src/render/pbr.ts`)**:
   - At `-45.0°S, -71.5°W` on `day = 15` (Jan 15 austral midsummer, `sun = 62.95°`, `planet` air `+12.25 °C`, `frame-3.png`), `phenology(15)` ignores `siteLatitude` (`off = 1`), stripping every paper birch and trembling aspen crown completely bare under a `63°` summer sun while `uDay = 15` suppresses all `3` midsummer-equivalent blooming species and `steppeCure(day)` cures grass in austral summer instead of austral winter (`compositeScore = 0.3866`).
4. **`src/core/fields.ts` `daylightFraction`, `sunTable`, and `sunSeconds` ignore `DAY.dayOffset` and `siteLatitude` (`lines 101–145`)**:
   - `sunSeconds` (`fields.ts:138`) computes `g(w) = (START_HOUR + DAY.offset) * REAL_SECONDS_PER_GAME_HOUR + w` without `DAY.dayOffset * DAY_S`. When the world date is set to midwinter (`setDay(15)`, `-19.02 °C`, `frame-2.png`), `sunSeconds` still integrates August `day = 227` (`6,212.0` sun-weighted seconds/day instead of `0.0`!). Meanwhile `daylightFraction(15)` hardcodes `49.5°N` (`0.3380` vs `0.6187` at `-45°S` Jan 15) and `sunTable` hardcodes Northern Hemisphere `49.5°N` Kenora `climate(doy, h)`.

### Nature-checked number table
Sources:
- Burns & Honkala (1990), *Silvics of North America* Vol. 2 (USDA Forest Service Agric. Handb. 654: *Populus tremuloides*, *Betula papyrifera*) & Environment Canada *PlantWatch*: NW Ontario deciduous leaf-out DOY `135–150`, fall colour DOY `255–278`, leaf-off DOY `278–290`, strictly `365`-day periodic across consecutive years.
- Raunkiaer (1934), *The Life Forms of Plants and Statistical Plant Geography* & Baldwin & Sims (1997), *Field Guide to the Common Forest Plants in Northwestern Ontario*: boreal perennial herbs (hemicryptophytes/geophytes) and deciduous shrubs shed/senesce green foliage before midwinter (`0%` summer-green deciduous leaves in January).
- Sturm et al. (2010), *J. Hydrometeorol.* 11:1380–1394: taiga snowpack (`0.276 m` at `69 mm` SWE, `250 kg/m³`) buries subnivean flora whose canopy height `h <= snowDepthM`.
- NOAA *General Solar Position Calculations* (Spencer 1971) & Frame & Newbould (1986), *Adv. Agron.* 40:1–88: Southern Hemisphere temperate midsummer (`45°S`, Jan 15 = seasonal equivalent DOY `197`) has `~15.4 h` photoperiod (`daylightFraction = 0.6187`), full deciduous leaf retention (`1.0`), and zero *Trifolium repens* growth below `tBase = 5 °C` in `-19 °C` boreal January.

Calibration (`refs/flora/seasonal-phenology-audit/numbers.json`):
- Metric: `unitScore = max(0, 1 - |game - ref| / scale)` averaged across canopy/flora leaf retention, colour/senescence, bloom/burial count, and photoperiod/growth (`>= 0.95` pass).
- Known match (Home `49.5°N`, Year-1 Aug 15 `day = 227`): `compositeScore = 1.0000` (`>= 0.95` pass).
- Known mismatch (winter bare state evaluated against midsummer reference): `compositeScore = 0.1617` (`< 0.70` fail).

| Quantity | Game (`main` `d06aa4b`) | Reference (Burns & Honkala / Raunkiaer / Sturm / NOAA) | Score / Error | Resembles nature? |
|---|---:|---:|---:|---|
| Year-2 Aug 15 (`day = 592`, `+23.96 °C`, `frame-1.png`) birch/aspen leaf retention & Aug bloomers | `0.00` retention (`off = 1, colour = 1`), `0` bloomers | `1.00` retention (`off = 0, colour = 0`), `2` bloomers | `compositeScore = 0.0000` | **NO** (100% winter-bare canopy & red herbs in +24 °C August) |
| Midwinter Jan 15 (`day = 15`, `-19.02 °C`, `frame-2.png`) deciduous understory summer-green leaf share | `1.00` (`10/10` species green, `uOff` missing) | `0.00` (senesced/shed before winter) | `unitScore = 0.0000` | **NO** (bright summer-green bunchberry/bluebead at -19 °C) |
| Midwinter Jan 15 (`0.276 m` snow at `69 mm` SWE) subnivean species buried (`h <= 0.276 m`) | `0 / 4` species (`uSnowM` ignored in `flora.ts`) | `4 / 4` species (`twinflower`, `strawberry`, `bunchberry`, `blueberry`) | `unitScore = 0.0000` | **NO** (`8–25 cm` herbs protrude unburied above snow logic) |
| Midwinter `setDay(15)` (`-19.02 °C`) `fields.ts` `sunSeconds` clover growth integral | `6,155.3 s/day` (reads Aug `day = 227`) | `0.0 s/day` (`-19 °C < 5 °C` `tBase`) | `unitScore = 0.009` | **NO** (`DAY.dayOffset` omitted in `sunSeconds`) |
| Austral midsummer Jan 15 (`-45°S`, `+12.25 °C`, `62.95°` sun, `frame-3.png`) tree leaf retention & bloomers | `0.00` retention (`off = 1`), `0` bloomers | `1.00` retention (`doy_eq = 197`), `3` bloomers | `unitScore = 0.0000` | **NO** (bare winter trees & 0 flowers in midsummer) |
| Austral midsummer Jan 15 (`-45°S`) `fields.ts` `daylightFraction(15)` | `0.3380` (hardcoded `49.5°N` winter) | `0.6187` (`-45°S` summer photoperiod) | `unitScore = 0.5463` | **NO** (`-45%` photoperiod error in Southern Hemisphere) |

### Frame inspection answers (Rules 6 & 11)
- **What do I see here?**:
  - `frame-0.png` (`0.951 s`, `49.5°N`, `day = 227` Year-1 Aug 15, `13:05`, `+23.95 °C`): Sunlit boreal clearing at `(-1144.1, -948.5)` with full bright-green crowns on the central paper birch and flanking trembling aspens, and lush green bunchberry and twinflower carpets (`1,277` visible plants) across the forest floor.
  - `frame-1.png` (`2.484 s`, `49.5°N`, `day = 592` Year-2 Aug 15, `13:00`, `+23.96 °C`): Exact same clearing one calendar year later under a `52.71°` August sun; every paper birch and trembling aspen crown is stripped completely bare to white branches while all bunchberry/bluebead understory leaves turn deep crimson-red (`uColour = 1`).
  - `frame-2.png` (`18.883 s`, `49.5°N`, `day = 15` Jan 15, `13:03`, `-19.02 °C`): Bare winter birch and aspen trunks over frost-whitened grass tufts, yet dense clumps of bright summer-green bunchberry and bluebead leaves sit fully leafed out in the lower-left and lower-right foreground (`uColour = 0`, `windUniformHasOff = false`).
  - `frame-3.png` (`35.171 s`, `-45.0°S, -71.5°W`, `day = 15` Jan 15 austral midsummer, `13:03`, `+12.25 °C`, `62.95°` sun): High summer illumination and green ground flora (`1,566` visible plants), yet every paper birch and trembling aspen crown is `100%` winter-bare (`off = 1`) and zero summer flowers bloom.
- **Does that look natural as described? How do I know?**: No. In Year-2 August (`frame-1.png`) and austral January (`frame-3.png`), healthy deciduous trees at `+12..+24 °C` under `53°–63°` summer sun carry full green foliage (Burns & Honkala 1990), whereas in `-19 °C` boreal January (`frame-2.png`), herbaceous *Cornus canadensis* and *Clintonia borealis* shoots have senesced and subnivean plants shorter than the snowpack are buried beneath snow (Raunkiaer 1934; Sturm et al. 2010).

## Objectives
- [ ] Wrap `phenology(day, latDeg)` (`src/core/treeSpecies.ts`) and `steppeCure(day, latDeg)` (`src/render/pbr.ts`) periodically modulo `365` days (`((Math.floor(day) - 1) % 365 + 365) % 365 + 1`, including negative rewind days) and offset Southern Hemisphere sites (`latDeg < 0`) by `+182.5` days (`siteLatitude` propagated through `trees.ts` and `environment.ts`).
- [ ] Export `uOff` on `WIND_UNIFORMS` (`src/render/trees.ts`) and wire `src/render/flora/flora.ts` to pass wrapped/hemisphere-phased `uDay` for flower bloom, senesce/shed non-evergreen (`!spec.evergreen`) deciduous flora foliage with `uOff` so winter herbs/shrubs never render summer-green leaves in January while preserving evergreen `twinflower` / `labradortea` / `wintergreen`, and bury ground flora vertices/organs below local snow depth `uSnowM` (matching `grass.ts`).
- [ ] Wire `src/core/fields.ts` (`daylightFraction`, `sunTable`, `sunSeconds`) to include `DAY.dayOffset * DAY_S`, `siteLatitude(LATITUDE)`, and `cellClimate` so forage regrowth halts in `-19 °C` winter (`setDay(15)`) and follows Southern Hemisphere summer photoperiod and air temperature.
- [ ] Add unit tests (`npm test` + `npx tsc --noEmit`), document `notes/skills/flora-seasonal-phenology.md`, verify `compositeScore >= 0.95` across all three audit cases in `numeric-check.mjs`, and capture before/after ground frames verifying Year-2 August canopy/bloom, January senescence & snow burial, and Southern Hemisphere summer canopy/bloom.
