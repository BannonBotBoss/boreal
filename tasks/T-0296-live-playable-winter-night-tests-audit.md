---
id: T-0296
title: Fix streamed continuousTerrain buildLeaf zero midwinter snow (0.05% snow at 34.4 cm) & floating visitor/static midnight sky, playable deer/hare sunk hooves/off-screen camera/hardcoded canid footing & predator HUD/#home +2pi spin, senses.css 0px mobile stream collapse & off-center compass, and 6 Windows npm test failures/3 skips/12 stale passing gait TODOs
author: agy
scratch: false
research: true
skill: live-playable-winter-night-tests-audit
tags: [snow, winter, night, sky, playable, deer, hare, camera, hud, css, tests, windows, audit]
credits: 52
---
# Fix streamed `continuousTerrain.ts` `buildLeaf` zero midwinter snow (`0.05%` snow at `34.4 cm`) & floating visitor/static midnight sky, playable deer/hare sunk hooves/off-screen camera/hardcoded `canid` footing & predator HUD/`#home` `+2π` spin, `senses.css` `0 px` mobile `.sense-stream` collapse & off-center compass, and `6` Windows `npm test` failures/`3` skips/`12` stale passing gait TODOs

Status: proposed, unclaimed. Needs another agent's `approve-plan`. Credits = `10 × 4 objectives × (1 + 0.3 research) = 52`.

## Plain-English summary
- In midwinter (`?day=15&hour=12`), the HUD reports **`Snow 34.4 cm`**, yet the live ground renders completely dark muddy olive-green (`0.05%` snow-bright pixels, `94.1%` green-dominant mud, mean luminance `0.24`) with summer flowers and a blocky human Visitor floating in the sky — because the live streamed terrain builder (`buildLeaf` in `src/render/continuousTerrain.ts`) allocates an all-zero `snow` attribute array and never fills it.
- Playing as a **White-tailed Deer (`?play=deer`)** renders the deer sunk up to its knees/hocks with zero visible hooves and a half-buried wolf behind it; playing as a **Snowshoe Hare (`?play=hare`)** aims the camera (`0.544 m` high) completely over the `0.25 m` hare so the animal is invisible off-screen; both herbivores still receive hardcoded wolf `'canid'` footing (`3.29×` too low foot pressure for deer, `1.73×` wrong for hare), wolf `2.4 km` scent range, and wolf predator controls (`LT stealth · Q lock`, `X eat held · B release`); and clicking **Return to start** (`#home`) spins `yaw` by `+2π` without leaving the bank spot.
- At midnight (`?day=227&hour=0`), the night sky renders as coarse horizontal monochrome TV-static noise with `0` bright star pixels and zero moon, while white `"Explore"` text sits illegibly over the beige status box (`12,350 px²` overlap).
- In `src/ui/senses.css` (one of the last unaudited files in `src/`), switching `.sense-panel` to `flex-direction: column` under `max-width: 700px` causes `.sense-stream` (`flex: 1`) to collapse to **`0 px` height**, hiding `100%` of sense pictures on narrow/mobile viewports; the compass north arrow is `4.9–5.4 px` left of center, and desktop bubbles clip `22 px` past the stream edge.
- Running `npm test` on Matthew's Windows PC fails **`6` tests** right on `origin/main` (`4bed306c`) due to Windows path/EOL bugs and a CPU-load race, skips **`3`** `agent-review` tests on Windows, keeps **`12` already-passing live wolf gait tests muted** behind stale `TODO` flags (`T-0003` landed weeks ago), and spends **`157.74 s`** inside a single climate test (`95%` of the `166.04 s` wall time).
- What stays the same: all keyboard, mouse, and gamepad bindings, Rust simulation ownership (`AGENTS.md`), and the unit-tested physics/ecology models.

## Detailed findings (`origin/main` `4bed306c`, zero overlap with `T-0001..T-0295`)
Live headless Microsoft Edge capture on temporary Vite port `5263` (`1280×720` + `640×720` mobile, SwiftShader, browser and server cleanly closed in `finally`, `0` console/page errors, `recording.webm = 73,882 B`, `5` live PNG frames vs `3` matched documentary natural references), full `npm test` suite execution (`1,367` tests, `166.04 s` wall / `1,317.5 s` CPU), and calibrated Rule 11 measurement (`refs/audit/live-playable-winter-night-tests-audit/audit.ts` -> `numbers.json`, `calibrationValid = true`, `0 / 4` checks pass `>= 0.95`, `meanScore = 0.0938`) uncovered four coupled live-gameplay, visual, CSS, and test-integrity defects:

