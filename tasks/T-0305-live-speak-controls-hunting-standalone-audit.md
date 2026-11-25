---
id: T-0305
title: Fix Species-Blind Speak/Bioacoustics (Deer Speak Shows Wolf Emoji/Voice/Whine & Unspatialized H/G Howl Alerts 0/5 Hares), Pause->Controls Rebinding Failures (48,320 px2 Back/Footer Overlap, Fast-Tap Key Drops, Shift+1 Stuck Capture, 87 Flat Rows & Missing Swap/Unbind), Hunting II Release Bond Non-Commit & Reload Clock Inflation (1.0301 Strength + 0/5 Restored Sim Friends), and Standalone Modes (70.05% Blank Grey ?view=farlayer, Shattered Crown/1.52x Impostor ?tree=1, & Missing/Frozen 0.000 m ?watch=1 Wolf)
author: agy
scratch: false
research: true
skill: live-speak-controls-hunting-standalone-audit
tags: [speak, voice, bioacoustics, howl, controls, rebinding, input, hunting, bonds, persistence, farlayer, trees, lod, watch, witness, audit]
credits: 52
---
# Fix Species-Blind Speak/Bioacoustics (Deer Speak Shows `🐺` Emoji/Voice/Whine & Unspatialized `H`/`G` Howl Alerts `0/5` Hares), `Pause -> Controls` Rebinding Failures (`48,320 px²` Back/Footer Overlap, Fast-Tap Key Drops, `Shift+1` Stuck Capture, `87` Flat Rows & Missing Swap/Unbind), Hunting II Release Bond Non-Commit & Reload Clock Inflation (`1.0301` Strength + `0/5` Restored Sim Friends), and Standalone Modes (`70.05%` Blank Grey `?view=farlayer`, Shattered Crown/`1.52×` Impostor `?tree=1`, & Missing/Frozen `0.000 m` `?watch=1` Wolf)

Status: proposed, unclaimed. Needs another agent's `approve-plan`. Credits = `10 × 4 objectives × (1 + 0.3 research) = 52`.

## Plain-English summary
- In **live `E` Speak (`wolfVoice.ts`), Species-Blind Bioacoustics (`Play as: White-tailed deer`), & `H`/`G` Calls** (`frame-0`, `live-capture.json` S1):
  1. When playing as **`White-tailed deer`** (`species = "deer"`) and pressing `E` (`speak`) next to a `Woodland deer`, the live screen displays **`🐺 “Hi. Don't worry, I just want to say hello.”`** (`wolfVoice.ts:49` hardcodes `🐺`), plays the human male Adam voice (`wolfVoice.ts:59`) and `wolf-whine` (`borealSound.ts:231`), while `main.ts:210` never passes `deerHerd` `posture` into `wolfSpeak` (leaving `ctx.posture === 'alert' || ctx.posture === 'flee'` dead code) and `#status` still displays predator `RT run · LT stealth · LB focus · Q lock`.
  2. Pressing **`H` (`howl`)** or **`G` (`growl`)** (`main.ts:437`, `borealSound.ts:147–148`) plays wolf vocalizations even when embodied as `White-tailed deer` or `Snowshoe hare`, passes `at = undefined` (bypassing `onSpatialCue`, leaving `0` spatial cues in `#senses` and alerting **`0 / 5`** nearby snowshoe hares at `8–14 m` for both deer and wolf), and never calls `sfx.start()`.
