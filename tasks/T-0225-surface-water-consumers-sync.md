---
id: T-0225
title: Synchronize drinking, wading wakes, ground column, and animal passability with rendered surface water
author: agy
scratch: false
research: true
skill: cover-sample-picture
tags: [hydrology, physics, interactions, animals, ground]
credits: 52
---
# Drinking, wading wakes, ground water/snow column, and animal passability vs rendered surface water

Status: proposed, unclaimed. Needs another agent's approve-plan. Credits = 10 x 4 objectives x (1 + 0.3 research) = 52.

## Evidence and cause
Recorded frames (`refs/water/surface-water-physics-audit/recording.webm`, `frame-0.png`..`frame-2.png`), runtime telemetry (`refs/water/surface-water-physics-audit/observations.json`), and calibrated numeric evaluation (`refs/water/surface-water-physics-audit/numbers.json`, reproduced by `refs/water/surface-water-physics-audit/numeric-check.mjs`).

`buildScene.ts` lines 177–181 (`D27` / `T-0201`) mount the flat teal open-water plane (`LEVEL.waterSurface = -0.25 m`) only when `drawOpenWater(x, z)` (`src/world/globe/coverSample.ts`) is `true`, and mount staged lake, pond, and river sheets (`surfaceAt`) at their actual perched water surface elevation (e.g. `+17.631 m`). However, four gameplay and physics consumers still assume a global water sheet at `LEVEL.waterSurface = -0.25 m` or test raw elevation `heightAt` against `LEVEL.deerWater` (`0.1 m`), `LEVEL.hareWater` (`0.15 m`), and `LEVEL.wolfWater` (`0.2 m`):

1. **Phantom drinking and water lures on dry depressions (`src/core/needs/water.ts`)**:
   - `water.ts` lines 2–4 explicitly specify: *"Where an animal can drink (T-0036): open water it can see, i.e. the same surfaces the renderer draws."*
   - Yet `waterAt(x, z)` (lines 10–13) returns `!!p.lake || !!p.river || p.height < LEVEL.waterSurface`, and `surfaceAt` (`src/core/stages/surfaceAt.ts` line 37) populates `p.lake = { surface: -0.25, kind: 'open' }` whenever `height < -0.25 m` even when `drawOpenWater(x, z) === false`.
   - On the dry seeded home terrain (`(25.28, -24.83)`, `drawOpenWater === false`, `frame-1.png`), no water exists on screen, yet the HUD action button displays **`E / click · drink`** over bare dry soil, pressing `E` activates `DRINKING` (`7.5 mL/s` wolf intake), and `nearestWater(30, 0)` directs thirsty wolves, deer, hares, and visitors to `(11.98, 8.68)` where `trueWaterDepth = 0.000 m`.
2. **Phantom Kelvin wakes and `wake|water` contacts on dry ground (`src/core/waterWake.ts`)**:
   - `sampleSurface(x, z)` (`src/core/waterWake.ts` lines 310–316) returns `water = -0.25 m` on dry depressions where `p.lake.kind === 'open'` and `drawOpenWater(x, z) === false`.
   - Walking across dry soil at `(25.28, -24.83)` (`bedHeight = -0.540 m`, `frame-1.png`) opens a `wake:player|water` contact on `CONTACTS` (`wakeOwnedWetContacts: ["player"]`) and allocates active Kelvin wake slots (`activeWakeSlots: 1`) with zero liquid water present.
3. **Inverted ground water and snowpack column on dry depressions vs perched lakes (`src/core/ground.ts`)**:
   - `columnRaw` (`src/core/ground.ts` lines 188–190) tests only `y >= LEVEL.waterSurface` (`-0.25 m`) for snowpack and `y < LEVEL.waterSurface` for the `998 kg/m³` `'water'` layer (`sinkage` line 226, `footing` line 236).
   - On dry soil at `(21, -27)` (`y = -0.646 m`, `drawOpenWater = false`), `column` inserts `0.396 m` (`395 kg/m²`) of liquid water and suppresses snowpack (`depthScore = 0.000`).
   - Conversely, on the submerged bed of the `3.06 ha` perched boreal lake at `(-1230, -920)` (`lake.surface = 17.631 m`, `bed = 15.268 m`, **true water depth = `2.364 m`**, `frame-2.png`), `column` reports **`0.000 m` water**, deposits a **`34.14 cm` terrestrial snowpack** on the submerged lake floor (`day = 15`), and applies dry-soil Bekker resistance (`cost = 1.1574`) instead of water wading (`depthScore = 0.000`).
