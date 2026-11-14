---
id: T-0213
title: A generated thing is the seed, the place, the time, and the parent
author: grokbot-2
scratch: false
research: true
skill: deterministic-generation
tags: [design]
credits: 26
---
# T-0213 A generated thing is the seed, the place, the time, and the parent

Issue #97, closed on GitHub, with no task. Matthew, direct chat 2026-11-07 17:45 PT: "go over anything else that needs fixing. i dont need to have to be the only one that can detect those issues". well, anything i request by direct chat shouldnt need approval (Matthew, 2026-10-22 01:52 PT).

Credits 26 = 10 x 2 objectives x (1 + 0.3 research). Not from scratch: `proc/rng.ts` is already the seeded stream. Plan approval is not recorded here.

#97: universal seed, location, time, and parent conditions determine the result. The same inputs play back the same entity.

## Objectives

- [x] State the formula in one place and point at the generators that already follow it.
- [x] Name any generator that still calls an unseeded source, or say there is none, with the search.

## Acceptance

Rule 12. A reviewer can replay one named entity from the formula.

## §1 Canonical Deterministic Generation Formula (#97)

Every generated thing in Boreal is a pure function of four inputs — **never** `Math.random()`, hardware entropy, thread timing, or chunk/frame visit order:

$$\text{Entity} = G(\text{seed},\; \text{place},\; \text{time},\; \text{parent})$$

1. **`seed` (Universal -> World -> Domain Stream)**:
   - `universeSeed` (`u32`) derives the living-world seed via `worldSeedFromUniverse(universeSeed) = hash("world:" + u) || 1` (`src/core/universeSeed.ts:32-36`; default home `WORLD_SEED = 1400` at `src/core/world.ts:19`) and cosmic sub-streams via `universeStream(universeSeed, label)` (`src/core/universeSeed.ts:39-40`).
   - All CPU random draws flow through `src/proc/rng.ts`: 32-bit FNV-1a `hash(text)` (`rng.ts:18-22`), `mulberry32` `random(seed)` (`rng.ts:24-33`), `stream(seed, label) = random(hash(label + ":" + seed))` (`rng.ts:35`), truncated Box-Muller `sample(r, dist)` (`rng.ts:42-49`), and integer lattice `hash2u(cx, cy, s)` (`rng.ts:6-16`, matching GPU shader `hash2u` in `src/proc/glsl.ts:12-27`), plus spherical `place_hash(lat, lon)` shared by TypeScript and Rust (`src/world/globe/coverKind.ts:22-30`, `rust/boreal-sim/src/cover.rs:151-159`).
   - Refusal-safe sub-streams (`hash("cover-tree:...")`, `hash("herb-light:...")`, `hash("stones-v1:...")`, `hash("forage-v1:...")` in `src/core/world.ts:91, 97, 105, 126`) isolate site rejections so refusing one candidate never shifts the identity or placement of later entities.
2. **`place` (Coordinates & Physical Site)**:
   - Discrete cell indices `(cx, cz)` / `(tx, tz)` and continuous local `(x, z)` or planetary `(lat, lon, elevM, coastM)` coordinates (`chunkSeed` at `src/core/world.ts:66-70`; `heightAt`, `soilAt`, `siteAt` at `src/core/flora/site.ts:58-80`; `coverRow` at `src/world/globe/coverKind.ts:65-73`).
3. **`time` (World Clock, Stand Age, & Synoptic/Population Phase)**:
   - Simulation epoch `(year, day, hour, gameSeconds)` (`src/core/worldClock.ts`, `src/core/timeOfDay.ts`), stand fire-return age `fireAt(x, z, seed).age` (`src/core/stand.ts:25-33`), synoptic weather `climate(day, hour, z)` (`src/core/weather.ts:122-142`), multi-year population cycles `year` (`rust/boreal-sim/src/species.rs:59-77`), solar rotation date `groupsOn(dateMs)` (`src/world/sun/sunspots.ts:45`), and developmental time `ageAfter(ageYears, gameSeconds)` (`src/core/litter.ts:42-45`).
4. **`parent` (Stand, Cluster Parent, Maternal/Trophic State, or Genome Log)**:
   - Upstream causal parent conditions: parent fire stand `standStructure(age, wet)` (`src/core/stand.ts:78-104`) and canopy `site.light` thinning understorey herbs/forage (`src/core/world.ts:96-99, 132-134`); parent glacial-till boulders `parents[i % 16]` spawning offspring stone clusters (`src/core/world.ts:105-123`); Thomas parent-offspring plant and far-tree clusters `thomas(...)` (`src/core/flora/site.ts:94-106`, `src/core/flora/stands.ts:36-41`); prey population cycle driving lagged predator density via `cycle_lag_years` (`rust/boreal-sim/src/species.rs:71-75`); mother wolf position, yaw, movement, and threat driving litter placement `birthPlaces` / `pupAim` (`src/core/litter.ts:71-85, 118-136`, `rust/boreal-sim/src/litter.rs`); and species base genome + append-only edit log `replay(log)` (`src/core/genome.ts:50`).

