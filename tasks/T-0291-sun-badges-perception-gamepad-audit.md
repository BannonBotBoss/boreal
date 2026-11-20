---
id: T-0291
title: Fix solar viewer commented-out bloom/OutputPass & SILSO/physics bugs, badges quiz/cap/CSP & events/livingPack guards, AnimalPicture/sensesHalo/thoughtBubbles/perception & gamepad/padRouter/padMenuLayout defects
author: agy
scratch: false
research: true
skill: sun-badges-perception-gamepad-audit
tags: [sun, badges, events, perception, lod, gamepad, ui, audit]
credits: 52
---
# Fix solar viewer commented-out bloom/`OutputPass` & SILSO/physics bugs, badges quiz/cap/CSP & events/livingPack guards, `AnimalPicture`/`sensesHalo`/`thoughtBubbles`/perception & gamepad/`padRouter`/`padMenuLayout` defects

Status: proposed, unclaimed. Needs another agent's `approve-plan`. Credits = `10 × 4 objectives × (1 + 0.3 research) = 52`.

## Plain-English summary
Live headless Chromium (`1280×720`, SwiftShader, `0` console errors, VP8 WebM recording + 3 solar band frames vs NASA SDO/HMI, SDO/AIA 171 Å, and H-alpha references) plus calibrated deterministic probes (`refs/audit/sun-badges-perception-gamepad-audit/audit.ts` -> `numbers.json`, `calibrationValid = true`, `0 / 5` checks pass `>= 0.95`, `meanScore = 0.1200`) audited four previously untouched subsystems on `origin/main` (`1c024e8a`, zero overlap with `T-0001..T-0290`):

1. **Solar viewer commented-out post-processing passes, stale default SILSO date, missing resize/query guards & spectral/sunspot physics defects (`tools/sun.html`, `src/world/sun/{sunView,bands,spectrum,sunspots}.ts`, `public/data/silso/SN_d_tot_V2.0.csv`)**:
   - `src/world/sun/sunView.ts:62` places a `//` line comment ahead of `; composer.addPass(bloom); composer.addPass(new OutputPass());` on the same line, **silently commenting out both `UnrealBloomPass` (veiling glare) and `OutputPass` (ACESFilmicToneMapping + linear-to-sRGB conversion)**. Live `frame-0-live-sun-visible.png` confirms the inner ~85% of the visible disc hard-clips to flat `[255, 255, 255]` with a harsh peach rim and zero veiling glare, and `frame-1-live-sun-euv171.png` crushes the entire quiet EUV 171 Å solar interior to pitch-black inside a neon-yellow ring with ~15 jagged V-shaped dashes.
   - `sunView.ts:48` defaults `?date=` to `Date.now() - 30d` (`2026-10-21`), which falls past the last entry in `SN_d_tot_V2.0.csv` (`2026-09-30`), yielding `SILSO R = null` and `groups = 0` on default load; `?date=not-a-date` crashes initialization (`invalidDateCrash = true`), and `sunView.ts` has no `resize` listener (`canvasResizedOnViewportChange = false`) and no cleanup/stop handle.
   - `sunView.ts:66` divides all three `rgb` channels uniformly by `limbMean(550)` instead of per-channel `limbMean(610/550/465)`, omits `1 / Math.cos(lat)` longitude scaling on bipole separation (`sunView.ts:72–74`), and drops sunspots under `1 px` with a hard cliff (`sunView.ts:28`); `bands.ts:30` ignores `b.quiet` for all thick bands (`quietBrightness(band('halpha'), 1, 0, ...) = 1.00` instead of `0.90`) and hardcodes `G_SUN = 274` / `R_SUN = 695_700e3` instead of deriving `g_sun` from `K`; `sunspots.ts:35` defines a private duplicate `xorshift32` `rng()`, loses integer precision at `Number('20260930') * 2654435761 = 5.38e16 > Number.MAX_SAFE_INTEGER` (`sunspots.ts:49`), and clamps all historical pre-1996 SILSO dates to Cycle 23 (`cycleAt(1980).cycle = 23`, wrong latitude and Hale polarity); `spectrum.ts:16,43` returns negative Planck radiance for `T < 0` and `[NaN, NaN]` chromaticity below the horizon (`elev < -0.6°`).
