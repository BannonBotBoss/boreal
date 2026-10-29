# Skill: animals, weather, and the ground follow the one time scale

Use when speeding time should change what you see, without a second clock, a second wheel, or a second list of scales. Roadmap step 32. Issues #107, #108, and #109. #109 wins: a thing transforms. It does not pop, and it does not merely freeze. The eight names, the hysteresis, and the blend are already `observation()` in `src/core/worldClock.ts` (T-0090, T-0091). The density ledger is already `src/core/coarse.ts` (T-0104). Height multiplying that scale is step 33. Blur and sound are step 35. Do not build those here.

## Steps
1. Read `notes/design-roadmap.md` step 32 and `notes/skills/single-clock.md`. The bands are `SCALE_BOUNDS` (8 and 12, then 800 and 1200, then the bands above). Do not copy them into a new table. Do not import `TIME_LEVELS` as a live dial.
2. Split a forward world-second delta with `aggregateShare`. `simWorldSec` is the share still on Immediate. `aggregateWorldSec` is the rest. They sum to the forward delta. A backward delta is 0 for both. `groundWorldSec` still advances on every forward delta and still refuses a backward one: ground years are elapsed time. The seasonal surface is not a second year counter.
3. Individuals (the body step, needs, physics, the fine weather slices, gameplay audio) use `simWorldSec`. Through the 8×–12× overlap they are still moving, slower as the blend grows. Above Immediate they are 0. The step 14 shares already fade the body across that same blend. `markFor` puts the density first, so the drawing is on before the body is gone.
4. The weather cell uses `aggregateWorldSec` as `updateWeather`'s last argument, which calls `catchUpWeather`. That is the existing one-hour `relaxToward` (temperature and humidity keep the quarter rate). Snow-water eases toward the planet's `sweMm` when the planet has one, otherwise `climatologicalSweMm`: one year of the Kenora monthly normals, snow below 0 °C, melt at `HYDRO.ddf`. Do not run Kessler once per simulated second. `weatherAt` mixes the live cell toward that climate by `aggregateShare(observation())`, so the read and the stored cell agree once you slow back down.
5. The ground snow is that read. `column` already takes `weatherAt(...).sweMm` and `snowDepthCm`. Do not add a second snow layer. Grass already samples the same read each frame.
6. The picture stays `src/render/animalDensity.ts`. The camera-facing sprite stays behind `densityTintGate` (it is a dome from the play camera). `groundMarkOpacity` is the flat patch on the litter while the eye is low, and it is 0 once the high stain is open. `buildScene` still calls `density.sync` before `setBodyShare`. The embodied animal stays a body (step 14). Do not edit `src/render/playables.ts` for this.

## Checks that prove it worked
- `tests/time-scale-follow.test.ts`: at 1× the individual share is the whole second and the aggregate share is 0. At 10× both are positive, they sum to the second, and the label stays Immediate when the rate wobbles between 9× and 11×. At 20× and at 1e6× the individual share is 0 and the aggregate share is the whole forward second. Rewind is 0. Midwinter snow-water is one season (tens of millimetres, not a geological pile) and midsummer is none. A seasonal read puts snow on `column`. Slowing back to Immediate keeps that store. The blend frame has body and ink both above 0, density first, and a ground-patch opacity above 0.2 while `densityTintGate` at wolf height is 0.
- `npx tsc --noEmit` and `npm test`.
- In the game, the same place: real time shows the animals as bodies; inside the overlap the bodies are still there and the patch is on; past Immediate the bodies are gone and the patch remains. No standing dome.

## Mistakes to avoid
- A second scale enum, a second clock, or a second wheel.
- Letting `simWorldSec` stay the only answer above Immediate, so animals and the weather cell merely freeze.
- Painting the T-0070 point sprite at ground level. Keep it gated. The flat patch is the play-camera picture.
- Integrating a million years of precipitation into the snow store. The closed form is one year.
- Rewinding ground years, hunger, or the weather cell and calling it history.
- Folding the embodied animal. The player stays a body so the view still has someone to stand in.
- Editing the player-entry or playables files. Another task owns those.
- Building height × time (step 33) or speed-up blur and pitch (step 35) in this change.
