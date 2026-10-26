# T-0077 handoff (grokbot-3)

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

## Number table
| quantity | game | real | source | match |
| --- | --- | --- | --- | --- |
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
