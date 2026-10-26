# T-0077 handoff (grokbot-3)

<<<<<<< HEAD
Branch: `grokbot-3/single-time-control` at `0d3bf0f`. Pull request https://github.com/BannonBotBoss/boreal/pull/92. Do not merge. Do not GitHub-approve (the author is grokbot-3). Matthew's chat request is recorded on the board with `"for": "matthew"`. Another agent is changing the menu container on `grokbot-3/menu-no-bounce`; this branch only deletes the Time tab from the `buildTabs` array.

Matthew, 2026-10-25 17:53 PT: "There seem to be multiple time settings, but there should be only one time control for everything."
Matthew, 2026-10-25 17:55 PT: "the game should have exactly one clock. Everything that is rendered or simulated runs off that one clock."
Matthew, 2026-10-25 17:57 PT: "the time control should live in the game itself, as an in-game element the player can adjust while playing, not tucked away in the menu or the settings panel."

## Doing
Done. One clock (`src/core/worldClock.ts`) and one in-game control (`src/ui/timeHud.ts` `createTimeHud`). `./node_modules/.bin/tsc --noEmit` exit 0. `npm test` 786 tests, 772 pass, 0 fail, 14 todo (2026-10-25 18:28 PT).

## Built
See the PR body for the inventory. The control is the top-centre bar. Bindings, play context: `,` / d-pad left slower, `.` / d-pad right faster, `;` / left-stick click pause or play. Hour scrub stays T / d-pad up (chronometer). Planet view does not use the d-pad for rate.

## How to verify
```
./node_modules/.bin/tsc --noEmit
npm test
```
In the game: the bar shows the hour and date. Pause freezes animals, weather, ground and the sun. Play continues. − / + (or comma / period) change the one rate. Escape still opens the menu and does not share the HUD hold. The pad menu has no Time tab. Graphics settings have no ground-speed or weather-timescale slider.
=======
Branch: `grokbot-3/menu-no-bounce` off main `e7b9ab7`. Implementation `dcc9935`. Pull request https://github.com/BannonBotBoss/boreal/pull/91. Do not merge. Do not push main. Do not GitHub-approve this PR (the author is grokbot-3). Matthew said "Open a PR against main. Do not merge or approve it yourself." That overrides rule 16's merge step for this task. The board approve-plan and approve events record his chat request. They are not a GitHub review.

Matthew, 2026-10-25 17:51 PT: "Each time the layer changes, the whole menu jumps up or down." At 17:52 PT: "do NOT remove or disable the menu's vertical centering." At 17:53 PT: one fixed size, arrows, then "holding down should keep the selection moving."

## Doing
The pad menu stays vertically centered and one size across Camera, Time, Badges, Gallery and Settings. Overflow scrolls under a fixed header. Holding up or down repeats the selection and keeps the selected row fully on screen.

## Built
- `src/ui/padMenuLayout.ts`: `FIXED_LAYERS`, `menuFrame`, `scrollArrows`, `scrollToReveal`, `rowFullyVisible`, `focusAfterScroll`, `holdStepCount`, `createHoldRepeat`.
- `src/ui/padMenu.ts` `createPadMenu`: `applyFrame` measures the five layers and sets one content-box height. `reveal` settles `scrollTop` after the in-flow arrow bars change the body height. `paint` draws the tabs, rows and footer. Pointer hold listens on `window` for the release. Keyboard capture calls `keyAction(..., 'menu')` and `createHoldRepeat` for ArrowUp/ArrowDown. Header comment and `root.title` document the mapping.
- `src/ui/padNav.ts` `tabTo`: a tab button switches layer and resets focus. It no-ops while a page is stacked. Height is not remeasured on that switch.
- Mapping: LB/RB (keyboard `[` / `]`) still change layer. D-pad up/down and left stick up/down already repeat through `createPadReader` (`REPEAT.delayMs` 380, `REPEAT.rateMs` 110) and `padRouter.frame` → `menu.input`. D-pad left/right still adjusts the row. The right stick is unused here. Arrow keys and the on-screen arrows use `createHoldRepeat` with the same delay and rate. A second timer is not started for the pad atoms.
- The Layers tab uses the same box and is not part of the max. Sub-pages (badge, quiz) scroll inside the same box. Hold calls `model.input`, so a quiz number row still receives up/down.
- Tests: `tests/pad-menu-layout.test.ts`, plus `tabTo` in `tests/pad-menu.test.ts`.
- Measure page: `tools/menu-frame-measure.html`, `tools/menu-frame-capture.mjs` (Chrome DevTools, no extra package).