1. **Streamed Midwinter Terrain Drops `100%` of Ground Snow (`0.05%` snow pixels at `34.4 cm`), Floating Winter Visitor & Static-Noise Midnight Sky (`src/render/continuousTerrain.ts:255–327`, `tests/snow-cover.test.ts`, `src/render/buildScene.ts:505–507`, `src/render/sky.ts`)**:
   - **Root cause of zero live winter snow**: `buildContinuousMesh` (`continuousTerrain.ts:189,215`) computes `snowHere = snowPaint(snowDepthCm(weatherAt(camX, camZ).sweMm))` and writes `snow[i] = snowHere`, **but `buildLeaf` (`continuousTerrain.ts:255–327`, the actual streamed leaf builder used live since `T-0261`) allocates `const snow = new Float32Array(per)` on line 270 and NEVER assigns `snow[i]` anywhere in lines 281–322!**
   - `tests/snow-cover.test.ts` tests only `buildContinuousMesh`, never `buildLeaf` or `createContinuousTerrain`, so CI never caught that `100%` of streamed leaves carry `aSnow = 0`.
   - **Pixel measurement (`frame-2-winter-snow-noon.png`, `?day=15&hour=12`, HUD = `Snow 34.4 cm`)**: across the central ground region (`y = 48–85%`, `x = 22–78%`), only **`0.05%`** (`0.0005`) of pixels are snow-bright neutral (`lum >= 0.65`, chroma `< 35`), **`94.1%`** (`0.941`) are green-dominant olive mud, and mean ground luminance is **`0.2436`** (vs real January snowpack albedo `0.75–0.85`, Wiscombe & Warren 1980). Summer grass and white flowers poke through muddy ground, logs have `0` snow, and a blocky human Visitor levitates high in the sky above the horizon (`buildScene.ts:507` places visitors at `heightAt(x,z) - drop` without `curvatureDrop(r)` / horizon agreement).
   - **Midnight sky & night HUD (`frame-3-midnight-night-sky.png`, `?day=227&hour=0`, `00:04`)**: across `69,056` sampled upper-sky pixels, **`0`** bright star pixels (`lum > 180`) appear — only coarse horizontal monochrome static noise (`MAD = 2.651` luminance/px) and no wolf/pups visible. Meanwhile `body.night` flips `#target` (`Explore`) text white while `#status` remains pale cream, producing illegible white-on-cream text across a **`12,350 px²`** overlap.

2. **Live Playable Species (`?play=deer`, `?play=hare`) Visual/Camera Failures, Hardcoded Wolf Footing/Scent/HUD & `#home` `+2π` Yaw Spin (`src/main.ts:339,385–389,409,795`, `src/render/playables.ts:33–55`, `src/render/math.ts:31–44`, `src/ui/senses.ts:121`)**:
   - **Playable Snowshoe Hare is 100% invisible off-screen (`frame-1-play-hare.png`, `?play=hare`)**: `playables.ts:44` sets `cameraHeight: 0.8`, which scales `positionCamera` (`render/math.ts:33–43`) to `back = 4.0 × (0.8 / 2.2) = 1.455 m` at height `0.8 m` looking down at `DEFAULT_PITCH = 10°`. The optical axis passes **`0.544 m`** above the ground at the player's position — well over the head of a `~0.25 m` snowshoe hare, leaving the player staring at empty mustard dirt.
   - **Playable White-tailed Deer has buried legs/hooves (`frame-0-play-deer.png`, `?play=deer`, `recording.webm = 73,882 B`)**: the rendered deer stands sunk up to its knees/hocks in the flat ochre ground with zero visible hooves or ground contact shadow, with a wolf half-buried up to its shoulders directly behind it.
   - **Hardcoded wolf `'canid'` footing (`src/main.ts:339`)**: `footing(column(player.x, player.z), playerMass, 'canid', gravity())` ignores `view.playable.id` even though `src/core/ground.ts:67` defines `FOOT.{canid,cervid,ursid,leporid}`:
     - White-tailed deer (`68 kg`): receives **`16.13 kPa`** instead of **`53.00 kPa`** (**`3.29×` too low**, sinking `7.12 cm` instead of `10.04 cm`; Telfer & Kelsall 1984 / Parker et al. 1984 deer hoof loading `~45–65 kPa`).
     - Snowshoe hare (`1.5 kg`): receives **`0.36 kPa`** instead of **`0.61 kPa`** (`1.73×` mismatch; real winter snowshoe hare foot loading `~0.8–1.5 kPa`, Murray & Boutin 1991).
     - Grizzly bear (`180 kg`, `available: false` in `playables.ts:35`): would receive **`42.70 kPa`** instead of **`11.78 kPa`** (`3.62×` too high).
   - **Hardcoded wolf scent range & predator HUD on herbivores**: `src/ui/senses.ts:121` passes `WOLF_AGENT.senses.scent.range` (`2,400 m`) for deer and hares; `main.ts:795` & `409` display `RT run · LT stealth · LB focus · Q lock` and `X eat held · B release` for herbivores that cannot stealth-hunt or hold hares.
   - **`Return to start` (`#home`, `src/main.ts:385–389`)**: clicking `#home` calls `dropStand({ x: 0, z: 0 }, -0.35)` instead of returning to the start menu or resetting to the species' living spawn; in `live-capture.json` `4-mobile-senses-and-ui`, `playerProbe` moved from `(65.4, -18.6, yaw 8.3373)` to `(65.4, -18.6, yaw 14.6205)` — an exact **`+6.2832 rad` (`+2π`)** yaw spin at the same coordinates!

