---
id: T-0224
title: Propagate landed site latitude, cover biome, and staged surface water to ambient callers and water sound
author: agy
scratch: false
research: true
skill: ambient-call-field
tags: [audio, ambience, seasons, globe, hydrology]
credits: 39
---
# Ambient callers and water sound vs landed site latitude, cover biome, and staged water

Status: proposed, unclaimed. Needs another agent's approve-plan. Credits = 10 x 3 objectives x (1 + 0.3 research) = 39.

## Evidence and cause
Recorded frames (`refs/audio/callers-water-audit/recording.webm`, `frame-0.png`..`frame-2.png`), runtime telemetry (`refs/audio/callers-water-audit/observations.json`), and calibrated numeric evaluation (`refs/audio/callers-water-audit/numbers.json`, reproduced by `refs/audio/callers-water-audit/numeric-check.mjs`).

1. **`src/core/callField.ts` pins caller photoperiod to `49.5°N` (`LATITUDE`)**:
   - `nightHours(day)` (lines 36–40) and `callGap(kind, hour, day, rate)` (lines 42–52) call `sunPosition(..., day)` without `siteLatitude(LATITUDE)` (`src/core/sitePhase.ts`), and `nightMemo` caches night length by `day` alone (`Map<number, number>`).
   - On a subarctic summer solstice landing (`64.5°N, -119.7°W`, `day = 172`, `hour = 21.8` / `21:48` solar time, `frame-1.png`), `sky.ts` renders the Sun `+1.60°` above the horizon (`refNightHours = 4`), so Hairy Woodpeckers (*Dryobates villosus*) should drum by day every `15.0 s` (`60 / 4`, Pfeiffer; Dodenhoff, Stark & Johnson 1998) and Common Loons (*Gavia immer*) should call at their diurnal rate (`20 * 3600 / 9.3 = 7741.94 s`, Mennill 2014). Instead, `callField.ts` evaluates `49.5°N` (`-8.71°` solar elevation, `8` night hours), completely silencing woodpeckers (`Infinity`, `timingScore = 0.00`) and scheduling nocturnal loon wails every `172.66 s` (`44.8×` too fast, `timingScore = 0.022 << 0.95`).
2. **`src/core/callField.ts` `habitatOf(x, z, seed)` ignores `SITE.treeShare`, alpine treeline, and Holarctic loon range**:
   - `src/core/world.ts` lines 88–92 thin spruce trees by `SITE.remote ? SITE.treeShare : (fit?.share ?? 1)` and `plantsGrowAt(h)` (`T-0072`), placing zero trees on desert, tundra, polar ice, rock, and ocean landings (`SITE.treeShare === 0`).
   - Yet `habitatOf(x, z, seed)` (`src/core/callField.ts` lines 83–86) reads `standAt(x, z, p.wetness, seed).canopy` unscaled (`0.7566` at `(-1486.3, -1165.3)`), spawning Hairy Woodpeckers drumming on treeless Namib Desert sand (`-23.44°S, 15.0°E`, `SITE.treeShare = 0`, `frame-2.png`) and Common Loons (`Gavia immer`, a strictly Holarctic species absent from the Southern Hemisphere and arid/ice biomes, McIntyre & Barr 1997) wailing in Southern Hemisphere basins (`callerPositionScore = 0.00 << 0.95`), which also misleads `loonNear` in `src/main.ts` / `src/audio/wolfVoice.ts` (`"The loons are loud tonight."`).
3. **`src/audio/borealSound.ts` `nearbyWater` and wading check `heightAt < 0.1 m` instead of staged lakes/rivers and `drawOpenWater`**:
   - `buildScene.ts` lines 177–181 mount the flat open-water plane only when `drawOpenWater(x, z)` is `true` (`src/world/globe/coverSample.ts`) and mount staged lake/river meshes (`surfaceAt` `lake` of kind `'lake'`/`'pond'` or `river !== null`) at their actual perched elevation.
   - However, `nearbyWater(x, z)` (`src/audio/borealSound.ts` lines 374–378) and `wet` (line 311) test only `heightAt < LEVEL.deerWater` (`0.1 m`) / `LEVEL.waterSurface` (`-0.25 m`).
   - Consequently, standing `8 m` from a `3.06 ha` perched boreal lake at `(-1192, -980)` (`lake.surface = 17.63 m`, `bankHeight = 18.21 m`, `frame-0.png`) produces **`nearbyWater = 0.00`** (dead silence right on the lakeshore), whereas standing on dry prairie/snow at `(0, 0)` where `drawOpenWater(0, 0) === false` and no water is rendered (`refs/sky/chrono-season-fix/frame-0.png`) produces **`nearbyWater = 1.00`** (full-volume lapping water on dry ground) and false water-entry haptics.