2. **Core badges quiz coverage/cap bypass/CSP eval, events `parseContext`/`consumeForage` why-loss, and `enterLiving`/`storedAnimal` validation gaps (`src/core/{badges,events,enterLiving,storedAnimal}.ts`, `src/data/controls.json`)**:
   - `src/data/controls.json` leaves `9 / 10` gated controls (`layer.*`, `camera.*`, `time.rate`, `deeptime.seed`) at `"quiz": "todo"`, leaving only the capstone `constant.G` testable even though `constant.G` requires all 9 other badges first.
   - `badges.ts:30,41` crashes with `TypeError` when `boreal.badges` contains JSON `"null"` (`badgeNullSafe = false`); `earn('look', NaN)` bypasses the per-minute cap indefinitely (`10 / 10` earns > cap `6`) because `Math.floor(NaN) !== Math.floor(NaN)`; `earn('look', 60000, -4)` mints `5` credits instead of `1` because `less` is unclamped; `badges.ts:88` evaluates `answerExpr` with `new Function(...)` (fails strict CSP); `submitTest()` zeros any question with `hints: []` (`0 >= 0`, `emptyHintsScore = 0`) and grants a badge on a 1-question array (`qs.length < pool.perAttempt`, `shortQuizPass = true`).
   - `events.ts:134` throws raw `TypeError` on `parseContext('null')` instead of the documented `'Unsupported or damaged event context'` error; `consumeForage()` (`events.ts:97–101`) drops `previous.why` from `next.records[animal.key]` (`foragePreservesWhy = false`), hardcodes `DEER_AGENT.diet.browse` for every species, and uses a non-re-entrant module-global `lastEatenG`; `interact(..., 'move')` (`events.ts:69–72`) divides by `rockDiameter(e) / 2` without guarding `0`.
   - `enterLiving.ts:56–63` ignores the `species` argument when `handle` is passed (`enterLiving(roster, 'hare', ..., wolfHandle)` silently enters a wolf) and rejects playable `'bear'`; `livingRoster()` (`enterLiving.ts:34–37`) returns its mutable cached singleton array (`rosterImmutable = false`); `readStoredPack()` (`storedAnimal.ts:101–139`) accepts `NaN` ages/needs and ignores trailing garbage bytes (`packRejectsNaNTrail = false`).
3. **`AnimalPicture` opacity-pop & square impostors, dead `arrestGlide` clamp, `sensesHalo` spawn spike, `thoughtBubbles` camera-up & perception validation (`src/render/{animalPicture,animalLadder,sensesHalo,thoughtBubbles}.ts`, `src/core/{sensePictures,perceptionBuffer}.ts`)**:
   - `animalPicture.ts:55–65` (`setOpacity`) sets `material.opacity` on opaque (`transparent: false`) Meshy GLB materials without enabling `transparent = opacity < 0.99`, causing a hard visibility pop at `0.04` instead of crossfading (`#156`); `impostor()` (`animalPicture.ts:152,227–228`) renders untextured solid-colour square `PlaneGeometry(1, 1)` billboards sharing a single max-opacity material per species; `uH` is never used inside the speck vertex shader `main()` (`uHUsedInMain = false`); and `createAnimalPicture` exposes no `dispose()`.
   - `animalLadder.ts:61` (`arrestGlide`) computes `Math.min(glideMs, Math.max(glideMs, hypot))`, which evaluates identically to `8` for every input speed (`arrestGlideV = 8 / 8`).
   - `sensesHalo.ts:43` initializes `lastT = 0, lastX = 0, lastZ = 0`, causing a first-frame velocity spike when spawning near origin (`(0.8, 0.8)` at `t = 0.016` drops ring opacity from `0.320` to `0.058`, an `82%` vanish!), and exposes no `dispose()`.
   - `thoughtBubbles.ts:41` offsets first-person bubbles by world `+Y` instead of camera-up, skips expiring `live` sprites while `!wolf`, and lacks both a sprite cap and `dispose()`.
   - `sensePictures.ts:112,142` emits zero-salience (`0`) sight signals in `signalsFromFrame()` and drops high-strength signals at `cap` instead of evicting the oldest/weakest; `perceptionBuffer.ts:136–184` accepts `NaN`/`Infinity` floats across header/body/emotions/urges/entries.
