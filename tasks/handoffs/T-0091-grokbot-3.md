# T-0091 handoff — grokbot-3

Renumbered from T-0078 (rule 13). The render plan is T-0078. This handoff is the time dial. Branch `grokbot-3/single-time-control`, pull request #92. Not merged. The 1× edge is commit `abaa05d`.

## What was built
- `src/core/worldClock.ts`. Dial −1..+1. Dead zone ±0.01 is still pause. The curve is shifted from #109's literal `10^(|p| × 12)`, which put 1× on the pause mark: magnitude = `10^(((|p| − 0.01) / 0.99) × 12)`. Edge is exactly 1×. Full deflection is still 10^12×. A nudge that crosses ±1× stops there until the gesture ends. Play sets +1×. Spring in decades, inertia `1 + error²`, stiffness 64, damping 13.6 (game calibration).
- `src/ui/timeHud.ts`. Hold − / + to move the dial. Label is the readable rate. Past about a year the date line is `deepTimeAt`.
- `src/main.ts`. The held axis nudges the dial. Sky uses the signed world second. Ground advances only. Animals, the weather grid and gameplay audio run only forward and only while the scale is Immediate. The fall's air-rush still drives the wind loop, and it does not start a second clock.

## How to verify
`./node_modules/.bin/tsc --noEmit` exit 0. `npm test` after the merge fix.

Ground view, start menu skipped: `/?nomenu&view=ground&noprobe&hour=11`. The bar reads `1 sec / sec`. Hour opens the chronometer. `?timescale=3600` reads `1 hour / sec`. `?timescale=31557600000` reads `1,000 years / sec` and a deep-time label.

## Numbers
| value | game | real figure | source | matches? |
| --- | --- | --- | --- | --- |
| dead zone 0.01 | pause inside it | #109 | #109 | yes, tested |
| real time | exactly 1× at dial ±0.01 | #109 literal `10^(|p|×12)` puts 1× at position 0, which is pause. Matthew, 2026-10-25 19:46 PT: shift the same 12 decades so the edge is 1× and ±1 is still 10^12× | this correction of #109 | yes, tested |
| julian year in the label | 365.25 d | IAU julian year | `src/data/constants.json` | yes |
| spring 64 / 13.6, inertia 1+error² | a notch moves within a second; 12 decades takes a few seconds and does not jump | #109 "several seconds", game calibration | this task | tested, not a natural rate |
| hysteresis 800 / 1200 | behavior stays until 1200, returns below 800 | #109 example | #109 | yes, tested |

## Frames
Before (the old ×1 bar): `/opt/cursor/artifacts/time_bar_play_1280.png`, `time_bar_hour_1280.png`, `time_bar_play_750.png`, `time_bar_hour_750.png`.

After the 1× correction, in `/opt/cursor/artifacts/`: `time_dial_realtime_play_1280.png`, `time_dial_realtime_hour_1280.png`, `time_dial_realtime_play_750.png`, `time_dial_realtime_hour_750.png`. Those read `1 sec / sec`.

What I see: a dark pill at the top centre. At rest it says the morning hour, the date, and `1 sec / sec`. Hour opens the round chronometer on the right. At 1 hour/sec the line says ecological. At 1,000 years/sec the line says a deep-time label and geological. The Boreal title stays on the left. At 750px wide the pill does not cover the title. A nature reference does not apply to a readout. N/A.

## What cannot rewind (honest)
The clock and the hour go backward. Ground years do not. Animals, needs, physics, the weather grid and gameplay sounds hold while rewinding and while the scale is above Immediate. Cloud drift drops a negative gap. The calendar Date is clamped. The observation signal is not wired into those systems. That wiring is a later task.

## Needs from another agent
None for the bar. Later tasks wire each system to `observation()`.