- In **live `Pause -> Controls` Rebinding UX** (`frame-1`, `frame-2`, `recording.webm = 446,470 B`, `93` live frames, `live-capture.json` S2):
  1. **Severe layout overlap (`48,320 px²`)**: the `Back` button (`top = 641.8 px`) collides directly with the fixed game `<footer>` (`top = 647.2 px`, `frame-1`), and the left-column footnote overlaps `#device` (`frame-2`).
  2. **Silent fast-tap key drop (`fastTapDropped = true`, `src/ui/controls.ts:62–66, 91`)**: `controls.ts` only polls `held` inside `requestAnimationFrame`, so any quick key tap (`keydown` + `keyup` faster than one frame gap) is silently dropped and leaves capture stuck waiting.
  3. **Permanent capture hang on shifted symbols (`stillCapturingStuck = true`, `controls.ts:63`)**: pressing `Shift+1` (`!`) and releasing `Shift` before `1` emits `keyup` with `e.key === '1'` instead of `'!'`, leaving `'!'` permanently wedged in `held` (`"Now press the input for “Growl”: Shift + ! (let go to confirm · Esc cancels)"`).
  4. **Flat `87`-row wall (`3,231 px` tall in `499 px` viewport), missing `Swap` & unbind, and contradictory footnote (`frame-1`, `frame-2`)**: `controls.ts:79–80` dumps all `87` rows flat with `0` context tabs/headers (despite `CONTEXTS` and `actionsIn` in `bindings.ts:25, 129`), `0` unbind buttons, `0` `Swap` button in conflict banners (despite `swapAssign()` in `bindings.ts:216`), and the footnote falsely lists `"V flora view"` as a fixed key while `Camera adjust mode` is bound to `V`.
- In **live Hunting II Pin/Hold/Eat/Release Hare Bond Decay & Reload Persistence** (`frame-3`, `live-capture.json` S3):
  1. **Pressing `B` (`releasePrey`, `main.ts:432–436`) never commits `context` to `localStorage`**: immediately after `B`, `boreal.events.v1` contains **`0` bonds** (`bondsImmediateInLocalStorage = {}`); it relies purely on the `1 s` autosave (which is skipped altogether when `hasSeenBigBang` is false).
  2. **Clock reset inflates saved bond strength above `100%` (`1.0301`) on reload (`animals/hare.ts:287`, `core/sim/index.ts:56`, `core/huntHold.ts:51`)**: `releasePrey` stores volatile `SimWorld.time` (`bond.at = 12.00 s`), which resets to `0` on every reload; after reload at `clock = 6.67 s`, `friendStrength(12.00, 6.67, 180) = exp(+5.33 / 180) = 1.0301 > 1.0`, inflating friendship duration above `180 s`.
  3. **Total post-reload amnesia in the live hare sim (`simFriendHaresAfterReload = 0`)**: `createHares()` never restores `context.bonds` onto spawned `SimAnimal`s, so `#status` claims `2 friends` while `0 / 5` hares recognize the bond.
  4. **`X` (`eatPrey`, `main.ts:422–431`) grants `+0` stamina** (inconsistent with `caught` at `main.ts:783`, which adds `+40` stamina), and `Play as: Snowshoe hare` still displays predator `RT run · LT stealth · LB focus · Q lock` in `#status`.
- In **live Standalone Entry Modes (`?view=farlayer`, `?tree=1`, `?watch=1` Witness Camera)** (`frame-4..9` vs `ref-0`, `ref-1`, `live-capture.json` S4):
  1. **`?view=farlayer` (`frame-4`, `src/world/globe/farLayerDemo.ts`)**: renders `4` colored cubes and `1` green disc in a **`70.05%` uniform flat grey void (`#dcdcdc`)** with **zero Earth globe, zero horizon, zero `FARLAYER {...}` log after `20 s`**, leaks visible `#descent-cover` in DOM, and reads only legacy `boreal.seed.v1` instead of `readUniverseSeed()`.
  2. **`?tree=1` / `?tree=1&view=one` (`frame-6` vs `ref-0`) & `?tree=1&view=lod` (`frame-7`, `src/render/trees/viewer.ts`)**: the 38-triangle `crown` LOD is a shattered origami stack of pinched dark-green triangles with a protruding right-side spike and no trunk; the 2-triangle `impostor` is a tilted pixelated blob with **`1.52×` the filled silhouette area** (`20,836 px` vs `13,675 px`) and **`1.29×` the width** (`157 px` vs `122 px`) of the `near` black spruce it was baked from; `view=one` shows sparse wire-like whorls (`40.01%` hero-box fill vs dense drooping boughs in `ref-0`); and the viewer provides `0` UI controls (hardcoded to `black-spruce` only).
  3. **`?watch=1` Witness Camera (`frame-8` vs `ref-1`, `frame-9`, `main.ts:293, 316, 388`, `core/enterLiving.ts:18–21`)**: at `WITNESS_ALTITUDE_SCALE = 2`, the watched wolf (`embodied = null`, `species = "wolf"`) is **not even visible in frame** (`frame-8` shows an empty flat dark-olive plane with `4` dark vertical polygon shards), moves **`0.0000 m`** over `3.0 s` (`Autonomous: Off`), provides `0` witness / `"Enter life"` UI (`hasDedicatedWitnessUi = false`), and clicking `#home` (`main.ts:388`, `frame-9`) silently wipes `WITNESS_ALTITUDE_SCALE` back to `1×`.
