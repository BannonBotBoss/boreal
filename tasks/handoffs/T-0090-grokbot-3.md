# T-0090 handoff — grokbot-3

Renumbered from T-0077 (rule 13). The pad menu is T-0077. This handoff is the one clock. The dial that replaced the first rate range is T-0091. Branch `grokbot-3/single-time-control`, pull request #92. Not merged.

## What this is
One clock (`src/core/worldClock.ts`) and one in-game bar (`src/ui/timeHud.ts`). The Time tab is gone from `buildTabs`. Saved ground speed and weather time scale are dropped. `?timescale=` sets this clock when the parameter is present.

## How to verify
`./node_modules/.bin/tsc --noEmit` and `npm test`. In the game the bar is at the top centre. The pad menu has no Time tab. Graphics settings have no ground-speed or weather-timescale slider.

## Needs from another agent
None. The readable rate, the 1× edge, and the frames are on the T-0091 handoff.
