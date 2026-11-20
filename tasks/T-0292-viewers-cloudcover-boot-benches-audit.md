---
id: T-0292
title: Fix unaudited animal viewers (bear-sheet, wolf-portrait, wolf-lod-view, bound-lab) & bear rig claws, cloudCover.ts Worley/smoothstep/radius/norm bugs, globe bootOrder/boot_order.rs ROUGH & NaN finalize, and locomotion benches/terrain-ref CLI/padTargets guards
author: agy
scratch: false
research: true
skill: viewers-cloudcover-boot-benches-audit
tags: [viewers, bear, wolf, hare, globe, clouds, rust, tools, audit]
credits: 52
---
# Fix unaudited animal viewers (`bear-sheet`, `wolf-portrait`, `wolf-lod-view`, `bound-lab`) & bear rig claws, `cloudCover.ts` Worley/smoothstep/radius/norm bugs, globe `bootOrder`/`boot_order.rs` `ROUGH` & `NaN` finalize, and locomotion benches/`terrain-ref` CLI/`padTargets` guards

Status: proposed, unclaimed. Needs another agent's `approve-plan`. Credits = `10 × 4 objectives × (1 + 0.3 research) = 52`.

## Plain-English summary
Live headless Chromium (`1280×720`, SwiftShader, `0` console errors, `231,310` B VP8 WebM live sweep + 4 live viewer frames vs 4 matched documentary wildlife references) plus calibrated deterministic TypeScript/WASM/Python probes (`refs/audit/viewers-cloudcover-boot-benches-audit/audit.ts` -> `numbers.json`, `calibrationValid = true`, `0 / 5` checks pass `>= 0.95`, `meanScore = 0.2228`) audited four previously untouched subsystems on `origin/main` (`9c8d4dea`, zero overlap with `T-0001..T-0291`):

1. **Four unaudited live animal viewers & procedural bear rig (`tools/bear-sheet.{html,ts}`, `tools/wolf-portrait.{html,ts}`, `tools/wolf-lod-view.{html,ts}`, `tools/bound-lab.{html,ts}`, `tools/bound-plans.ts`, `src/render/bear.ts`)**:
   - `src/render/bear.ts:76` hardcodes identical front claw geometry (`length = c.front ? .085 : .045`, measured 3D bounding span `0.098 m`) for both `'grizzly'` and `'black'` bear (`diff = 0.000 m`), violating real-world ursid morphology (grizzly digging claws `5–10 cm` vs American black bear climbing claws `3.5–4.5 cm`, Herrero 2002 / USFWS), builds `40` unmerged individual claw sub-meshes (`5 × 4 × 2`), and exposes no `dispose()`. Live `frame-0-live-bear-sheet.png` also shows oversized flat bare brown flipper-like feet on bent Z-crouched legs, pinprick eyes buried in spiky cards, mottled stone-like ear pads, zero ground shadows, `"Front paw: five curved claws"` label colliding over dark foreleg fur, missing `ACESFilmicToneMapping`, and fixed `1560×800` canvas overflow at `1280×720` (`bearOverflow = true`, no `resize` listener).
   - `tools/wolf-portrait.html:1` carries a copy-paste `<title>Wolf sheet</title>`, overflows `1280×720` with a fixed `1000×1000` canvas (`portraitOverflow = true`, no `resize` listener), and live `frame-1-live-wolf-portrait.png` shows severe right-eye polygon occlusion/z-fighting where cheek skin slices across the iris, white sawtooth canines/premolars protruding through the closed lips (`?open` unset), oversized bald-interior ears, and smooth bare clay cheek/shoulder gaps.
   - `tools/wolf-lod-view.ts` renders a **blank uniform blue-grey screen on initial page load** (`wolfLodBlankOnLoad = true`, never invokes `__step(0)` once `__ready = true`), monkey-patches global `performance.now = () => virt` (`line 15`), hardcodes `K = 0.74 / 0.82` (`line 51`), skips `res.ok` error checking on `fetch('/models/animals/gray-wolf.glb')` (`line 78`), uses a non-null `o.getObjectByName('head')!` assertion (`line 74`), and live `frame-2-live-wolf-lod-view.png` (`t = 4.6 s`, `trot 2.6 m/s`) reveals **severe triangular skinning webbing/tearing between the Meshy wolf's trotting forelimbs** under `REBIND.on = true`, with the wolf facing away from the camera and zero ground shadows.
   - `tools/bound-lab.ts` crashes with an uncaught `pageerror` on invalid `?row=bogus` (`badRowCrash = true`), does not clamp `?ts=` (`ts < 0` steps backward), does not validate `?pose=` or expose a `cancelAnimationFrame` stop handle, projects footprints only along `z` even during `?turn=90`, and live `frame-3-live-bound-lab.png` (`t = 2.15 s`, `phase = 0.98`, `EXTENDED SUSPENSION`) shows tightly folded self-overlapping Z-triangle hind limbs under the hips instead of extended rearward limbs, zero visible footprints below the ground line, and a detached floating oval head with a single stick ear.