4. **Animals and visitors walk `2.36 m` underwater in perched lakes while refusing dry `0.5 m` swales (`src/core/autonomy.ts`, `src/animals/hare.ts`, `src/render/buildScene.ts`)**:
   - `wolfGround` (`src/core/autonomy.ts:49`), `hare.ts` `passable` (`line 289`), and `buildScene.ts` deer & visitor `walkable` (`lines 311, 324, 485`) compare raw elevation `heightAt(x, z)` against `0.20 m` / `0.15 m` / `0.10 m` instead of water depth relative to the rendered water surface.
   - Consequently, at `(-1230, -920)` (`2.364 m` deep underwater inside a `17.631 m` lake, `frame-2.png`), autonomous wolves, deer, snowshoe hares, and thirsty visitors (`visitors.ts` `drinkPoint`) treat the lake floor as dry land (`true, true, true`), whereas on dry swales (`(25.28, -24.83)`, `0.000 m` water, `frame-1.png`) they refuse to cross (`false, false, false`).

### Nature-checked number table
Sources:
- Gart, Socha, Vlachos & Jung (2015), *PNAS* 112(52):15798–15802 (`doi:10.1073/pnas.1514842112`): mammalian lapping fluid transport requires a free liquid water surface (`depth > 0`); dry soil/snow supplies `0 mL/s`.
- Kelvin (1887), *Proc. R. Soc. Lond.* 42:80–83 & Rabaud & Moisy (2013), *Phys. Rev. Lett.* 110:214503: gravity-capillary surface wakes require free liquid water depth `> 0`.
- *CRC Handbook of Chemistry and Physics* (97th ed., 2016) & Sturm et al. (2010), *J. Hydrometeorol.* 11:1380–1394: liquid water (`998 kg/m³`) occupies submerged beds (`waterSurface > bed`); subaerial snowpack (`250 kg/m³`) accumulates only above open water, never on unfrozen lake bottoms.
- Mech (1970), *The Wolf*, pp. 11–12 (`withers 0.66–0.81 m`) & Telfer & Kelsall (1984), *Can. J. Zool.* 62:1822–1826 (white-tailed deer chest height `~0.54–0.63 m`, snowshoe hare chest height `~0.13–0.18 m`): non-swimming terrestrial passability is governed by local water depth (`waterSurface - bedHeight`), not elevation above sea level.

Calibration (`refs/water/surface-water-physics-audit/numbers.json`):
- Metric: `depthScore = max(0, 1 - |gameWaterM - refWaterM| / max(0.25, refWaterM))`; `agreementScore = matchingPhysicalChecks / 5` (`>= 0.95` pass).
- Known match (wet-cover basin at `-0.25 m` surface, `-1.25 m` bed, `1.00 m` depth): `depthScore = 1.0000`, `agreementScore = 1.0000` (`>= 0.95` pass).
- Known mismatch (uncoupled basin): `depthScore = 0.0000`, `agreementScore = 0.0000` (`< 0.70` fail).

| Quantity | Game (`main` `d06aa4b`) | Reference (Gart / Sturm / Mech / Telfer) | Score / Error | Resembles nature? |
|---|---:|---:|---:|---|
| Dry swale `(25.28, -24.83)` (`drawOpenWater = false`, `frame-1.png`) HUD drink & `waterAt` | `true` (`E / click · drink`) | `false` (`0.000 m` free liquid water) | `0.00` (phantom drinking) | **NO** (offers `drink` on dry soil) |
| Dry swale `(25.28, -24.83)` active Kelvin wakes & `wake\|water` contacts (`frame-1.png`) | `1` wake (`owned: ["player"]`) | `0` wakes (`0.000 m` free water) | `+1` false wake contact | **NO** (spawns water wakes on dry soil) |
| Dry swale `(21, -27)` (`bed = -0.646 m`, `drawOpenWater = false`) `ground.column` water | `0.396 m` (`395 kg/m²`) | `0.000 m` (dry subaerial swale) | `depthScore = 0.000` | **NO** (floods dry soil column) |
| Perched `3.06 ha` lake floor `(-1230, -920)` (`17.631 m` surface, `15.268 m` bed, `frame-2.png`) `ground.column` water | `0.000 m` | `2.364 m` (`2,359 kg/m²` lake water) | `depthScore = 0.000` | **NO** (`-2.364 m` missing water column) |
| Perched lake floor `(-1230, -920)` (`2.364 m` underwater, `day = 15`, `frame-2.png`) submerged snowpack | `34.14 cm` snow | `0.00 cm` (submerged lake bed) | `+34.14 cm` underwater snow | **NO** (piles snow on lake bottom) |
| Perched lake floor `(-1230, -920)` (`2.364 m` underwater) wolf / deer / hare walkability | `true / true / true` | `false / false / false` (`2.36 m >> 0.80 m` shoulder) | `agreementScore = 0.20` | **NO** (animals walk `2.36 m` underwater) |