3. **Unaudited `src/ui/senses.css` Collapses `.sense-stream` to `0 px` on Mobile (`<= 700px`), Off-Center Compass Arrow, Horizontal Bubble Clipping & `status`/`interaction` HUD Overlaps (`src/ui/senses.css:1–17`, `src/ui/senses.ts:58–60`, `src/main.ts:98–115`)**:
   - **Total mobile disappearance of sense pictures (`frame-4-mobile-senses-and-ui.png`, `640×720`)**: `senses.css:11` sets `.sense-stream{flex:1;height:132px;overflow:hidden}` (`flex: 1 1 0%`). At `@media(max-width:700px)` (`senses.css:17`), `.sense-panel` switches to `flex-direction: column` while `.sense-stream` keeps `flex-basis: 0%` (overriding `height: 108px`), collapsing `.sense-stream` to **`0 px` height** (`boxes.stream = null` in `live-capture.json`) so `100%` of scent/sound/sight bubbles vanish on narrow/mobile screens!
   - **Off-center compass arrow & bubble clipping**: `.sense-compass:before` hardcodes `left: 30px` (`width: 6.14 px` in `76 px` circle -> **`4.93 px` left of center**) and `left: 25px` on mobile (`width: 5.20 px` in `66 px` circle -> **`5.40 px` left of center**) instead of `left: 50%; transform: translateX(-50%)`. On desktop, `.sense-stream` is `142 px` wide (`half = 71 px`), while `senses.ts:60` translates `42 px` bubbles out to `±72 + 21 = 93 px` -> clipping **`22 px`** off both sides.
   - **Live HUD collisions**: `#interaction` (`Explore / Approach an individual`) overlaps `#status` by **`12,350 px²`** (`frame-2`, `frame-3`), **`10,070 px²`** (`frame-1`), and **`6,080 px²`** (`frame-4`, `640×720`).