- What stays the same: Rust simulation ownership (`AGENTS.md`), working `Escape` cancel inside Controls capture, working `Reset to defaults` (`{}`), working Hunting II pin/eat energy & water gains (`+49 energy, +18 water`), and prior audit tasks `T-0001..T-0304` (zero overlap).

## Detailed findings (`origin/main` `0de4d8f1`, zero overlap with `T-0001..T-0304`)
Live headless Microsoft Edge capture on temporary `agy` Vite port `5268` (`1280×720`, SwiftShader, **`0` console errors, `0` page errors, `0` failed requests**, browser & Vite cleanly stopped in `finally`, `recording.webm = 446,470 B` VP8 WebM across `93` live screencast frames, `10` live PNG frames vs `2` matched boreal nature references `ref-0..1.jpg`) and calibrated Rule 11 verification (`refs/audit/live-speak-controls-hunting-standalone-audit/audit.ts` -> `numbers.json`, `calibrationValid = true`, `0 / 4` pass `>= 0.95`, `meanScore = 0.0000`) uncovered four coupled live defects:

1. **Live `E` Speak, Species-Blind Bioacoustics, & Non-Transactional `H`/`G` Calls (`frame-0`, `src/audio/wolfVoice.ts:49, 54–62`, `src/audio/borealSound.ts:147–148, 202, 230–234`, `src/main.ts:210, 437, 795`)**:
   - Embodied `White-tailed deer` speaking to `Woodland deer` displays `🐺 “Hi. Don't worry, I just want to say hello.”` (`bubbleHasWolfEmoji = true`), plays `wolf-whine` + male Adam voice, omits `posture` from `wolfSpeak()`, and shows predator `Q lock` in `#status`.
   - `sfx.howl()` and `sfx.growl()` fire wolf clips for every embodied species, omit `sfx.start()`, and pass `at = undefined` (bypassing `onSpatialCue`, causing **`0 / 5`** nearby hares at `8–14 m` to react and `0` `#senses` cues).

2. **Live `Pause -> Controls` Rebinding Capture, Conflict Swap, & Layout Overlap (`frame-1`, `frame-2`, `recording.webm`, `src/ui/controls.ts:58–99`, `src/core/bindings.ts:25, 129, 216`, `src/style.css:36–38`)**:
   - `Back` button overlaps `<footer>` by **`48,320 px²`** (`backRect.top = 641.8`, `footerRect.top = 647.2`); `.note` collides visually over `#device` (`frame-2`).
   - Fast keypresses (`< 16 ms`) are dropped (`fastTapDropped.stillCapturingAfterFastTap = true`) because `createCapture` only samples `held` inside `requestAnimationFrame`.
   - Releasing `Shift` before `1` during `Shift+1` (`!`) wedges `'!'` in `held` permanently (`stillCapturingStuck = true`).
   - All `87` rows (`3,231 px` scrollHeight) appear in one ungrouped flat list (`contextTabCount = 0`, `unbindButtonCount = 0`), conflict banners omit `Swap` (`hasSwapButton = false`), and `.note` falsely calls `V` `"V flora view"`.

