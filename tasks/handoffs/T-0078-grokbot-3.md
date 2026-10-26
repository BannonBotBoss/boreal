# T-0078 handoff — grokbot-3

## What this is
The one clock is now the time dial from issues #109, #108 and #107. Branch `grokbot-3/single-time-control`, pull request #92. Not merged. `565b2e6` was the unshifted curve (about 1.32× at the lip). The next commit on this branch shifts that curve so the lip is exactly 1×.

## What was built
- `src/core/worldClock.ts`. Dial −1..+1. Dead zone ±0.01 is still pause. The curve is shifted from #109's literal `10^(|p| × 12)`, which put 1× on the pause mark: magnitude = `10^(((|p| − 0.01) / 0.99) × 12)`. Edge is exactly 1×. Full deflection is still 10^12×. A nudge that crosses ±1× stops there until the gesture ends. Play sets +1×. Spring in decades, inertia `1 + error²`, stiffness 64, damping 13.6 (game calibration). `formatRate`, `resolveObservation`, `simWorldSec`, `groundWorldSec`, `epochOffsetYr`.
- `src/ui/timeHud.ts`. Hold − / + to move the dial. Label is the readable rate. Past about a year the date line is `deepTimeAt`.
- `src/core/bindings.ts`. Slower and faster are holds (comma / d-pad left, period / d-pad right). Pause stays a tap.
- `src/main.ts`. The held axis nudges the dial. Sky uses the signed world second. Ground advances only. Animals, the weather grid and gameplay audio run only forward and only while the scale is Immediate.
- `src/core/timeOfDay.ts`. `clockDate` clamps so a geological jump is not an Invalid Date.
- `src/animals/locomotion/lab.ts`. The pose holds when rewinding or above Immediate, so a huge rate cannot spin the step loop.

## How to verify
`./node_modules/.bin/tsc --noEmit` exit 0. `npm test` 792 tests, 778 pass, 0 fail, 14 todo.

Ground view, start menu skipped: `/?nomenu&view=ground&noprobe&hour=11`. The bar reads `1 sec / sec`. Hour opens the chronometer. `?timescale=3600` reads `1 hour / sec`. `?timescale=31557600000` reads `1,000 years / sec` and a deep-time label.

## Numbers
| value | game | real figure | source | matches? |
| --- | --- | --- | --- | --- |
| dead zone 0.01, exponent ×12 | pause, then up to 10^12× | the issue's own samples: 0.1 → ~15.8×, 0.3 → ~3981×, 0.5 → 10^6, 1 → 10^12 | #109 | yes, tested |
| real time | exactly 1× at dial ±0.01 | #109 literal `10^(|p|×12)` puts 1× at position 0, which is pause. Matthew, 2026-10-25 19:46 PT: shift the same 12 decades so the dead-zone edge is 1× and ±1 is still 10^12× | this correction of #109 | yes, tested. A deviation from the literal issue, recorded in the pull request |
| julian year in the label | 365.25 d | IAU julian year | `src/data/constants.json` | yes |
| spring 64 / 13.6, inertia 1+error² | a notch moves within a second; 12 decades takes a few seconds and does not jump | #109 "several seconds", game calibration | this task | tested, not a natural rate |
| hysteresis 800 / 1200 | behavior stays until 1200, returns below 800 | #109 example | #109 | yes, tested |
| other scale edges | 10×, 10^5×, 10^7×, then 10^9, 10^10, 10^11 with the same 0.8/1.2 gap | #108 bands, split so all eight names fit under 10^12 | #108, #109 | design, tested |

## Frames
Before (the old ×1 bar): `/opt/cursor/artifacts/time_bar_play_1280.png`, `time_bar_hour_1280.png`, `time_bar_play_750.png`, `time_bar_hour_750.png`.

After the 1× correction, in `/opt/cursor/artifacts/`: `time_dial_realtime_play_1280.png`, `time_dial_realtime_hour_1280.png`, `time_dial_realtime_play_750.png`, `time_dial_realtime_hour_750.png`. Those read `1 sec / sec`. The earlier `time_dial_play_*` stills show the 1.32× lip and are superseded. `time_dial_hour_per_sec_1280.png` and `time_dial_thousand_years_1280.png` still show those rates.

What I see: a dark pill at the top centre. At rest it says the morning hour, the date, and `1 sec / sec`, with Pause, Play, −, +, Hour. Hour opens the round chronometer on the right. At 1 hour/sec the line says ecological. At 1,000 years/sec the line says a deep-time label and geological. The Boreal title stays on the left. At 750px wide the pill is still one line and does not cover the title. A nature reference does not apply to a readout. N/A.

## What cannot rewind (honest)
The clock and the hour go backward. Ground years do not. Animals, needs, physics, the weather grid and gameplay sounds hold while rewinding and while the scale is above Immediate. Cloud drift drops a negative gap. The calendar Date is clamped. The observation signal is not wired into those systems. That wiring is a later task.

## Needs from another agent
None for the bar. Later tasks wire each system to `observation()`.