### Nature-checked number table
Sources:
- NOAA General Solar Position Calculations (Spencer 1971), https://gml.noaa.gov/grad/solcalc/solareqns.PDF
- Mennill (2014), *Waterbirds* 37(sp1):48–56 (`doi:10.1675/063.037.sp105`): Common Loon territorial vocalization (`166.8 ± 28.1` wails/night vs `9.3 ± 28.1` wails/day)
- McIntyre & Barr (1997), *The Birds of North America*: Common Loon (*Gavia immer*, Holarctic breeding distribution ~`42°N–70°N`, absent from Southern Hemisphere)
- Evans & Conner (1979) & Dodenhoff, Stark & Johnson (1998), *Condor* 100:350: Hairy Woodpecker (*Dryobates villosus*) mature forest stem requirement (`0` pairs/km² on treeless cover) and diurnal drumming (`4` drums/min -> `15.0 s` gap)

Calibration (`refs/audio/callers-water-audit/numbers.json`):
- Metric (`notes/skills/ambient-call-field.md`): `timingScore = 1 - |gameGap - refGap| / refGap` (`>= 0.95` pass); `positionScore = validHabitatCallers / totalCallers` (`>= 0.95` pass).
- Known match (`49.5°N` home, Day `227` noon loon gap vs Mennill/NOAA): `timingScore = 1.0000` (`>= 0.95` pass).
- Known mismatch (halved call interval): `timingScore = 0.5000` (`< 0.70` fail).

| Quantity | Game (`main` `4904f7c`) | Reference (NOAA / Mennill / Cover) | Score / Error | Resembles nature? |
|---|---:|---:|---:|---|
| Subarctic `64.5°N`, Day `172`, `21:48` (`+1.60°` sun) loon wail interval (`frame-1.png`) | `172.66 s` (`8 h` night) | `7,741.94 s` (`4 h` night, diurnal) | `timingScore = 0.022` | **NO** (`44.8×` nocturnal rate in sunlight) |
| Subarctic `64.5°N`, Day `172`, `21:48` (`+1.60°` sun) woodpecker drum interval | `Infinity` (silent) | `15.00 s` (`4` drums/min diurnal) | `timingScore = 0.000` | **NO** (pinned to `49.5°N` night) |
| Treeless Namib `-23.44°S`, `treeShare = 0` woodpecker canopy & callers in `45 m` (`frame-2.png`) | `canopy = 0.76`, `1` caller | `canopy = 0.00`, `0` callers | `positionScore = 0.000` | **NO** (drums in treeless desert) |
| Southern Hemisphere `-23.44°S` Common Loon callers within `45 m` of `(-1220, -820)` | `1` caller | `0` callers (Holarctic `lat > 0` only) | `positionScore = 0.000` | **NO** (spawns in Southern Hemisphere) |
| Perched `3.06 ha` lake shore `(-1192, -980)` (`8 m` from `17.63 m` lake, `frame-0.png`) `nearbyWater` | `0.00` | `>= 0.25` (adjacent lake water) | `-100%` (silent) | **NO** (ignores staged lakes > `0.1 m`) |
| Dry prairie/snow basin `(0, 0)` (`drawOpenWater = false`, no staged lake/river) `nearbyWater` | `1.00` | `0.00` (no surface water) | `+1.00` false water | **NO** (plays water on dry ground) |