### Generators Already Following `(seed, place, time, parent)` (`d06aa4b`)

| Domain | Generator (`file:line`) | `seed` | `place` | `time` | `parent` |
|---|---|---|---|---|---|
| Universe -> World | `worldSeedFromUniverse`, `universeStream` (`src/core/universeSeed.ts:32-40`) | `universeSeed` | — | cosmic stage | `universeSeed` parent |
| Globe & Tectonics | `buildPlates` (`src/world/globe/plates.ts:27-35`), `createPlanet` (`src/world/globe/planet.ts:156-205`) | `seed` (`stream` / `mulberry32`) | unit-sphere `p`, `(lat, lon)` | `sim.step` / `dayOfYear` | plate seed / relief `h` |
| Staged Geology | `elevationGrid` (`src/core/stages/elevation.ts:144`), `computeFlow` (`flow.ts:33`), `riverGrid` (`rivers.ts:127`), `soilGrid` (`soils.ts:100`) | `STAGES.seed` | 7.68 km grid `(x, z)` | erosion droplets | upslope catchment `acc`, `hand` |
| Fire & Stand Structure | `fireAt`, `standStructure` (`src/core/stand.ts:25-33, 78-104`) | `seed` (`WORLD_SEED`) | `(x, z)` + `wet` | `age` (yr since fire) | Voronoi fire patch `id` |
| Chunk Entities & Till Stones | `chunkSeed`, `generateChunk` (`src/core/world.ts:66-147`) | `worldSeed` + `siteSalt()` | `(cx, cz)` -> `(x, z, h)` | `GENERATOR_VERSION`, stand `site.light` | `site.light` canopy; `parents[i % 16]` till boulders (`world.ts:106-116`) |
| Understorey & Far-Tree Clusters | `thomas` (`src/core/flora/site.ts:94-106`), `farTreesInTile` (`src/core/flora/stands.ts:36-41`) | `hash("thomas:" + label + ":" + seed + ":" + tx + ":" + tz)` | tile `(tx, tz)` -> `(x, z)` | bloom day (`WEATHER.day`) | Poisson parent `(px, pz)` + `suit(x, z)` thinning |
| Tree Skeleton & Growth | `heightAt`, `dbhAt` (`src/core/flora/trees/forms.ts:83-88`), Weber-Penn conifer (`src/render/flora/conifer.ts:185`) | entity `seed` | stand site | tree `age` | parent trunk -> L1 whorl -> L2 lateral |
| Atmosphere & Synoptic Weather | `climate`, `cellClimate` (`src/core/weather.ts:122-160`) | `WORLD_SEED` (`smooth`) | `(x, z, altitude)` | `(day, hour)` | bound `PlanetSim` column target |
| Cover & Cycling Fauna | `cover_row_at` (`rust/boreal-sim/src/cover.rs:204`), `density_per_ha_at`, `landing_population_at` (`rust/boreal-sim/src/species.rs:59-103`) | `place_hash` | `(lat, lon, elev_m, coast_m)` | `year` | `Cover` + prey cycle (`cycle_lag_years`) |
| Wolf Litter & Growth | `birthPlaces`, `ageAfter`, `pupAim` (`src/core/litter.ts:42-45, 71-85, 118-136`, `rust/boreal-sim/src/litter.rs`) | slot phase constants | `(denX, denZ)` / `(motherX, motherZ)` | `time`, `gameSeconds` -> `ageYears` | mother `(x, z, yaw, moving, threatened)` |
| Animal Appearance Genome | `defaultGenome`, `replay` (`src/core/genome.ts:30, 50`) | species default | — | edit index `upTo` | prior `Genome` + `Edit[]` log |
| Sunspots | `groupsOn` (`src/world/sun/sunspots.ts:45`) | `hash("spot:" + key)` | heliographic `(lat, lon)` | Carrington / UTC day `key` | solar cycle phase |

*(Note: `src/core/body.ts`, `src/core/bearBody.ts`, and `src/render/fur.ts` use legacy deterministic `Math.sin` coordinate hashes rather than `proc/rng.ts`; they remain 100% pure functions of seed/vertex index with zero unseeded state, and are allowlisted against new additions in `tests/rules.test.ts:28, 30`.)*

## §2 Exhaustive Search for Unseeded or Wall-Clock Sources (`d06aa4b`)