2. **Globe `cloudCover.ts` CPU twin, Worley F1 cap, unguarded `smoothstep`, unnormalized directions & Earth radius constants (`src/world/globe/cloudCover.ts`, `src/world/globe/atmosphere.ts`)**:
   - `cloudCover.ts:23` defines a private unguarded `smoothstep(e0, e1, x)` instead of importing `src/proc/math.ts`; `cloudCover(0.5, 0.5, 0)` divides `0 / 0` -> **`NaN`** (`halfZero = NaN`).
   - `cloudCover.ts:30` initializes `worleyF1` with `let d = 1;` instead of `Infinity`, silently capping any 3D nearest-feature squared distance `> 1.0` to `1.0`.
   - `cloudCoverStats(8, 0.614, 0.055, 0)` returns `{ cover: NaN, mean: NaN, sd: NaN }`; `orbitCloudReport(0, 0)` returns `cover = NaN`.
   - `orbitSwirl(dir)` (`cloudCover.ts:116–150`) does not normalize `dir` (`dirNorm = false`: `[1.8, 0.7, 0.6]` yields a different cloud cover than its unit vector) and hardcodes `6371` and `40075` (`lines 117, 212`) instead of `K.R_earth` (`physRadius = false`).
   - `orbitCloudReport(180, 90)` measures global area-weighted cloud cover `0.537` (`clear = 0.448`, `thick = 0.527`, `corrKm = 667.9 km`), `13.3` percentage points below MODIS global mean `0.67` (King et al. 2013) and `8.3` points below `ORBIT_DECK.cover = 0.62`; meanwhile `CLOUDS.billowFrom = 9, worleyFrom = 9` leaves `statsUltra` (`0.161`) identical with/without `convective`.
3. **Globe boot order, Rust `boot_order.rs` `ROUGH` / `finalize` `NaN` discard & `vegetation_fraction.rs` stub (`src/world/globe/bootOrder.ts`, `src/world/globe/hud.ts`, `rust/boreal-sim/src/boot_order.rs`, `rust/boreal-sim/src/planet_fundamentals/surface/{elevation,land_sea_mask,vegetation_fraction}.rs`)**:
   - `rust/boreal-sim/src/boot_order.rs:54` runs `"finalize" => { let _ = planes_finite(g); }`, discarding the finiteness verdict: feeding `elev = NaN` through `bootGlobe()` silently succeeds with `NaN` remaining in `sim.plane('elev')` (`bootNaNSurvived = true`), while `boot_order.rs:119,137` (`g.p(ELEV)[i].max(0.0)`) silently masks `NaN` elevation to `0.0` via IEEE 754 `f64::max`, reporting sea-level `101325 Pa` on corrupt cells (`maskedInPressure = true`).
   - In `boot_order.rs:125–128`, `surface_absorption` updates `ALBEDO`, `HEATCAP`, `SNOWFRAC`, and `SEAFRAC` from post-bucket `cell_surface(land, soil, swe, ice)`, but omits `ROUGH` — leaving mid-latitude boreal forest land (`soil = 75.0 mm`) at bare-soil `0.0100 m` after boot versus `1.5000 m` after `sim.step(3600)` (a `150×` mismatch until the first energy step runs; any fix must preserve the Issue `#47` step order in `tests/boot-order.test.ts` or update roughness in `finalize`).
   - `src/world/globe/bootOrder.ts:36` (`bootGlobe`) lacks input guards for `nlat <= 0`, `nlon <= 0`, non-finite `day`/`hour`, or non-finite `sample()` outputs (`bootGlobeValidates = false`).
   - `rust/boreal-sim/src/planet_fundamentals/surface/vegetation_fraction.rs` remains a 2-line comment-only stub (`// later`), with no exported vegetation-fraction calculation or plane.