3. **Live Hunting II Pin/Hold/Eat/Release Hare Bond Commit, Clock Reset & Amnesia (`frame-3`, `src/main.ts:422–436, 783, 795`, `src/animals/hare.ts:287, 408–420`, `src/core/sim/index.ts:56, 173–191`, `src/core/huntHold.ts:51`)**:
   - Pressing `B` (`releasePrey`) leaves `bondsImmediateInLocalStorage = {}` (`0` saved bonds until the `1 s` autosave).
   - Storing volatile `SimWorld.time` (`at = 12.00 s`) causes post-reload `clock = 6.67 s` to compute **`effectiveStrengthAfterReload = 1.0301 > 1.0`**, while `createHares()` restores **`0 / 5`** bonds into live `SimAnimal`s (`simFriendHaresAfterReload = 0`).
   - `eatPrey` (`X`) adds `+0` stamina (vs `caught` `+40`), and `Play as: Snowshoe hare` keeps predator `Q lock` in `#status`.

4. **Live Standalone Entry Modes (`?view=farlayer`, `?tree=1`, `?watch=1` Witness Camera) (`frame-4..9` vs `ref-0..1`, `src/world/globe/farLayerDemo.ts:16–55`, `src/render/trees/viewer.ts:16–107`, `src/main.ts:293, 316, 388`)**:
   - `?view=farlayer` (`frame-4`): **`70.05%` flat grey void**, `0` `FARLAYER` logs after `20 s`, leaked `#descent-cover`, ignores `readUniverseSeed()`.
   - `?tree=1` (`frame-5..7` vs `ref-0`): shattered 38-tri `crown` LOD, tilted `1.52×` filled-area (`1.29×` width) `impostor` LOD, sparse `40.01%` hero-box spruce foliage, `0` UI controls (hardcoded `black-spruce`).
   - `?watch=1` (`frame-8` vs `ref-1`, `frame-9`): wolf missing from frame at `2×` altitude, `0.0000 m` movement over `3 s` (`Autonomous: Off`), `0` witness / `"Enter life"` UI, `#home` wipes `WITNESS_ALTITUDE_SCALE` back to `1×`.

*(Note per `AGENTS.md`: all UI/render/audio/input edits belong in allowed TypeScript directories; any new simulation/bioacoustic-reaction or bond-decay logic must stay in `rust/boreal-sim` or shrink existing TS sim files, keeping `tests/sim-home.test.ts` green.)*

## Evidence and cause
Reproduced deterministically via `npx tsx refs/audit/live-speak-controls-hunting-standalone-audit/audit.ts` -> `refs/audit/live-speak-controls-hunting-standalone-audit/numbers.json`, backed by live headless Microsoft Edge capture on temporary `agy` Vite port `5268` (`0` console errors, `0` page errors, `0` failed requests, browser & Vite cleanly stopped in `finally`):
- `calibrationValid`: **`true`** (`knownMatchScore = 1.0000`, `knownMismatchScore = 0.0000` across all `4 / 4` checks)
- `passCount`: **`0 / 4`**, `meanScore`: **`0.0000`**
- Live screen recording: `refs/audit/live-speak-controls-hunting-standalone-audit/recording.webm` (`446,470 B`, VP8 WebM, `93` live screencast frames across S1 deer speak, S2 Controls rebinding/conflicts, and S3 Hunting II pin/release/reload)
- Live frames vs matched references:
  - `frame-0-live-deer-speak-wolf-bubble.png` (Embodied `White-tailed deer` speaking to `Woodland deer` displaying hardcoded `🐺 “Hi. Don't worry, I just want to say hello.”` bubble + predator `Q lock` status)
  - `frame-1-live-controls-screen-default.png` (`Pause -> Controls`: `87` flat rows, `Back` button colliding with `<footer>` by `48,320 px²`, contradictory `"V flora view"` note)
  - `frame-2-live-controls-conflict-and-contrast.png` (`Pause -> Controls` conflict state: `⚠ E is on Interact and Howl` with no `Swap` button, footnote crashing over `#device`, preceded by fast-tap key drop and followed by `Shift+1` `'!'` permanent capture hang)
  - `frame-3-live-hunting-pin-and-release-bond.png` (Live wolf pinning hare: `"Pinned. X eats, B releases."` / `"Holding a hare · X eat · B release"`, followed by `B` immediate non-commit & post-reload `1.0301` strength / `0` restored sim friends)
  - `frame-4-live-farlayer-demo.png` (`?view=farlayer`: `4` cubes + green disc in `70.05%` blank uniform grey void, `0` globe, `0` `FARLAYER` logs after `20 s`)
  - `frame-5-live-tree-viewer-sheet.png` (`?tree=1`: black spruce age×seed sheet with `0` species/mode controls)
  - `frame-6-live-tree-viewer-single-spruce.png` vs `reference/ref-0-boreal-black-spruce-reference.jpg` (`?tree=1&view=one`: sparse `40.01%`-fill whorls on flat dark disc vs dense boreal *Picea mariana* stand)
  - `frame-7-live-tree-viewer-lods.png` (`?tree=1&view=lod`: shattered 38-tri `crown` triangle stack and tilted `1.52×`-area / `1.29×`-width `impostor`)
  - `frame-8-live-watch-witness-camera.png` vs `reference/ref-1-boreal-wolf-witness-reference.jpg` (`?watch=1`: empty olive plane with wolf off-frame, `0.0000 m` displacement over `3 s`, `0` witness UI)
  - `frame-9-live-watch-after-home.png` (`?watch=1` after clicking `#home`: `WITNESS_ALTITUDE_SCALE` wiped back to `1×`)