4. **Gamepad HID fallback/NaN safety, `padRouter` dual-clock & ownership/dispose bugs, and `padMenuLayout` edge-case guards (`src/input/{gamepad,padRouter,padTargets}.ts`, `src/ui/padMenuLayout.ts`)**:
   - `gamepad.ts:33` (`standardPad`) rejects connected non-standard-mapped HID/Bluetooth pads (`mapping === ''` with 16 buttons + 4 axes -> `undefined`); `createPadReader().update(v, NaN)` permanently latches buttons without firing `hold` or `repeat` (`readerNaNSafe = false`).
   - `padRouter.ts:101,120` writes wall-clock `performance.now()` to `yDownAt` while `frame(pad, now)` compares `now - yDownAt >= HOLD_MS` against caller `now` (breaking Y-hold filter wheel under synthetic/test clocks); `drawRadial()` (`padRouter.ts:71`) divides by `n = 0` (`NaN`) on empty `<select>` and interpolates unescaped labels into `innerHTML`; `axis` and `globe` branches (`padRouter.ts:144,151`) return `false` while actively consuming pad inputs; and neither `createPadRouter` nor `startStandaloneRouter` exposes `dispose()`/`stop()`.
   - `padMenuLayout.ts:70–74` (`holdStepCount`) returns `Infinity` when `rate <= 0`; `menuFrame([100, NaN, 200], 720)` returns `{ height: NaN, top: NaN }`; `focusAfterScroll` returns out-of-range/unselectable `focus` (`3`) instead of `-1` when no row is selectable; and `createHoldRepeat.stop(source)` defaults `now = 0`, resetting `t0 = last = 0` on fallback to another held source and firing an immediate spurious double-repeat on the next `tick(1116)` (`stopDoubleRepeat = true`).

## Evidence and cause
Live headless Chromium capture (`tools/sun.html` on temporary Vite preview port `5268`, cleanly stopped with `0` remaining listeners, `0` console/page errors) plus deterministic TypeScript/Node probes in `refs/audit/sun-badges-perception-gamepad-audit/audit.ts` -> `numbers.json`:
- `calibrationValid`: **`true`** (`knownMatchScore = 1.0000`, `knownMismatchScore = 0.0000` on all 5 checks)
- `passCount`: **`0 / 5`**, `meanScore`: **`0.1200`**
- Live screen recording: `refs/audit/sun-badges-perception-gamepad-audit/recording.webm` (`52,528` B, VP8 WebM multi-band live sweep: `visible -> halpha -> euv304 -> euv171 -> euv193 -> xray`)
- Live frames vs real-world solar references:
  - `refs/audit/sun-badges-perception-gamepad-audit/frame-0-live-sun-visible.png` vs `refs/audit/sun-badges-perception-gamepad-audit/reference/ref-0-sdo-hmi-visible-sunspots-reference.jpg`
  - `refs/audit/sun-badges-perception-gamepad-audit/frame-1-live-sun-euv171.png` vs `refs/audit/sun-badges-perception-gamepad-audit/reference/ref-1-sdo-aia-171-corona-reference.jpg`
  - `refs/audit/sun-badges-perception-gamepad-audit/frame-2-live-sun-halpha.png` vs `refs/audit/sun-badges-perception-gamepad-audit/reference/ref-2-halpha-chromosphere-reference.jpg`