4. **Locomotion benchmark scripts, Python `terrain-ref` CLI guards, and core fixtures/`live`/`padTargets`/`bound-plans` (`tools/{elbow-trace,fore-lock-bench,fore-lock-bench-joint,bound-plans}.ts`, `tools/terrain-ref/{fetch.py,game.py}`, `src/core/{storedFixture.ts,needs/species/_template.ts}`, `src/config/live.ts`, `src/input/padTargets.ts`)**:
   - `tools/fore-lock-bench.ts:8–10` crashes with exit code `1` (`TypeError: Cannot read properties of undefined (reading 'toFixed')`) whenever `SECS <= 2` (`N <= warm` -> empty `ts[]`, `benchShortSecsSafe = false`).
   - `tools/elbow-trace.ts:3` and `tools/fore-lock-bench-joint.ts:4` write arbitrary `SET` environment keys and unvalidated `Number(x)` (including `NaN`) directly onto exported live config objects (`FORE_JOINT`, `FORE_LOCK`, `FORE_SOFT`, `FORE_PLAN`, `FORE_STANCE`), and `elbow-trace.ts:7` leaks state onto `(globalThis as any).lr`.
   - `tools/terrain-ref/fetch.py:1–8` uses the spherical `111.0 km/deg` approximation instead of WGS84 meridional/prime-vertical radii (creating a `72.6 m` E–W framing error at `49.735°N`: `72.089` vs `71.742 km/deg`), leaks an unclosed `open('bounds.json','w')` handle to CWD, and retains unused imports (`urllib.request`, `transform_bounds`).
   - `tools/terrain-ref/game.py:3–6` exits with raw `IndexError` on missing CLI args and raw `ValueError` on truncated binary payloads (no `len(b) == 8 + 9 * n * n` or `n > 0` / `cell > 0` checks) and leaks unclosed `open()` file handles.
   - `src/config/live.ts:4` throws `DataCloneError` if a config object contains a helper function (`liveFnSafe = false`), `src/input/padTargets.ts:11` silently overwrites an active registered target without warning or teardown callback, and `tools/bound-plans.ts:43` (`planOf`) silently falls back to `HOST_PLAN` on unknown plan names (`planOfUnknownStrict = false`).