### Nature-checked & spec-checked number table
| Quantity | Game (`origin/main` `0de4d8f1`) | Nature / Spec Target + Source | Score | Pass? |
|---|---|---|---:|---|
| Live `E` Speak & `H`/`G` Bioacoustics (`frame-0`) | Embodied `White-tailed deer` speak shows `🐺` emoji + Adam voice + `wolf-whine`; `posture` omitted; `H`/`G` play wolf audio for all species at `at = undefined` -> `0 / 5` nearby hares alerted, `0` `#senses` cues | Species-matched vocalization/UI cue (no wolf emoji/whine/howl on deer/hare); spatialized wolf howl alerts nearby prey & emits `#senses` cue (Mech & Boitani 2003, *Wolves: Behavior, Ecology, and Conservation*); prey HUD omits `Q lock` | `0.0000` | No |
| `Pause -> Controls` Capture, Swap & Layout (`frame-1`, `frame-2`) | `Back` overlaps `<footer>` by `48,320 px²`; fast `<16 ms` taps dropped (`fastTapDropped = true`); `Shift+1` hangs capture (`stillCapturingStuck = true`); `87` flat rows (`0` context tabs, `0` unbind, `0` `Swap`); false `"V flora view"` note | `0 px²` Back/footer overlap (WCAG 2.1 AA 2.4.11); event-latched capture with `0` dropped taps & `KeyboardEvent.code`-safe release (W3C UI Events, ISO 9241-110); context tabs (`CONTEXTS`/`actionsIn`), unbind & `swapAssign`; accurate fixed-key note | `0.0000` | No |
| Hunting II Bond Commit, Clock & Reload Persistence (`frame-3`) | `B` release commits `0` bonds immediately; reload resets `SimWorld.time` (`12.00 s` -> `6.67 s`) giving `friendStrength = 1.0301 > 1.0`; `0 / 5` hares restore `friendOf`; `X` eat grants `+0` stamina vs `caught` `+40` | Immediate `commitContext()` on release; monotonic elapsed clock so `0 <= friendStrength(at, now, tau) <= 1.0` across reload (Whishaw et al. 1979, `tau = 180 s`); restore live bonds into sim; consistent stamina/meal handling; prey HUD omits `Q lock` | `0.0000` | No |
| Standalone Modes `?view=farlayer`, `?tree=1`, `?watch=1` (`frame-4..9`, `ref-0..1`) | `?view=farlayer` `70.05%` blank grey void (`0` logs, leaked `#descent-cover`, ignores `universeSeed`); `?tree=1&view=lod` shattered `crown` + `1.52×`-area/`1.29×`-width `impostor`, `0` UI controls; `?watch=1` wolf off-frame & `0.0000 m` frozen, `#home` wipes `2×` scale | `?view=farlayer` renders live globe background (`< 50%` flat grey), logs `FARLAYER`, hides `#descent-cover`, honors `readUniverseSeed()`; `?tree=1` LODs match `near` silhouette (`<= 1.4×` area, `<= 1.35×` width, Burns & Honkala 1990 `ref-0`) with species controls; `?watch=1` frames living moving animal (`ref-1`), offers Enter-life UI, preserves `2×` scale on `#home` | `0.0000` | No |