4. **Windows `npm test` Breakage (`6` Failures, `3` Skips), `12` Stale Passing `gait-data.test.ts` TODOs & `157.74 s` Single-Test Wall-Time Bottleneck (`origin/main` `4bed306c`)**:
   - Running `npm test` directly on Windows (`1,367` tests, `166.04 s` wall / `1,317.5 s` CPU) yields **`6` failures**:
     1. `tests/core.test.ts:5`: `new URL('../public' + DEFAULT_BAKE, import.meta.url).pathname` -> `ENOENT 'C:\C:\dev\...\public\bake\earth-hot.bin'` (crashes entire test file at import; should use `fileURLToPath`).
     2. `tests/callField.test.ts:286`: `join(dirname(new URL(import.meta.url).pathname), '../refs/T-0017/score.json')` -> `ENOENT mkdir 'C:\C:\dev\...\refs\T-0017'` (should use `fileURLToPath`).
     3. `tests/constants.test.ts:48`: strict string comparison of CRLF-checked-out `rust/boreal-sim/src/constants.rs` against LF `rustSource()`.
     4. `tests/hare-mesh.test.ts:94`: compares raw `path.join` `'public\\models\\animals\\snowshoe-hare.glb'` against POSIX `'public/models/animals/snowshoe-hare.glb'`.
     5. `tests/planet-layout.test.ts:53`: `p.slice(p.indexOf('rust/boreal-sim'))` evaluates `p.slice(-1)` -> `['s']` on Windows backslashes!
     6. `tests/descent-frame.test.ts:174`: CPU-load race flake (`AssertionError: 300 m still streaming: 30 !== 0` during parallel `npm test`, passes in isolation).
   - **`3` Windows skips**: `tests/agent-review.test.ts` skips all `3/3` tests on Windows (`# fake gh needs a POSIX shebang`).
   - **`12` stale muted `TODO` tests in `tests/gait-data.test.ts`**: `4` `TODO` call sites (`9` speed rows + `sweep@9.2` + `rotary footfall` + `gathered suspension` = `12` live `gaitFor` tests) remain muted citing `"depends on T-0003"`, yet direct evaluation against live `gaitFor` proves **`12 / 12` already pass** (cadence & stride within ±15% of Bryce & Williams 2017 / Heglund & Taylor 1988, `sweep@9.2 = 0.742 m` vs `0.67 m` Walter & Carrier 2007, rotary order `[1,3,2,0]`, gathered suspension `0.180 >= 0.10`), leaving CI blind to live wolf gait regressions. Meanwhile `tests/earth-system.test.ts:42` retains a `test.todo` for global energy closure (`95.8` vs `161 W/m²` absorbed; `Ts 5°C` vs `15°C`).
   - **Wall-time bottleneck**: a single test (`tests/climate-class.test.ts:209`) takes **`157.74 s`** (`95.0%` of the `166.04 s` wall time), and `53` tests `> 5 s` consume **`1,180.6 s`** (`89.6%` of total test CPU).

## Evidence and cause
Reproduced deterministically via `npx tsx refs/audit/live-playable-winter-night-tests-audit/audit.ts` -> `refs/audit/live-playable-winter-night-tests-audit/numbers.json`, backed by live headless Edge capture on temporary Vite port `5263` (`0` console/page errors, browser & server cleanly closed in `finally`) and full `npm test` run on `origin/main` (`4bed306c`):
- `calibrationValid`: **`true`** (`knownMatchScore = 1.0000`, `knownMismatchScore = 0.0000` on all 4 checks)
- `passCount`: **`0 / 4`**, `meanScore`: **`0.0938`**
- Live screen recording: `refs/audit/live-playable-winter-night-tests-audit/recording.webm` (`73,882` B, VP8 WebM `?play=deer` walk & turn)
- Live frames vs matched natural references:
  - `frame-0-play-deer.png` vs `reference/ref-0-white-tailed-deer-boreal-forest.jpg`
  - `frame-1-play-hare.png` vs `reference/ref-1-snowshoe-hare-boreal-floor.jpg`
  - `frame-2-winter-snow-noon.png` vs `reference/ref-2-boreal-winter-snow-noon.jpg`
  - `frame-3-midnight-night-sky.png` (midnight static sky + white-on-cream `Explore` overlap)
  - `frame-4-mobile-senses-and-ui.png` (`640×720` mobile `0 px` `.sense-stream` collapse)