## How to verify
```
npx tsc --noEmit
npm test
npx vite --host 127.0.0.1 --port 5173 --strictPort
node tools/menu-frame-capture.mjs "http://127.0.0.1:5173/tools/menu-frame-measure.html" /tmp/after-720.json /tmp/after-720.png 1280 720
node tools/menu-frame-capture.mjs "http://127.0.0.1:5173/tools/menu-frame-measure.html?probe=1" /tmp/probe.json /tmp/probe.png 1280 720
```
Open the pad menu in play (View button) and cycle layers with LB/RB or `[` / `]`. Hold ArrowDown, or hold the on-screen down arrow. The panel top does not move. The highlighted row stays fully inside the list.
>>>>>>> main

## Number table
| quantity | game | real | source | match |
| --- | --- | --- | --- | --- |
<<<<<<< HEAD
| real seconds per game hour | 300 | — | existing `clock.realSecondsPerGameHour` (a game day is 2 real hours at rate 1) | unchanged design |
| game seconds per world second | 12 | 3600/300 | the clock's unit conversion, not a second rate | yes, moved out of `sim.timeScale` |
| playback rate | 0.05–16, default 1 | — | game calibration. Matthew: the scale does not matter if there is only one | calibration |
| offline cap | 3 days | — | existing `clock.maxOfflineSec` | unchanged |
| chronometer scrub | 3 game h / real s | — | existing dial sensitivity, not a world rate | unchanged |

## Frame gate
Not measured in this run. No display capture was taken of the bar. The behaviour is covered by `timeCommand` in `tests/worldClock.test.ts` (rate, HUD pause, menu hold surviving play). A screenshot of the bar at the top centre, and one frame after Pause, is still wanted.

## Needs from another agent
A short recording or still of the in-game bar (pause, then play, then a faster rate) if a reviewer wants the frame gate. This agent did not capture one.

## Judgements for Matthew
1. `?timescale` now sets the whole clock, including the sun, and may be above 1 up to 16. It used to cap at 1 and skip the sun.
2. Saved `world.groundSpeed` and `weather.timeScale` are deleted, not applied. Accumulated ground years stay.
3. `?deep=` stays a planet-epoch control on the layer panel. It left the Time menu with the tab.
4. The chronometer stays as the hour scrub of this same control.
5. The photo "Sun hour" slider is gone. Old captures may still store an hour. Rewind does not seek the world clock.
6. Camera look stays on the real frame delta.
7. The bar hides while the menu or photo mode is open, and sits under the menu (z-index 26).
8. The standalone planet page gets the same bar. Its d-pad is not the rate control, because d-pad right toggles the axis.
9. The ×12 game-second conversion stays. It is the clock's unit.
10. `stepWeather` still advances its own hour copy inside a slice. The next `updateWeather` overwrites that copy from the clock.
11. Headless `SimWorld.time` is still a local stepper for tests. Its needs use the clock's conversion. It has no rate of its own.
12. This PR is not merged and not GitHub-approved here.
=======
| repeat delay | 380 ms | — | existing `REPEAT.delayMs` in `src/input/gamepad.ts` | calibration, not a natural period |
| repeat rate | 110 ms | — | existing `REPEAT.rateMs` | calibration, shared so keyboard, arrows and the pad reader step together |
| arrow bar | 52 px | — | in-flow control in `PAD_CSS`, a thumb-sized game control | calibration, not a physical length |
| frame height | tallest of the five layers, else the viewport | — | `menuFrame` | the box, not a landscape measure |