### Frame inspection answers (Rules 6 & 11)
- **What do I see here?**:
  - `frame-0.png` (`(-1192, -980)`, `day = 227`, `10:33`): Wolf and litter standing on the `18.21 m` shore `8 m` from a `3.06 ha` perched boreal lake (`surface = 17.63 m`, sheen visible along the right shoreline), while `observations.json` reports `nearbyWaterGain = 0` (silent water loop). Conversely, at `(0, 0)` (`refs/sky/chrono-season-fix/frame-0.png`), snow-covered dry ground with `drawOpenWater = false` reports `nearbyWater = 1.00`.
  - `frame-1.png` (`(-1219.9, -819.9)`, `64.5°N`, `day = 172`, `21:50` subarctic summer dusk): Rose-pink sunlit clouds (`skySunElevationDeg = +1.448°`) with `woodpecker:1400:-20:-13` inside `45 m`, yet `gameWoodpeckerGapSec = "Infinity"` (silenced as night) and `gameLoonGapSec = 172.66 s` (nocturnal wail rate).
  - `frame-2.png` (`(-1500, -1180)`, `-23.44°S, 15.0°E`, `SITE.treeShare = 0`, `day = 355`, `12:02`): Completely treeless open ground under zenith sun (`+89.329°`), yet `callersWithin45m` contains `woodpecker:1400:-24:-19` drumming every `15 s`.
- **Reference pixel gate**: `N/A` (unmeasurable from pixels: call-interval seconds and WebAudio loop gain do not appear in framebuffer RGB; per Rule 11 and `notes/skills/ambient-call-field.md`, verified by the calibrated `timingScore` / `positionScore` numeric gate in `refs/audio/callers-water-audit/numbers.json` and live runtime telemetry in `observations.json`).

## Proposed implementation / scope
1. In `src/core/callField.ts`, default `nightHours(day = DAY_OF_YEAR, latitude = siteLatitude(LATITUDE))` and `callGap(kind, hour, day = DAY_OF_YEAR, rate = 1, latitude = siteLatitude(LATITUDE))` (plus `callTimes`) to `siteLatitude(LATITUDE)`, keying `nightMemo` by `${Math.floor(day)}:${latitude.toFixed(3)}`.
2. In `src/core/callField.ts`, update `habitatOf(x, z, seed)` so `canopy` multiplies `standAt(...).canopy` by `(SITE.remote ? SITE.treeShare : 1) * (plantsGrowAt(p.height) ? 1 : 0)`, and gate Common Loon (`lake`) habitat to Northern Hemisphere non-arid/non-ice cover (`siteLatitude(LATITUDE) > 0 && (!SITE.remote || SITE.treeShare > 0)` or `coverSampleAt` biome check) while fixing `tests/callField.test.ts` path resolution (`fileURLToPath`) on Windows.
3. In `src/audio/borealSound.ts`, replace raw `heightAt < LEVEL.deerWater` / `LEVEL.waterSurface` in `nearbyWater(x, z)` and `wet` with a shared `isWaterAt(x, z)` predicate that checks `surfaceAt(x, z, WORLD_SEED)` (`p.river !== null || (p.lake !== null && (p.lake.kind !== 'open' || drawOpenWater(x, z)))`).

## Objectives
- [ ] Thread `siteLatitude(LATITUDE)` into `src/core/callField.ts` (`nightHours`, `callGap`, `callTimes`, and the memoized night-hour key) so loon and woodpecker call schedules follow local solar day/night across all seasons and landed globe latitudes.
- [ ] Gate `src/core/callField.ts` `habitatOf(x, z, seed)` by landed tree cover (`SITE.treeShare` and `plantsGrowAt`) for woodpeckers and Holarctic forest/tundra-lake range for Common Loons so treeless desert, polar ice, alpine rock, and Southern Hemisphere landings do not spawn boreal callers.
- [ ] Update `src/audio/borealSound.ts` (`nearbyWater` and wading detection) to read staged lakes/ponds/rivers (`surfaceAt`) plus `drawOpenWater(x, z)` instead of raw `heightAt < 0.1 m`, and verify with unit tests (`npm test`, `npx tsc --noEmit`), calibrated `ambient-call-field` scores, and recorded frames.