### Nature-checked & spec-checked number table
| Quantity | Game (`origin/main` `4bed306c`) | Nature / Spec Target + Source | Score | Pass? |
|---|---|---|---:|---|
| Midwinter live ground snow (`?day=15&hour=12`, HUD `34.4 cm`) & midnight sky (`?day=227&hour=0`) | `buildLeaf` writes `0` snow (`aSnow = 0`); ground `0.05%` snow px, `94.1%` olive-green mud, mean lum `0.2436`; floating Visitor in sky; midnight sky `0` star px (`69,056` px sampled), `MAD = 2.651` static noise; `12,350 px²` white-on-cream `Explore`/`#status` overlap | `>= 34 cm` January snowpack covers forest floor (`albedo 0.75–0.85`, Wiscombe & Warren 1980, J. Atmos. Sci. 37:2734; `ref-2`); visitors seated on terrain; clear starlit night sky (`>= 5` crisp stars, no TV static) & readable night HUD | `0.0000` | No |
| Playable species (`?play=deer`, `?play=hare`), footing, camera & `#home` | Deer sunk up to knees/hocks + buried wolf; hare invisible off-screen (`aimY = 0.544 m` vs `0.25 m` hare height); hardcoded `'canid'` footing (`deer 16.13` vs `53.00 kPa` [`3.29×`], `hare 0.36` vs `0.61 kPa` [`1.73×`]); `2.4 km` wolf scent range & predator HUD on herbivores; `#home` spins yaw `+6.2832 rad` (`+2π`) | Full standing deer hooves (`ref-0`) & hare in frame (`ref-1`); species-accurate foot loading (Telfer & Kelsall 1984 deer `~50 kPa`, Murray & Boutin 1991 hare `~1 kPa`, Mech 1970 wolf `~10 kPa`); species-appropriate scent range & HUD; clean `#home` reset | `0.3750` | No |
| `src/ui/senses.css` mobile/desktop & HUD layout | Mobile `640×720` `.sense-stream` collapses to `0 px` (`null`, `flex: 1` in column); compass arrow off-center by `4.93 px` desktop / `5.40 px` mobile; bubbles reach `±93 px` in `±71 px` stream (`22 px` clip); `status`↔`interaction` overlap up to `12,350 px²` | Visible non-zero mobile `.sense-stream` (`>= 108 px`), centered compass arrow (`<= 1.5 px`), unclipped sense bubbles, `0 px²` HUD overlap across `640×720` & `1280×720` | `0.0000` | No |
| Windows `npm test` portability, skips & stale TODOs | `6` failing tests on Windows (`core`, `callField`, `constants` CRLF, `hare-mesh`, `planet-layout` `['s']`, `descent-frame` race), `3` Windows skips (`agent-review`), `12` stale muted passing `gait-data` TODOs + `1` `earth-system` TODO, `157.74 s` single test (`95%` of `166.04 s` wall) | `0` Windows failures (`fileURLToPath`, normalized `/` & EOL), `0` platform skips, all `12` passing Bryce & Williams (2017) / Heglund & Taylor (1988) / Walter & Carrier (2007) live gait checks active in CI, bounded test runtime | `0.0000` | No |

### Frame inspection answers (Rules 6 & 11)
- **What do I see here?**
  - `frame-0-play-deer.png` (`?play=deer`, `1280×720`): A brown white-tailed deer stands in center frame on a flat featureless mustard-brown plane, with all four lower legs/hooves buried below ground up to the knees/hocks and zero ground shadow; directly behind the deer, a grey wolf sits half-buried up to its shoulders. Sparse dark vertical tree poles with horizontal green herringbone slats stand on the horizon, `#status` shows wolf stealth/lock hints, and the compass north arrow sits visibly left of center.
  - `frame-1-play-hare.png` (`?play=hare`, `1280×720`): Empty flat mustard-brown ground with sparse yellow-green grass blades and three bare tree poles — the playable snowshoe hare is completely absent/invisible out of frame. `"Explore / Approach an individual"` stamps directly over `#status` (`10,070 px²` overlap).
  - `frame-2-winter-snow-noon.png` (`?day=15&hour=12`, `1280×720`): Although `#status` reads `12:04 · WALK · Snow 34.4 cm`, the entire terrain is dark muddy olive-green (`0.05%` snow pixels, `94.1%` green-dominant) covered with green grass and white summer flowers. Two bare brown logs lie snowless mid-left, a blocky human Visitor floats high in the pale overcast sky on the left, the wolf's rear paws sink into the ground, and `"Explore / Approach an individual"` overlaps `#status` by `12,350 px²`.
  - `frame-3-midnight-night-sky.png` (`?day=227&hour=0`, `1280×720`): Flat dark olive-brown ground meets a harsh horizontal band of monochrome TV-static noise with `0` stars and no moon; no wolf or pups are visible, and white `"Explore"` text sits illegibly over the pale cream `#status` box (`12,350 px²` overlap).
  - `frame-4-mobile-senses-and-ui.png` (`640×720`): Under `.wolf-senses`, the `.sense-panel` shows only the left compass circle inside an empty dark box because `.sense-stream` collapsed to `0 px` height (`null`), while `"Explore / Approach an individual"` collides with `#status` (`6,080 px²` overlap) and `Data (U)` overlaps `Boreal`.
- **Does that look natural as described? How do I know?**
  - **No.** Against `reference/ref-0-white-tailed-deer-boreal-forest.jpg` (standing deer with full slender legs/hooves on mossy granite & birch/spruce understory), `reference/ref-1-snowshoe-hare-boreal-floor.jpg` (alert eye-level snowshoe hare on mossy clover forest floor), and `reference/ref-2-boreal-winter-snow-noon.jpg` (deep white sunlit January snowpack blanketing floor, logs, and spruce boughs under a crisp winter sky), the game frames miss ground snow entirely, bury deer limbs, lose the playable hare off-screen, levitate visitors, and fill the midnight sky with static noise.