### Nature-checked & spec-checked number table
| Quantity | Game (`origin/main` `1c024e8a`) | Nature / Spec Target + Source | Score | Pass? |
|---|---|---|---:|---|
| `sunView.ts:62` `EffectComposer` passes (`UnrealBloomPass` + `OutputPass`) | Both commented out on line 62 (`passes = 1`); disc hard-clips `[255,255,255]` | Both passes active: ACESFilmic + sRGB + veiling glare (Spencer et al. 1995; Three.js r180) | `0.0000` | No |
| Default `tools/sun.html` SILSO date & sunspots | `2026-10-21` > CSV tail `2026-09-30` -> `R = null`, `groups = 0`; `?date=bad` crashes | Clamp default date to latest SILSO day (SILSO V2.0); safe fallback on bad query | `0.0000` | No |
| Thick-band `quietBrightness('halpha', mu=1)` & historical `cycleAt(1980)` | `1.00` (ignores `quiet = 0.90`); `cycle = 23` (`months = -199.2`); private RNG; float64 seed overflow | `0.90` (`b.quiet`, Lemen et al. 2012); Cycle 21 (`1976.5`, Hathaway 2011); shared `proc/rng` & `Math.imul` | `0.0000` | No |
| Gated-control quiz pools (`controls.json`), `badges.ts` cap/CSP/grading | `1 / 10` pools; `earn(NaN)` `10/10` bypass; `less=-4` mints `5`; `new Function`; `hints:[]` -> `0`; 1-Q pass | `10 / 10` pools (OpenStax Astronomy/Physics); finite clamped `earn`; CSP-safe evaluator; full `perAttempt` | `0.0000` | No |
| `events.ts` `consumeForage` `why` & `enterLiving`/`storedAnimal` safety | `why` dropped (`false`); `parseContext('null')` raw `TypeError`; `handle` ignores `species`; mutable roster; `NaN` pack accepted | Preserve `why` (Rule 5); documented `parseContext` error; species check + immutable copy + finite strict `ANM1` | `0.0000` | No |
| `AnimalPicture` crossfade / `arrestGlide` / `sensesHalo` spawn / `perceptionBuffer` | `transparent` unset (hard pop); flat square impostors; `arrestGlide = 8/8`; halo frame-1 opacity `0.058` vs `0.320`; `NaN` perception accepted | True `transparent` crossfade (`#156`), silhouetted impostors, bounded speed clamp, clean spawn `0.320`, finite `#106` validation | `0.0000` | No |
| `gamepad.ts`, `padRouter.ts` & `padMenuLayout.ts` edge guards | Non-std HID rejected; `NaN` `now` latches; `yDownAt` dual clock; `rate=0 -> Infinity`; `NaN` `menuFrame`; `stop()` double-repeat | HID fallback, finite reader, single clock + escaped radial + `dispose()` + true ownership, finite layout & safe `stop(now)` | `0.0000` | No |
| Live solar visual fidelity (`frame-0..2.png` vs `ref-0..2.jpg`, `recording.webm`) | `0` console errors, `3/3` frames, `52,528` B WebM; hard-clipped white/empty black-void EUV/flat orange H-alpha | `>= 95%` visual fidelity to NASA SDO/HMI, SDO/AIA 171 Å & H-alpha references (Rule 6) | `0.6000` | No |

### Frame inspection answers (Rules 6 & 11)
- **What do I see here?**
  - `frame-0-live-sun-visible.png` (`2024-05-10`, `band=visible`, `elev=space`, `SILSO R=172`, `18` groups, `discPx=391`): A circular disc on pure black (`[0,0,0]`) whose inner ~85% is hard-clipped flat white (`[255,255,255]`) ringed by a smooth peach-orange rim; only ~8–10 minuscule 1–3 px dark specks appear inside the clipped white; zero photospheric granulation, zero penumbral structure, and zero soft veiling glare.
  - `frame-1-live-sun-euv171.png` (`band=euv171`, `elev=space`): An almost completely black empty interior inside a thin glowing neon-yellow circle, dotted with ~15 tiny sharp yellow V-shaped/dash polylines; no quiet coronal magnetic carpet, no smooth arching coronal loop fans, and no off-limb polar plumes.
  - `frame-2-live-sun-halpha.png` (`band=halpha`, `elev=space`): A featureless smooth red-orange shaded sphere with ~6 tiny dark pinpricks; zero chromospheric supergranulation network, zero bright plage structure, zero dark filaments, and zero off-limb prominences.
- **Does that look natural as described? How do I know?**
  - **No.** Side-by-side comparison against the three matched scientific references (`ref-0-sdo-hmi-visible-sunspots-reference.jpg`, `ref-1-sdo-aia-171-corona-reference.jpg`, `ref-2-halpha-chromosphere-reference.jpg`) shows the live frames lack ACESFilmic tone mapping and veiling glare (directly traced to the commented-out `bloom` and `OutputPass` on `sunView.ts:62`), crush the quiet EUV corona interior to black, and omit surface/chromospheric/coronal fine structure.
- **Does what I see in the game resemble the reference to 95%, in timing and position?**
  - **No** (`meanScore = 0.1200`, `0 / 5` calibrated checks pass `>= 0.95`).

