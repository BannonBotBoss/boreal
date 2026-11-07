# Skill: first-visit film when the planet boot does not settle

When to use: the Big Bang counter sits still near "232 million years ago", or the film never enters B14 because earth readiness rejected or never settled. Not for a new beat, and not for animal, river, grass, or local-cloud work.

## What the counter is

`formatClock(107.95)` is "241 million years ago". That is the B13 clamp (`CINE.b13End - 0.05`). `formatClock(108.025)` is "232 million years ago", already the first B14 frames. A report of 232 million years is not evidence that the clamp is what held the picture.

On a ready globe the film lands on the first B14 frame: `cinematic:complete`, `markBigBangSeen`, `onPlanet` / `finishIntro`. The counter stops because the film stops. If `filmReady` is left set, every later globe frame rewrites the camera to that pose and `OrbitControls.update` does not run, so the disc does not take a drag either.

## Boot order

`bootP` waits for the shared sim, then land, elevation, and `bootGlobe`, and only then sets the globe's `booted` flag. Issue #47. Do not resolve it on a timer and do not draw a frame before that order. A rejection is logged and stays rejected. The film's `ready()` catch plays through B14 without calling `earth.show()`. `enter()` still waits until `bootSettled` before `toGlobe`, so a pending boot is not a blank `renderTo`.

## The clamp grace

Count seconds only while the clamp is on screen, starting with the frame that first reaches `b13End`. The grace is `CINE_HOLD_S` in `src/world/globe/bootReady.ts`: twice the spread of the measured full prewarms, rounded up to a whole second. It is not the max of the boot samples. A diagnostic pin (`?cine=B7`) does not burn it.

## Arrival

Finish only when `elapsed >= b14End` and the globe is up (or the boot was given up). The steps from 108 s through 116 s are the approved beat: Today, the sun grade to 112, `vo-b14` at 112.3, and the 800 ms hero crossfade. `finishIntro` then calls `releaseFilm()` before `enter()`. That keeps the camera on the film's last pose, clears `lookAz` so the stored heading does not tilt off the disc, and lets the orbit controls run. The overlay and `cine-run` come off in that same landing. The den search (`forestLanding`) is memoized and primed inside `prewarm`. Trace lines go through `cineTrace` and stay quiet unless `?cine-trace=1` or `?inpagedev`.

## Checks

- `tests/cine-ready.test.ts` and `tests/forest-landing.test.ts`.
- `npm test` and `npx tsc --noEmit`.
- Browser: `CINE TRACE` lines for `earth.show`, `toGlobe`, `forestLanding primed`, `arrival`, and `finishIntro`. A drag after arrival must move the camera. SwiftShader timings are not omen timings.

## Mistakes to avoid

- Putting a timeout on `bootP`. Slow hardware then draws before the boot order.
- Starting the grace at the click. A boot longer than a few seconds would be marked given-up while B1 is still on screen.
- Leaving `filmReady` set after `finishIntro`. The picture stays on the B14 pose and drags do nothing.
- Treating a SwiftShader trace as the omen cause. Omen still needs the `CINE TRACE` lines from the machine that froze.