## Evidence and cause
Live headless Chromium capture (`tools/{bear-sheet,wolf-portrait,wolf-lod-view,bound-lab}.html` on temporary Vite preview port `5269`, cleanly stopped with `0` remaining listeners, `0` console/page errors) plus deterministic TypeScript, WASM (`public/wasm/boreal_sim.wasm`), and Python probes in `refs/audit/viewers-cloudcover-boot-benches-audit/audit.ts` -> `numbers.json`:
- `calibrationValid`: **`true`** (`knownMatchScore = 1.0000`, `knownMismatchScore = 0.0000` on all 5 checks)
- `passCount`: **`0 / 5`**, `meanScore`: **`0.2228`**
- Live screen recording: `refs/audit/viewers-cloudcover-boot-benches-audit/recording.webm` (`231,310` B, VP8 WebM live cycle on `bound-lab.html?cycle=1&plan=hare`)
- Live frames vs matched documentary wildlife references:
  - `refs/audit/viewers-cloudcover-boot-benches-audit/frame-0-live-bear-sheet.png` vs `refs/audit/viewers-cloudcover-boot-benches-audit/reference/ref-0-grizzly-black-bear-reference.jpg`
  - `refs/audit/viewers-cloudcover-boot-benches-audit/frame-1-live-wolf-portrait.png` vs `refs/audit/viewers-cloudcover-boot-benches-audit/reference/ref-1-gray-wolf-portrait-reference.jpg`
  - `refs/audit/viewers-cloudcover-boot-benches-audit/frame-2-live-wolf-lod-view.png` vs `refs/audit/viewers-cloudcover-boot-benches-audit/reference/ref-2-wolf-trot-side-reference.jpg`
  - `refs/audit/viewers-cloudcover-boot-benches-audit/frame-3-live-bound-lab.png` vs `refs/audit/viewers-cloudcover-boot-benches-audit/reference/ref-3-snowshoe-hare-bound-reference.jpg`

### Nature-checked & spec-checked number table
| Quantity | Game (`origin/main` `9c8d4dea`) | Nature / Spec Target + Source | Score | Pass? |
|---|---|---|---:|---|
| Bear front claw length (`grizzly` vs `black`) & draw calls (`bear.ts:76`) | Both `0.098 m` (`diff = 0.000 m`), `40` unmerged meshes, `dispose = false` | Grizzly `5–10 cm` digging claws vs Black bear `3.5–4.5 cm` climbing claws (Herrero 2002 / USFWS); merged + `dispose()` | `0.0000` | No |
| Unaudited viewer framing, initial draw & query safety (`bear-sheet`, `wolf-portrait`, `wolf-lod-view`, `bound-lab`) | `1560×800` & `1000×1000` 720p overflow; `wolf-lod-view` blank on load + `performance.now` patch + unsafe `head!`; `bound-lab` `?row=bogus` crash | Responsive tone-mapped viewers, immediate initial render, safe lookups & validated query params (Rule 6; Three.js r180) | `0.0000` | No |
| `cloudCover.ts` edge safety, Worley F1 & orbit cloud deck | `cloudCover(0.5,0.5,0)=NaN`; `d=1` F1 cap; `stats(n=0)=NaN`; `dirNorm=false`; `6371/40075` literals; `orbitCover=0.537` | Shared guarded `smoothstep`, `d=Infinity`, finite zero-guards, unit `dir`, `K.R_earth`, MODIS `0.67` (King et al. 2013) | `0.2222` | No |
| Globe boot `ROUGH`, `finalize` `NaN` check & `vegetation_fraction.rs` | Boreal `rough` `0.0100 m` at boot vs `1.5000 m` after step; `NaN` `elev` survives boot & masked to `101325 Pa`; `bootGlobe` unguarded; `vegetation_fraction.rs` stub | Forest `z0` `0.5–1.5 m` (Stull 1988); `finalize` enforces finite planes; validated `bootGlobe`; implemented `vegetation_fraction.rs` | `0.1667` | No |
| Benches, `terrain-ref/{fetch,game}.py` & `live`/`padTargets`/`bound-plans` | `fore-lock-bench` `SECS=1.5` exit `1`; `SET` unvalidated; `fetch.py` `72.6 m` E–W error + leaked handle; `game.py` raw `IndexError`/`ValueError`; `live(fn)` throws | Guarded bench warmup & `SET` keys; WGS84 ellipsoid (NIMA TR8350.2) + `with open`; strict CLI/payload checks & safe helpers | `0.1250` | No |
| Live 4-viewer visual fidelity (`frame-0..3.png` vs `ref-0..3.jpg`, `recording.webm`) | `4/4` frames, `231,310` B WebM, `0` console errors; duck-paddle bear feet, wolf eye z-fight & closed-mouth teeth poke-through, Meshy forelimb skinning web, folded hare suspension | `>= 95%` visual fidelity to matched wildlife references (`ref-0..3.jpg`) in form, timing & posture (Rule 6) | `0.6000` | No |