## Objectives
- [ ] Fix `src/world/sun/{sunView,bands,spectrum,sunspots}.ts` and `tools/sun.html`: uncomment and properly wire `UnrealBloomPass` and `OutputPass` in `sunView.ts:62`, add a `resize` listener + cleanup handle, clamp default `?date=` to the latest SILSO entry and validate `?date`/`?elev`/`?au`, apply per-channel `limbMean(610/550/465)` and `1 / cos(lat)` bipole scaling, add procedural photospheric granulation / chromospheric network & prominences / coronal magnetic carpet & plumes (and smooth sub-pixel spot contrast + balanced EUV limb exposure), honor `b.quiet` in `bands.ts:quietBrightness` & derive `g_sun` from `K`, move `sunspots.ts` onto `src/proc/rng.ts` + 32-bit `Math.imul` hashing + full historical solar cycle minima, and guard `spectrum.ts` `planck()`/`chromaticity()` edge inputs.
- [ ] Fix `src/core/{badges,events,enterLiving,storedAnimal}.ts` and `src/data/controls.json` (respecting `AGENTS.md`: keep any new simulation logic in `rust/boreal-sim` and never grow files in `tests/sim-home-ceiling.json`): add openly-sourced quiz pools for the remaining 9 gated controls, harden `badges.ts` storage parsing against JSON `null`/corrupt payloads, reject non-finite `t` and clamp `less >= 0` in `earn()`, replace `new Function(...)` with a CSP-safe expression evaluator, fix empty-`hints: []` scoring and require `qs.length >= pool.perAttempt` in `submitTest()`; in `events.ts`, guard `parseContext()` against non-object JSON/prototype keys/non-boolean `playerInteracted`, preserve `previous.why` and species diet data in `consumeForage()` without module-global `lastEatenG`, and guard zero `rockDiameter`; in `enterLiving.ts` and `storedAnimal.ts`, verify `species` when `handle` is passed, support playable `'bear'`, return immutable/cloned records from `livingRoster()`, and reject `NaN`/infinite fields and trailing bytes in `readStoredPack()`.
- [ ] Fix `src/render/{animalPicture,animalLadder,sensesHalo,thoughtBubbles}.ts` and `src/core/{sensePictures,perceptionBuffer}.ts`: toggle `material.transparent` cleanly in `animalPicture.ts:setOpacity` for true non-popping LOD crossfade (`#156`), replace flat square `impostor()` quads with alpha-silhouetted per-instance-faded impostors, apply `uH`/DPR scaling in the speck vertex shader `main()`, add `dispose()` to `createAnimalPicture`, `createSensesHalo`, and `createThoughtBubbles`, fix the dead `Math.min(glideMs, Math.max(glideMs, ...))` clamp in `animalLadder.ts:arrestGlide`, initialize `sensesHalo` `lastT/lastX/lastZ` from the first real pose (eliminating the `0.320 -> 0.058` spawn fade spike), use camera-up vector and expire/cap sprites cleanly in `thoughtBubbles.ts`, filter `salience <= 0` and evict weakest/oldest at cap in `sensePictures.ts`, and reject non-finite floats in `perceptionBuffer.ts:readPerception`.
- [ ] Fix `src/input/{gamepad,padRouter,padTargets}.ts` and `src/ui/padMenuLayout.ts`: add safe HID/non-standard fallback in `standardPad()`, guard `NaN` `now` and chord-modifier precedence in `createPadReader()`/`contextPresses()`, unify `padRouter.ts` `yDownAt` onto the `frame()` clock `now`, guard `n === 0` and escape HTML in `drawRadial()`/`drawCam()`, return `true` while `axis`/`globe` actively consume pad input, add `dispose()`/`stop()` handles to `createPadRouter`/`startStandaloneRouter`, and guard `rate <= 0` in `holdStepCount`, `NaN` heights in `menuFrame`, unselectable lists (`-1`) in `focusAfterScroll`, and omitted `now` in `createHoldRepeat.stop()` — verified with `npm test`, `npx tsc --noEmit`, `notes/skills/sun-badges-perception-gamepad-audit.md`, and `>= 0.95` across all `5` calibrated checks in `refs/audit/sun-badges-perception-gamepad-audit/audit.ts`.

## Relevant files
- `tools/sun.html`
- `src/world/sun/sunView.ts`
- `src/world/sun/bands.ts`
- `src/world/sun/spectrum.ts`
- `src/world/sun/sunspots.ts`
- `src/core/badges.ts`
- `src/data/controls.json`
- `src/core/events.ts`
- `src/core/enterLiving.ts`
- `src/core/storedAnimal.ts`
- `src/render/animalPicture.ts`
- `src/render/animalLadder.ts`
- `src/render/sensesHalo.ts`
- `src/render/thoughtBubbles.ts`
- `src/core/sensePictures.ts`
- `src/core/perceptionBuffer.ts`
- `src/input/gamepad.ts`
- `src/input/padRouter.ts`
- `src/ui/padMenuLayout.ts`
- `refs/audit/sun-badges-perception-gamepad-audit/audit.ts`
- `refs/audit/sun-badges-perception-gamepad-audit/numbers.json`
