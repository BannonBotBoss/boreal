# T-0078 handoff — grokbot-3

## What this is
The one clock is now the time dial from issues #109, #108 and #107. Branch `grokbot-3/single-time-control`, pull request #92. Not merged.

## What was built
- `src/core/worldClock.ts`. Dial −1..+1. Target `sign × 10^(|p| × 12)` outside ±0.01. Spring in decades, inertia `1 + error²`, stiffness 64, damping 13.6 (game calibration). `formatRate`, `resolveObservation`, `simWorldSec`, `groundWorldSec`, `epochOffsetYr`.
- `src/ui/timeHud.ts`. Hold − / + to move the dial. Label is the readable rate. Past about a year the date line is `deepTimeAt`.
- `src/core/bindings.ts`. Slower and faster are holds (comma / d-pad left, period / d-pad right). Pause stays a tap.
- `src/main.ts`. The held axis nudges the dial. Sky uses the signed world second. Ground advances only. Animals, the weather grid and gameplay audio run only forward and only while the scale is Immediate.
- `src/core/timeOfDay.ts`. `clockDate` clamps so a geological jump is not an Invalid Date.
- `src/animals/locomotion/lab.ts`. The pose holds when rewinding or above Immediate, so a huge rate cannot spin the step loop.

## How to verify
`./node_modules/.bin/tsc --noEmit` exit 0. `npm test` 791 tests, 777 pass, 0 fail, 14 todo.

Ground view, start menu skipped: `/?nomenu&view=ground&noprobe&hour=11`. The bar reads about `1.32 sec / sec`. Hour opens the chronometer. `?timescale=3600` reads `1 hour / sec`. `?timescale=31557600000` reads `1,000 years / sec` and a deep-time label.

## Numbers
| value | game | real figure | source | matches? |
| --- | --- | --- | --- | --- |
| dead zone 0.01, exponent ×12 | pause, then up to 10^12× | the issue's own samples: 0.1 → ~15.8×, 0.3 → ~3981×, 0.5 → 10^6, 1 → 10^12 | #109 | yes, tested |
| first forward notch | ~1.32× | #109 formula at the lip. Exact 1× sits on pause | #109 | yes, the formula. Not a measured animal rate |
| julian year in the label | 365.25 d | IAU julian year | `src/data/constants.json` | yes |
| spring 64 / 13.6, inertia 1+error² | a notch moves within a second; 12 decades takes a few seconds and does not jump | #109 "several seconds", game calibration | this task | tested, not a natural rate |
| hysteresis 800 / 1200 | behavior stays until 1200, returns below 800 | #109 example | #109 | yes, tested |
| other scale edges | 10×, 10^5×, 10^7×, then 10^9, 10^10, 10^11 with the same 0.8/1.2 gap | #108 bands, split so all eight names fit under 10^12 | #108, #109 | design, tested |

## Frames
Before (the old ×1 bar): `/opt/cursor/artifacts/time_bar_play_1280.png`, `time_bar_hour_1280.png`, `time_bar_play_750.png`, `time_bar_hour_750.png`.

After, in `/opt/cursor/artifacts/`: `time_dial_play_1280.png`, `time_dial_hour_1280.png`, `time_dial_play_750.png`, `time_dial_hour_750.png`, `time_dial_hour_per_sec_1280.png`, `time_dial_thousand_years_1280.png`.

What I see: a dark pill at the top centre. At rest it says 11:07, 15 Aug, day 227, and `1.32 sec / sec`, with Pause, Play, −, +, Hour. Hour opens the round chronometer on the right, same hour, sun 53° up. At 1 hour/sec the date has run forward to the evening of 28 Aug and the line says ecological. At 1,000 years/sec the line says 27.3 kyr from now, Living Earth, geological. The Boreal title stays on the left. At 750px wide the pill is still one line and does not cover the title. A nature reference does not apply to a readout. N/A.

## What cannot rewind (honest)
The clock and the hour go backward. Ground years do not. Animals, needs, physics, the weather grid and gameplay sounds hold while rewinding and while the scale is above Immediate. Cloud drift drops a negative gap. The calendar Date is clamped. The observation signal is not wired into those systems. That wiring is a later task.

## Needs from another agent
None for the bar. Later tasks wire each system to `observation()`.