- **Does what I see in the game resemble the reference to 95%, in timing and position?**
  - **No** (`meanScore = 0.0938`, `0 / 4` calibrated checks pass `>= 0.95`).

## Objectives
- [ ] Populate `aSnow` in streamed `continuousTerrain.ts` `buildLeaf` (`src/render/continuousTerrain.ts`, `tests/snow-cover.test.ts`, `src/render/buildScene.ts`, `src/render/sky.ts`): pass/sample `snowPaint(snowDepthCm(weatherAt(...).sweMm))` into every vertex (and skirt) built by `buildLeaf`, extend `tests/snow-cover.test.ts` to cover `buildLeaf` & `createContinuousTerrain`, seat Visitors consistently with terrain curvature/height so none float in the sky, replace the midnight static-noise sky band with a crisp starfield/moon, and fix `body.night` contrast/positioning so `"Explore"` never renders white-on-cream over `#status`.
- [ ] Fix live playable species (`?play=deer`, `?play=hare`) camera framing, limb grounding, species-accurate footing/scent/HUD, and `#home` (`src/render/playables.ts`, `src/render/math.ts`, `src/render/buildScene.ts`, `src/main.ts`, `src/ui/senses.ts`): lower/aim the Snowshoe Hare third-person camera so the hare sits visibly in frame (`aimY < 0.30 m`), ground the playable White-tailed Deer hooves cleanly on the terrain surface (and keep NPC wolves grounded), pass the active species' body plan (`canid`/`cervid`/`leporid`/`ursid`) to `footing()` in `main.ts:339` and species scent range to `deltaSources()` in `senses.ts:121`, hide wolf-only stealth/lock/eat-held HUD hints when playing as herbivores, and fix `#home` (`Return to start`) so it resets cleanly without adding `+2π` to `yaw`.
- [ ] Fix `src/ui/senses.css` mobile `.sense-stream` collapse, compass centering, bubble bounds, and `#status`/`#interaction` overlaps (`src/ui/senses.css`, `src/ui/senses.ts`, `src/main.ts`, `src/style.css`): set `flex: none; height: 108px` on `.sense-stream` inside `@media(max-width:700px)` so sense pictures stay visible on narrow viewports, center `.sense-compass:before` and `.sense-cue:before` with `left: 50%; transform: translateX(-50%)`, clamp horizontal bubble travel inside `.sense-stream` width minus bubble radius, and prevent `#interaction` from overlapping `#status` across `640×720` and `1280×720`.
- [ ] Fix Windows `npm test` portability (`6` failures + `3` skips), unmute the `12` passing live wolf gait tests, and cut the `157.74 s` test bottleneck (`tests/{core,callField,constants,hare-mesh,planet-layout,descent-frame,agent-review,gait-data,climate-class}.test.ts`): use `fileURLToPath` in `core.test.ts` & `callField.test.ts`, normalize CRLF in `constants.test.ts` and path separators in `hare-mesh.test.ts` & `planet-layout.test.ts`, remove the CPU-load flake in `descent-frame.test.ts`, make `agent-review.test.ts` run cross-platform on Windows via `.cmd`/Node shim, unmute the `12` already-passing `LIVE` rows in `tests/gait-data.test.ts`, reduce `climate-class.test.ts:209` wall time, and verify `>= 0.95` across all `4` calibrated checks in `refs/audit/live-playable-winter-night-tests-audit/audit.ts` plus clean `npm test`, `npx tsc --noEmit`, and `notes/skills/live-playable-winter-night-tests-audit.md`.

## Relevant files
- `src/render/continuousTerrain.ts`
- `src/render/snowCover.ts`
- `src/render/sky.ts`
- `src/render/buildScene.ts`
- `src/render/playables.ts`
- `src/render/math.ts`
- `src/main.ts`
- `src/ui/senses.ts`
- `src/ui/senses.css`
- `src/core/ground.ts`
- `tests/snow-cover.test.ts`
- `tests/core.test.ts`
- `tests/callField.test.ts`
- `tests/constants.test.ts`
- `tests/hare-mesh.test.ts`
- `tests/planet-layout.test.ts`
- `tests/descent-frame.test.ts`
- `tests/agent-review.test.ts`
- `tests/gait-data.test.ts`
- `tests/climate-class.test.ts`
- `refs/audit/live-playable-winter-night-tests-audit/audit.ts`
- `refs/audit/live-playable-winter-night-tests-audit/numbers.json`
