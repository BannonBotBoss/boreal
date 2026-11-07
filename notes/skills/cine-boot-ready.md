# Skill: first-visit film when the planet boot does not settle

When to use: the Big Bang film sticks near the end of B13 (the counter sits on "241 million years ago") and never enters B14. Not for a new beat, and not for animal, river, grass, or local-cloud work.

## Why it sticks

`src/world/cosmos/opening.ts` holds `elapsed` at `CINE.b13End - 0.05` while `begun && !booted`. `booted` is set only in `earth.ready().then`, with no rejection handler. On a first visit, `main.ts` passes `inpage.whenBooted()`, which is `loadGlobe().then(g => g.bootP)`. A rejection, or a promise that never settles, leaves the hold in place. The startup line that logs `inpage prewarm` does not run on that visit: a sphere start skips the loading-card prewarm and starts it from the click, and that call had no `.catch`.

`formatClock(107.95)` is "241 million years ago". "232 million years ago" is `formatClock` for about 108.02–108.03 s, a passing label just after B13, not the held frame. The frame loop has to be running to reach the hold. A wasm fetch that never returns also blocks `openForestPlanet`, and that `finally` is what starts the frame loop, so a hung wasm file freezes the page before the film, not on this counter.

## Steps

1. Read `opening.ts` (the hold and `begin`), `main.ts` (`openAfterLoad`, the `cine` flag), `inpage.ts` `whenBooted` / `prewarm` / `enter`, and `globeView.ts` `bootP`.
2. Time successful click → `bootP` and click → `prewarm()` on the machine you have. Label a software renderer as such. `tools/cine-boot-measure.mjs` is the SwiftShader procedure. The film gate is `bootP`, not the tile-step loop inside `prewarm`.
3. Put the budget in `src/world/globe/bootReady.ts` as `Math.ceil` of the slowest successful `bootP` sample. Do not pick a round number. `settleOr` in `src/render/startup.ts` is the existing "a hung fetch must not hold the boot" helper: the value, or the fallback, and the original promise is not cancelled.
4. `bootP` uses that budget. A throw is caught and `booted` is still set, so the globe can draw without climate layers. A sim that arrives later still runs `bootGlobe` once.
5. The film counts cinematic `dt` with `stepCineBoot`. Past the budget, or on rejection, it stops holding and plays through B14, then lands once. A boot that fulfills in time still lands on the first B14 frame with the layer gate unchanged. `?cine=B7` stays a pin: it does not burn the budget.
6. `enter()` switches to the globe on the same frame only when `bootSettled` is already true. Otherwise it waits, so a pending boot is not a blank `renderTo`.
7. The click-time `prewarm()` uses the same `console.warn('inpage prewarm', …)` as the loading-card path.

## Checks

- `tests/cine-ready.test.ts`: the held label, a settling boot, a rejection, a promise that never resolves, reduced motion, the B7 pin, return visits, and `settleOr`.
- `npm test` and `npx tsc --noEmit`.
- A browser check is still required. The node tests drive `createOpening` with a fake document; they do not draw the globe. On SwiftShader, aborting `globeView` should reach `hasSeenBigBang` with the overlay gone. A normal first visit should reach B14 with the overlay still up and the globe in view. Neither is an omen result.

## Mistakes to avoid

- Treating "232 million years ago" as the held string. Measure `formatClock` at the clamp.
- Releasing the hold by forcing `booted` when the globe cannot draw. That turns the overlay transparent onto a canvas `step` will not render.
- Starting the budget at B13 only. A healthy boot on the measured machines finished in a few seconds, so the extra wait belongs on the click, and B13 stays the drift for a boot that is still inside the budget.
- Editing `localClouds.ts`, animals, rivers, or grass while fixing this.
- Calling a SwiftShader timing an omen measurement. Omen still needs the console lines `cine earth ready` and `inpage prewarm` plus whether `bootP` fulfills.