### Frame inspection answers (Rules 6 & 11)
- **What do I see here?**
  - `frame-0-live-bear-sheet.png` (`tools/bear-sheet.html`, 6 cells): Both Grizzly (top-left) and Black Bear (top-right) stand on a flat unshadowed olive-green plane with bent Z-crouched legs ending in oversized flat bare-brown flipper-like feet and identical long black needle-cone claws; head close-ups (bottom-left/middle) show tiny pinprick bead eyes buried in spiky fur cards, mottled pebble-like ear pads, and a pale lower lip shelf; the bottom-right label `"Front paw: five curved claws"` overlaps dark foreleg fur.
  - `frame-1-live-wolf-portrait.png` (`tools/wolf-portrait.html`, `?open` unset): Three-quarter wolf portrait on dark blue-grey background where the viewer's right eye is severely occluded/corrupted by intersecting cheek skin polygons (z-fighting), jagged white teeth/canines protrude straight through the closed lips, oversized pointed ears have bald flat inner faces, and smooth bald clay-tan skin patches appear across the snout bridge, cheek, and shoulder.
  - `frame-2-live-wolf-lod-view.png` (`tools/wolf-lod-view.html?shot=gait`, `t = 4.6 s`, `trot 2.6 m/s`): Meshy wolf trotting on an unshadowed green checkerboard with the head angled away from the camera and a severe stretched triangular brown mesh webbing/tearing artifact spanning between the lower forelimbs under `REBIND.on = true`.
  - `frame-3-live-bound-lab.png` (`tools/bound-lab.html?shot=1&plan=hare&speed=8.5`, `t = 2.15 s`, `phase = 0.98`, `EXTENDED SUSPENSION`): Dark stick-figure side view where the orange hind limbs are tightly folded forward in a self-overlapping acute Z-triangle under the hips (`spine flex -0.08 rad`) rather than extended rearward, zero footprints appear below the ground line, and a detached floating tan oval with a single rigid stick represents the head and ear.
- **Does that look natural as described? How do I know?**
  - **No.** Matched documentary wildlife references (`ref-0-grizzly-black-bear-reference.jpg`, `ref-1-gray-wolf-portrait-reference.jpg`, `ref-2-wolf-trot-side-reference.jpg`, `ref-3-snowshoe-hare-bound-reference.jpg`) show vertical columnar bear legs with compact species-distinct claws and ground shadows, a wolf portrait with cleanly closed black lips, unobstructed almond amber eyes, and continuous layered guard hairs, a crisp side-profile wolf trot with slender articulated limbs free of mesh webbing, and a snowshoe hare in extended suspension with hind legs stretched far rearward behind a supple spine.
- **Does what I see in the game resemble the reference to 95%, in timing and position?**
  - **No** (`meanScore = 0.2228`, `0 / 5` calibrated checks pass `>= 0.95`).

