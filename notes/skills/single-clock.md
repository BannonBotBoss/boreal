# Skill: one clock

When to use: anything that advances, pauses, or displays simulated time (sky, weather, planet, water, animals, shaders, audio timing, ground years, a new HUD or menu control).

## The clock
`src/core/worldClock.ts` is the only integrator. World seconds advance from `performance.now()` at `clockRate()` world-seconds per real second (`RATE_MIN` 0.05, `RATE_MAX` 16). Holds (`menu`, `hud`, `photo`) freeze it; it runs only when none remain.

- `pauseClock` / `resumeClock` are the menu hold. `timeCommand('pause'|'play'|'slower'|'faster')` is the in-game control: pause and play are the `hud` hold only; slower and faster halve or double the one rate.
- `gameSecondsPerWorldSecond` (3600 / `clock.realSecondsPerGameHour`, 300 s → ×12) is the clock's unit conversion for needs, weather step length and ground years. It is not a second rate. Do not put it back on `SYSTEM_PROPERTIES.sim` or multiply ground years by anything else.
- `src/core/timeOfDay.ts` `hourAt` / `dayAt` / `clockDate` are a phase of the same world second (dial offset, `?hour=`, `?day=`, `?date=`). `setHour` turns the dial. It does not seek the world second.
- `src/render/shaderClock.ts` `time` reads `worldSec()`. The setter is a no-op so a photo snapshot can still assign the old sample. Do not seek the clock on rewind: ground years are an accumulator, and a backwards gap is dropped, then a later seek-forward would fast-forward them.
- `?timescale=` is `timescaleFrom` → `setClockRate`, and only when the param is present, so a saved rate is kept.

## The control
`src/ui/timeHud.ts` `createTimeHud` is the only playback control (mouse and touch on the bar). Keyboard and the Xbox pad go through `src/core/bindings.ts`:

| action | keyboard | Xbox | context |
| --- | --- | --- | --- |
| slower | `,` | d-pad left | play |
| faster | `.` | d-pad right | play |
| pause or play | `;` | left-stick click | play |
| hour (chronometer) | `T` | d-pad up | any |

These stay off `[` `]` (master volume) and `-` `=` (music). D-pad left/right are the chronometer's while the dial is open and the menu's while a menu is open (`together(play, chrono)` and `together(play, menu)` are false). On the planet view, d-pad right toggles the axis and d-pad left cycles axis-mode layers, so `main.ts` does not dispatch the rate actions there and the standalone page calls `bindTimeInputs({ padRate: false })`. The bar's buttons still change the rate. The menu has no Time tab. Settings do not have `world.groundSpeed` or `weather.timeScale`; `RETIRED_TIME_KEYS` strips them from a save and does not apply them.

## Checks
- `tests/worldClock.test.ts`: `timeCommand` changes the one rate and the HUD hold; the menu hold survives play.
- `tests/single-clock.test.ts`: no second `timeScale`, `GROUND.speed`, `THREE.Clock` or `getDelta`. `performance.now` / `Date.now` outside `worldClock.ts` must be on the allowlist (frame budgets, input timestamps, wall-clock stamps). The list only shrinks. The menu tab list is `layers, camera, badges, gallery, settings`.
- `npm run system-map` after a `SYSTEM_MAP` edit. `npx tsc --noEmit` and `npm test`.

## Mistakes to avoid
- A second multiplier "just for the ground" or "just for weather". Years and the weather step already consume this clock's game seconds.
- Folding a saved ground speed (up to 100000×) or weather scale into the global rate. Drop the keys. Leave `GROUND.years` already in the save.
- Seeking `worldSec` from a photo rewind.
- Putting the control back on the pad-menu Time tab or a settings slider. Another branch owns the menu container (`grokbot-3/menu-no-bounce`): if the Time tab returns, delete only that object from the `buildTabs` array.
- Binding d-pad left/right in a context that is live together with play, or using them on the planet view.
- Treating `?deep=` as a playback rate. It is the planet's epoch.
- Letting the locomotion lab's `state.clock` (`?t=`) become its own rate. It advances by frame dt × `clockRate()`. `performance.now` there is only the frame timer.