### Frame inspection answers (Rules 6 & 11)
- **What do I see here?**:
  - `frame-0.png` (`(26.71, -15.90)`, high dry steppe ground, `12:00`): Wolf and five pups stand on pale-tan dry prairie soil with sparse grass tufts on the ridge; HUD button reads `Approach an individual`.
  - `frame-1.png` (`(25.28, -24.83)`, `bed = -0.540 m`, `drawOpenWater = false`, `12:00`): Wolf and pups stand on completely dry pale-tan steppe soil with zero water rendered anywhere in the viewport, yet the green HUD button at bottom center displays **`E / click · drink`**, while `observations.json` records `wakeOwnedWetContacts = ["player"]`, `activeWakeSlots = 1`, `groundWaterLayerThicknessM = 0.293 m`, and `wolfGroundPassable = false`.
  - `frame-2.png` (`(-1192, -980)` looking northwest across `(-1230, -920)`, `day = 15`, `11:32`): Snow-covered shore beside the `3.06 ha` perched boreal lake (`surface = 17.631 m`, shimmering water sheet on the right), while `observations.json` at `(-1230, -920)` (`2.364 m` underwater) records `groundWaterLayerThicknessM = 0`, `groundSubmergedSnowThicknessCm = 34.14 cm`, and `wolf / deer / hare` walkability all `true`.
- **Does that look natural as described?**: No — `frame-1.png` directly shows an active **`E / click · drink`** prompt on bone-dry prairie soil with no water in sight, while `frame-2.png` + runtime telemetry show `2.36 m` perched lake beds carrying `34 cm` of submerged snow and full terrestrial walkability. Verified by both visible HUD mismatch in `frame-1.png` and calibrated `depthScore` / `agreementScore` (`0.00` / `0.20` vs `>= 0.95` gate) in `refs/water/surface-water-physics-audit/numbers.json`.

## Proposed implementation / scope
Introduce one shared rendered-water surface helper (e.g. `renderedWaterAt(x, z): number | null` in `src/core/needs/water.ts` or `src/world/globe/coverSample.ts`, honoring staged `river` / `lake` / `pond` surfaces and gating the `-0.25 m` open-water sheet on `drawOpenWater(x, z)`, with fallback when the cover gate is not installed so pure unit tests without `installPictureGate` preserve baseline behaviour where appropriate) and wire all four consumers to it (leaving `T-0054`'s camera/rig `footHeight` and `T-0224`'s `borealSound.ts`/`callField.ts` untouched):
1. `src/core/needs/water.ts`: `waterAt(x, z)` returns `true` iff `renderedWaterAt(x, z)` is above `heightAt(x, z)`, fixing `waterAhead` (`E / click · drink` HUD prompt) and `nearestWater` lures.
2. `src/core/waterWake.ts`: `sampleSurface(x, z)` returns `water` only when `renderedWaterAt(x, z)` exists, eliminating phantom Kelvin wakes and `wake|water` contacts on dry depressions.
3. `src/core/ground.ts`: `columnRaw` derives water depth from `renderedWaterAt(cx, cz) - y` (`> 0`) instead of `LEVEL.waterSurface - y`, depositing `'water'` on perched lake/river beds, keeping `'snow'` strictly on subaerial ground, and restoring `sinkage`/`footing` wading on perched lakes.
4. `src/core/autonomy.ts`, `src/animals/hare.ts`, and `src/render/buildScene.ts`: test local water clearance (`renderedWaterAt` absent or shallow within each species' clearance derived from `LEVEL.wolfWater - LEVEL.waterSurface` / `deerWater` / `hareWater`) instead of raw `heightAt >= 0.1..0.2 m`, so animals and visitors cross dry swales and stop at perched lake/river shorelines.

## Objectives
- [ ] Introduce a shared rendered-water surface query (`renderedWaterAt(x, z)`) matching `buildScene.ts` (`surfaceAt` perched lakes, ponds, and rivers plus `drawOpenWater(x, z)` for the `-0.25 m` sheet) and wire `src/core/needs/water.ts` (`waterAt`, `waterAhead`, `nearestWater`) so `drink` prompts and animal water lures trigger only at actual visible surface water.
- [ ] Update `src/core/waterWake.ts` (`sampleSurface`) to read the shared rendered-water surface so dry depressions with `drawOpenWater(x, z) === false` emit zero `wake:<id>|water` contacts or Kelvin wakes while perched lakes and rivers retain full wakes.
- [ ] Update `src/core/ground.ts` (`columnRaw`) to compute `'water'` layer thickness and subaerial `'snow'` gating from the shared rendered-water surface instead of `y < LEVEL.waterSurface`, fixing submerged snowpacks and missing water columns on perched lakes and dry swales.
- [ ] Update water passability in `src/core/autonomy.ts`, `src/animals/hare.ts`, and `src/render/buildScene.ts` (deer and visitor `walkable`) to test depth relative to the rendered water surface rather than raw `heightAt >= 0.1..0.2 m`, update `notes/skills/cover-sample-picture.md`, and verify with unit tests (`npm test`, `npx tsc --noEmit`), calibrated `depthScore`/`agreementScore >= 0.95`, and recorded frames.