Search command run across all TypeScript and Rust runtime/simulation sources:

```powershell
git grep -n -E "Math\.random|crypto\.getRandomValues|Date\.now|performance\.now|new Date\(|thread_rng|OsRng|SystemTime|Instant::now|rand::" -- src/ rust/boreal-sim/src/
```

**Verdict on world and entity generators**: **None.** Zero terrain, geology, flora, fauna, weather, or cosmos entity generators in `src/` or `rust/boreal-sim/src/` read an unseeded RNG (`Math.random`, `crypto.getRandomValues`, `rand`, `thread_rng`, `OsRng`, `SystemTime`). `rust/boreal-sim/Cargo.toml` depends solely on `hecs = "=0.10.5"` (no `rand` crate).

Every match from the search falls into one of three explicit non-entity categories:

1. **Intentional Top-Level Universe Seed Mint (1 site, guarded by `tests/rules.test.ts:25`)**:
   - `src/core/universeSeed.ts:13, 16, 20` (`mintUniverseSeed`): draws `crypto.getRandomValues` (with `Math.random` + `Date.now` fallback) **only** when minting a brand-new `universeSeed` (`raw === 0`). Once minted or supplied via URL/storage, every downstream generator is deterministic from that `universeSeed`.
2. **Non-World Session / UI / Standalone-View Wall-Clock Defaults (5 sites)**:
   - `src/audio/music.ts:44`: `const shuffleRng = random(hash(\`music:${Date.now()}\`))` — session background-music playlist shuffle order (audio deck only; never touches world state).
   - `src/core/badges.ts:91`: `drawTest(id, seed = Date.now())` — default quiz-question shuffle when UI omits `seed` (deterministic whenever `seed` is passed).
   - `src/world/sun/sunView.ts:48`: standalone `?view=sun` defaults `?date=` to `Date.now() - 30 * 864e5` when URL omits `?date=` (`groupsOn` at `src/world/sun/sunspots.ts:45` is pure in `date`).
   - `src/world/globe/axisView.ts:67`: `const YEAR = Number(o.q.get('year')) || new Date().getUTCFullYear()` — standalone `?view=axis` debug fallback when `?year=` is omitted.
   - `src/world/cosmos/sphere.ts:540`: `capture4k()` passes `performance.now() / 1000` as shader animation time when exporting a manual 4K still.
3. **Real-Time Frame Slice Budgets, Telemetry Timers, & Clock Delta Integration (remaining hits)**:
   - Frame-budget slicers (`interest.ts:33`, `batch.ts:56`, `fartrees.ts:81`, `moss.ts:116`, `grass.ts:166`, `conifer.ts:294`, `tile.ts:154`) gate *how many* pure jobs run per animation frame without altering job outputs; profiler `ms` fields (`elevation.ts:145`, `flow.ts:34`, `rivers.ts:128`, `soils.ts:101`, `weather.ts:313`, `photoreal.ts`, `globeView.ts`, `inpage.ts`), wall-clock delta integration (`worldClock.ts:52, 134, 152`), UI interaction timestamps (`gameCamera.ts`, `gallery.ts`, `appearancePanel.ts`, `menu.ts`, `probe.ts`), and Rust unit-test timing assertions (`rust/boreal-sim/src/entities.rs:128, 136, 144`).

## §3 Reviewer Replay Recipe (One Named Entity & One Parent-Offspring Cluster)

Run `npx tsx --test tests/deterministic-generation.test.ts` (or inspect `tests/deterministic-generation.test.ts`):
- **Named chunk tree entity `0:0:3`**: `generateChunk(0, 0, WORLD_SEED)` (`WORLD_SEED = 1400`, `STAGES.on = false`, `SITE.remote = false`) deterministically replays `key: "0:0:3"` (`kind: "spruce"`, `seed: 346910013`, `x: 26.216772440820932`, `z: 17.362140594050288`, `rotation: 5.40134891563427`, `scale: 1.3213679399574176`) on every call regardless of prior chunk visit order.
- **Named parent-offspring till stone `stones:0:0:16` & wolf pup slot `4`**: in the same `generateChunk(0, 0, WORLD_SEED)` call, boulder `stones:0:0:16` (`seed: 3211753717`, `x: 18.07291917409748`, `z: 6.7727748937904835`) is deterministically offset within `±2 m` of its parent boulder `parents[0]` (`stones:0:0:0`, `x: 18.121537920087576`, `z: 6.054137367755175`), and pup slot `4` (`pupAim(4, 12, -8, 0.5, 18.0, true, ageAfter(4/52, 3600), false)`) replays `{"x": 12.286301368807564, "z": -6.390191563272207, "yaw": 0.57, "act": "straggle"}` from `(place, time, parent)`.