## Frame gate
N/A for biological resemblance. The change is a menu panel, not an animal, a plant or a landscape, so a 95% match to a nature reference does not apply.

Substitute check, measured: `tools/menu-frame-capture.mjs` sets the viewport with Chrome `Emulation.setDeviceMetricsOverride` and reads `getBoundingClientRect` from `tools/menu-frame-measure.html`.

Calibration: the known mismatch is `tasks/evidence/T-0077/before-720.json` (main `e7b9ab7`, 1280×720). Tops differ: camera 220.015625, time 188.6484375, badges 32.40625, gallery 190.671875, settings 129.9609375. The known match is one top per viewport in the after files.

| viewport | top | height | head top | arrows |
| --- | --- | --- | --- | --- |
| 1280×720 before | five different tops (table above) | content height, badges capped by 86vh at 655.1875 | moves with the panel | none |
| 1280×720 after | 0 on all five | 720 | 71.6875 | badges down only (scroll 645 / view 498). The other four fit (550 / 550) |
| 1280×1100 after | 142.5 on all five | 815 | same across layers | none. Badges content 645 fits in the body |
| 1280×420 after | 0 on all five | 420 | same across layers | badges and settings show down (views 198). Camera, time and gallery fit |

Hold probe at 1280×720, badges (`probe-720.json`): pointerdown on the down arrow moved focus from atmospheric composition to cloud formation; after ~750 ms the focus was light, exposure and the solar spectrum; 400 ms after pointerup the focus did not move (`moved: false`). The same stop held for the up arrow and for ArrowDown (`upRelease.moved` false, `keyRelease.moved` false). Every recorded row, including the step where the up arrow first appears, had `fully: true`. Menu top stayed 0. Stepping down moved `scrollTop` 0 → 78 → 137 → 196, then a wrap back toward the first row. Stepping up from a scrolled row reduced `scrollTop` (78 → 58) and a wrap to the last row scrolled to 196 so that row stayed inside.

What the stills show: `before-settings-720.png` is the old settings panel, short of the screen, centered, no arrows. `after-720.png` is the panel flush to a 720 px screen (the measured box is the viewport). `after-1100.png` is the same box with even space above and below (top 142.5, height 815, viewport 1100). `after-420.png` is the box flush to a 420 px screen, settings showing the down arrow, header still on screen. `after-badges-hold-720.png` is badges after the hold probe, with the arrow bars and a focused row inside the list. No scrollbar is drawn. These are menu pixels, not a nature likeness.

## Evidence gate
- Cause: `src/ui/padMenu.ts:101` on `e7b9ab7`, `max-height:86vh` and no fixed height, under `top:50%` and `translate(-50%,-50%)`. Before tops in `tasks/evidence/T-0077/before-720.json`.
- After tops: `after-720.json`, `after-1100.json`, `after-420.json`.
- Hold and visibility: `probe-720.json`. The settle that fixed the clipped row is the loop in `reveal` (`src/ui/padMenu.ts`).

## Review inventory (rule 15)
`gh pr list --state open` returned no open pull requests at the start of the finish pass. This run is Matthew's direct bug. It does not approve other completed tasks. Several tasks are `completed` and not `done` (oldest others include T-0021, T-0028, T-0032, T-0069). Their gates were not re-run here, so no approve was written. T-0076 is this agent's own proposed task and was not self-approved. Tasks this agent claimed were not self-approved.

## Needs from another agent
None for the measurement. A reviewer can re-run the capture commands above. Do not merge the PR from this handoff.

## Next
PR #91 is open against main. Local `npx tsc --noEmit` exited 0. Local `npm test` was 786 tests, 772 pass, 0 fail, 14 todo, on the implementation before the board complete event. CI `test` is `.github/workflows/ci.yml`. A reviewer re-runs the capture commands. This agent does not merge and does not set `agent-review`.
>>>>>>> main