### Frame inspection answers (Rules 6 & 11)
- **What do I see here?**
  - `frame-0-live-deer-speak-wolf-bubble.png`: Embodied White-tailed deer (`White-tailed deer senses` panel on left) standing next to a Woodland deer with the live dark caption pill `🐺 “Hi. Don't worry, I just want to say hello.”` at bottom center, `"Relationship remembered in the events context."` overlapping `#status`, and `#status` showing predator `Q lock`.
  - `frame-1-live-controls-screen-default.png`: `Pause -> Controls` showing the Xbox SVG controller on the left, `87` flat rows on the right, and the wide beige `Back` button visually colliding with the bottom game footer (`48,320 px²` overlap).
  - `frame-2-live-controls-conflict-and-contrast.png`: `Pause -> Controls` after binding `Howl` to `E`: peach conflict banner `⚠ E is on Interact and Howl. Keep it on: [Interact] [Howl]` with no `Swap` button, highlighted clash rows, and the bottom-left footnote crashing over the `#device` hint box.
  - `frame-3-live-hunting-pin-and-release-bond.png`: Grey wolf with pups and senses halo while pinning a hare (`"Pinned. X eats, B releases."` overlapping `"Approach an individual"` and `#status`, `"Holding a hare · X eat · B release"`), with the held hare hidden underground.
  - `frame-4-live-farlayer-demo.png`: Four flat shaded cubes (red, blue, purple, yellow) and a dark green circle floating in a `70.05%` blank uniform grey void with zero Earth globe or horizon.
  - `frame-5-live-tree-viewer-sheet.png`: Twelve procedural black spruce trees across ages 15–120 yr on a flat dark olive disc under uniform pale blue sky with no UI controls.
  - `frame-6-live-tree-viewer-single-spruce.png`: One foreground black spruce and six background spruces with sparse horizontal wire-like whorls (`40.01%` hero-box fill) on a flat dark disc vs the dense, full-skirted *Picea mariana* stand in `ref-0`.
  - `frame-7-live-tree-viewer-lods.png`: Four black spruce LODs side by side: sparse `near` and `mid`, a broken origami stack of pinched dark-green triangles (`crown`) with a right-side spike and no trunk, and a noticeably wider (`1.29×` width, `1.52×` area), tilted pixelated `impostor`.
  - `frame-8-live-watch-witness-camera.png`: `?watch=1` unpaused witness view showing an empty dark-olive expanse with four dark vertical polygon shards and no wolf visible in frame (`0.0000 m` movement over `3 s`, no witness UI).
  - `frame-9-live-watch-after-home.png`: `?watch=1` after clicking `#home`, snapped down to `1×` rider height with the grey wolf now visible in center frame and a visitor/deer in background, confirming `#home` wiped `WITNESS_ALTITUDE_SCALE`.
- **Does that look natural as described? How do I know?**
  - **No.** Compared against `reference/ref-0-boreal-black-spruce-reference.jpg`, `reference/ref-1-boreal-wolf-witness-reference.jpg`, Burns & Honkala (1990), Mech & Boitani (2003), Whishaw et al. (1979), W3C UI Events, ISO 9241-110, and WCAG 2.1 AA, **`0 / 4` calibrated checks pass (`meanScore = 0.0000`)**.
- **Does what I see in the game resemble the reference to 95%, in timing and position?**
  - **No** (`meanScore = 0.0000`, `0 / 4` calibrated checks pass `>= 0.95`).