## Objectives
- [ ] Fix `src/render/bear.ts` and the four unaudited viewers (`tools/bear-sheet.{html,ts}`, `tools/wolf-portrait.{html,ts}`, `tools/wolf-lod-view.{html,ts}`, `tools/bound-lab.{html,ts}`, plus wolf face/forelimb skinning roots): differentiate Grizzly (`~8.5 cm`) vs American Black Bear (`~4 cm`) front claws, refine bear plantigrade paws/eyes/ears/ground shadows, merge claw geometry, and add `dispose()`; add `ACESFilmicToneMapping` + responsive viewport sizing & non-overlapping labels to `bear-sheet` and `wolf-portrait` (and fix `<title>`), eliminate right-eye z-fighting and closed-mouth tooth poke-through in the procedural wolf portrait; make `wolf-lod-view` render an initial frame on load without monkey-patching global `performance.now`, guard `fetch`/`res.ok` and optional `head` lookup, fix the `REBIND` Meshy forelimb skinning webbing/tearing artifact and side-profile camera framing; and in `bound-lab`, clamp `ts >= 0`, validate `?row`/`?pose` with safe fallbacks, add a `cancelAnimationFrame` stop handle, render visible ground footprints cleanly, and fix hind-limb extended-suspension geometry.
- [ ] Fix `src/world/globe/cloudCover.ts` (and keep parity with `src/world/globe/atmosphere.ts`): replace the private unguarded `smoothstep` with the shared `src/proc/math.ts` helper (guarding `half <= 0` so `cloudCover` never returns `NaN`), initialize `worleyF1` `d = Infinity`, guard `n <= 0` in `cloudCoverStats` and `width <= 0 || height <= 0` in `orbitCloudReport`, unit-normalize `dir` (and guard zero-length vectors) in `orbitSwirl`/`orbitCloudAt`, replace hardcoded `6371`/`40075` with `K.R_earth`, and recalibrate `ORBIT_DECK` / `ORBIT_ZONAL` against MODIS global cloud fraction (`0.67`, King et al. 2013).
- [ ] Fix `rust/boreal-sim/src/boot_order.rs`, `rust/boreal-sim/src/planet_fundamentals/surface/vegetation_fraction.rs`, and `src/world/globe/{bootOrder,hud}.ts` (keeping simulation in Rust per `AGENTS.md`): have `boot_order.rs` enforce/report non-finite planes in `finalize` rather than discarding `let _ = planes_finite(g)` and stop `ELEV.max(0.0)` from masking `NaN` elevations into sea-level pressure; reconcile post-bucket `ROUGH` consistency without breaking the Issue `#47` boot contract; implement `vegetation_fraction.rs` beyond the 2-line `// later` stub; and add finite/positive grid & date/sample input validation to `bootGlobe()`.
- [ ] Fix `tools/{fore-lock-bench,fore-lock-bench-joint,elbow-trace,bound-plans}.ts`, `tools/terrain-ref/{fetch.py,game.py}`, `src/config/live.ts`, and `src/input/padTargets.ts`: guard `SECS <= warm` in `fore-lock-bench.ts`, validate known keys and `Number.isFinite` in `SET` env parsers (removing the `globalThis.lr` leak), reject/warn on unknown plan names in `bound-plans.ts`, replace `111.0 km/deg` in `fetch.py` with WGS84 ellipsoid radii + `with open(...)` + clean imports/CLI args, validate `sys.argv`, binary byte length (`8 + 9*n*n`), and positive `n`/`cell` with `with open(...)` in `game.py`, and guard non-cloneable inputs in `live.ts` plus duplicate-target overwrite handling in `padTargets.ts` — verified with `npm test`, `npx tsc --noEmit`, `notes/skills/viewers-cloudcover-boot-benches-audit.md`, and `>= 0.95` across all `5` calibrated checks in `refs/audit/viewers-cloudcover-boot-benches-audit/audit.ts`.

## Relevant files
- `src/render/bear.ts`
- `tools/bear-sheet.html`
- `tools/bear-sheet.ts`
- `tools/wolf-portrait.html`
- `tools/wolf-portrait.ts`
- `tools/wolf-lod-view.html`
- `tools/wolf-lod-view.ts`
- `tools/bound-lab.html`
- `tools/bound-lab.ts`
- `tools/bound-plans.ts`
- `src/world/globe/cloudCover.ts`
- `src/world/globe/bootOrder.ts`
- `src/world/globe/hud.ts`
- `rust/boreal-sim/src/boot_order.rs`
- `rust/boreal-sim/src/planet_fundamentals/surface/vegetation_fraction.rs`
- `tools/elbow-trace.ts`
- `tools/fore-lock-bench.ts`
- `tools/fore-lock-bench-joint.ts`
- `tools/terrain-ref/fetch.py`
- `tools/terrain-ref/game.py`
- `src/config/live.ts`
- `src/input/padTargets.ts`
- `refs/audit/viewers-cloudcover-boot-benches-audit/audit.ts`
- `refs/audit/viewers-cloudcover-boot-benches-audit/numbers.json`
