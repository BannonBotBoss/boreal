# Ten-location ecosystem check (sprint #192, Oct 31 2026)

Grokbot-1. Owner directive item 6 (ten-location acceptance), headless part. Test: `tests/ten-location-ecosystem.test.ts`.
For each real place the test asks the wasm sim for the cover class (`coverCell`) and the 5 km landing population
(`landingPopulationDetail`, year 2026). Elevation and vegetation are typical values for the place, given by hand.
Screenshots and FPS still need a WebGL browser run and are not part of this file.

| place | lat, lon | elev m | veg | cover | animals in 5 km patch |
|---|---|---|---|---|---|
| Kenora boreal | 49.8, -94.5 | 350 | 0.85 | boreal | hare 11940, beaver 98, deer 66, fox 23, moose 20, black bear 12, lynx 10, eagle 4, caribou 1 |
| BC coast | 49.3, -123.1 | 20 | 0.80 | boreal | hare 3664, deer 49, moose 35, beaver 30, fox 24, black bear 21, lynx 7, eagle 2, wolf 1 (no caribou: range hole for the south coast, Nov 1) |
| Saskatchewan prairie | 51, -107 | 600 | 0.45 | prairie | deer 257, fox 17, beaver 12, moose 3, black bear 1 |
| Hudson Bay lowland | 57, -92 | 80 | 0.60 | wetland | beaver, moose, caribou, wolf, fox, black bear (no deer or hare) |
| Rockies alpine | 51.4, -116.2 | 2600 | 0.10 | ice | none |
| Yukon north tundra | 68, -135 | 300 | 0.30 | tundra | caribou 36, red fox 3 (no deer) |
| Arctic polar | 80, -80 | 200 | 0.02 | ice | none |
| Sahara | 23, 13 | 400 | 0.02 | desert | none |
| Amazon | -3, -60 | 50 | 0.95 | tropical | deer (thin, 0.1-1/km2) |
| Pacific ocean | 30, -150 | 0 | 0 | water | none |

## Gaps found (not fixed here)

- **Arctic tundra fixed (Nov 1, grokbot-1):** where the modelled tree line is at or near sea level (< 80 m), tundra now runs
  up to the physics ice line instead of an arbitrary tree line + 300 m, so a 300 m Yukon north slope (ice line ~312 m at 68N)
  is tundra with caribou and fox (wolf density is too thin to show in a 5 km patch). Mountains with a higher tree line keep bare rock above it, so the no-plants-at-altitude rule is unchanged there.
- **Hudson Bay lowland fixed (Nov 1, grokbot-1):** new `wetland` cover class (id 8, northern peatland) for prairie-band green
  at |lat| >= `wetland_lat_min` (50) below `wetland_below_m` (200 m). Moose, beaver, caribou, wolf, black bear and red fox opt in
  with `wetland_per_ha`; deer, hare and lynx stay out.
- **Amazon fixed (Nov 1, grokbot-1):** new `tropical` cover class (id 7) for wet land whose site annual mean is at least
  `tropical_mean_C` (22 C). Only white-tailed deer opt in (`tropical_per_ha`), so the boreal cast stays out.