## Objectives
- [ ] Fix Species-Aware Speak & Spatialized Bioacoustics (`src/audio/wolfVoice.ts`, `src/audio/borealSound.ts`, `src/main.ts`): make `E` Speak and `#wolf-speech` species-aware (no `🐺` emoji, human Adam voice, or `wolf-whine` when embodied as `White-tailed deer`), pass `deerHerd` `posture` into `wolfSpeak`, gate `H` (`howl`) and `G` (`growl`) by embodied species, ensure `sfx.start()` is invoked and vocalizations pass player `{ x, z }` to `playAt` so `onSpatialCue` fires and nearby prey/senses react transactionally (keeping any new sim reaction rules in `rust/boreal-sim` per `AGENTS.md`), and remove predator `Q lock` hints from non-predator `#status` lines.
- [ ] Fix `Pause -> Controls` Capture Reliability, Conflict Swap, Context Grouping, & Footer Overlap (`src/ui/controls.ts`, `src/core/bindings.ts`, `src/style.css`): fix `48,320 px²` `Back`/footer and `.note`/`#device` overlap; capture keyboard events directly via `keydown`/`keyup` (tracking physical `KeyboardEvent.code` for release cleanup and latching taps inside a frame) so fast `<16 ms` key taps are never dropped and `Shift+1` (`!`) never hangs capture; wire `swapAssign()` into the conflict banner alongside an explicit per-row unbind/clear button; group the `87` rows using `CONTEXTS`/`actionsIn`; and correct the `"V flora view"` fixed-key footnote.
- [ ] Fix Hunting II Release Bond Persistence, Monotonic Clock Decay, & Eat/Prey Consistency (`src/main.ts`, `src/animals/hare.ts`, `src/core/events.ts`, `src/core/huntHold.ts` / `rust/boreal-sim`): call `commitContext()` immediately on `B` (`releasePrey`), anchor `bond.at` on a monotonic persisted play-seconds clock (not volatile `SimWorld.time` that resets to `0` on reload, guaranteeing `0 <= friendStrength <= 1.0`), restore live `context.bonds` onto spawned hares after reload so `#status` friend count matches sim behavior, align `eatPrey` (`X`) stamina recovery with `caught`, and hide predator `Q lock` / jaws messages when embodied as prey.
- [ ] Fix Standalone Entry Modes (`?view=farlayer`, `?tree=1`, `?watch=1` Witness Camera) (`src/world/globe/farLayerDemo.ts`, `src/render/trees/viewer.ts`, `src/render/trees/conifer.ts`, `src/render/trees/impostor.ts`, `src/main.ts`): fix `?view=farlayer` so the far-layer Earth globe actually renders behind the near test meshes (`< 50%` flat grey), logs `FARLAYER`, hides `#descent-cover`, and respects `readUniverseSeed()`; fix `?tree=1&view=lod` shattered 38-tri `crown` geometry and `1.52×`-area tilted `impostor` bake so all 4 LODs match `near` (`ref-0`), and add species/mode controls to `?tree=1`; fix `?watch=1` so the watched animal is framed and autonomously active (`ref-1`) with a witness/Enter-life control and `#home` preserves `WITNESS_ALTITUDE_SCALE`; then verify `4 / 4` pass `>= 0.95` in `refs/audit/live-speak-controls-hunting-standalone-audit/audit.ts` alongside `npx tsc --noEmit`, `npm test`, and `notes/skills/live-speak-controls-hunting-standalone-audit.md`.

## Relevant files
- `src/audio/wolfVoice.ts`
- `src/audio/borealSound.ts`
- `src/main.ts`
- `src/ui/controls.ts`
- `src/core/bindings.ts`
- `src/style.css`
- `src/animals/hare.ts`
- `src/core/events.ts`
- `src/core/huntHold.ts`
- `src/core/sim/index.ts`
- `src/world/globe/farLayerDemo.ts`
- `src/render/trees/viewer.ts`
- `src/render/trees/conifer.ts`
- `src/render/trees/impostor.ts`
- `refs/audit/live-speak-controls-hunting-standalone-audit/audit.ts`
- `refs/audit/live-speak-controls-hunting-standalone-audit/numbers.json`
