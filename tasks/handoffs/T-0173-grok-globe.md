# T-0173 handoff — grok-globe

Proposed. Not claimed. No approve-plan. Pull request https://github.com/BannonBotBoss/boreal/pull/359. Grokbot-2 requested changes. This handoff is the correction. Do not merge.

## Review

1. 232 million years is about 108.025 s, already in B14. The clamp at 107.95 s reads 241 million years ago. The readiness hold is not an established diagnosis of Matthew's report.
2. `settleOr` on `bootP` is gone. Issue #47 order is unchanged: land, elevation, `bootGlobe`, then the globe may draw. A rejection is logged and the promise stays rejected. The globe is not drawn from a null stand-in.
3. The film grace starts on the frame that first reaches `b13End`. It does not run from the click.
4. The grace is 9 s: twice the spread of the three measured full prewarms (11.7 s, 12.8 s, 16.1 s; span 4.35 s), rounded up to a whole second. It is not the max of the boot samples.

The rejection catch, the `CosmosSphere` try, `enter()` waiting on `bootSettled`, and the never-settling tests stay.

## B14 is the whole beat

`cineArrivalDue` is false at 108.03 s with the globe up, and true at `b14End` (116 s). `step` keeps running, so the Today counter, the sun grade from 108 to 112, `vo-b14-home` at 112.3, and the 800 ms hero/panel crossfade all happen before `finishIntro`. The overlay comes off only then. `?cine-trace=1` or `?inpagedev` gates the trace lines.

## Arrival trace (SwiftShader, not omen)

`tools/cine-arrival-trace.mjs` with `?cine-trace=1`. Chrome 156 headless, ANGLE SwiftShader, 1280×720, fresh context, `?start=sphere&stages=1&trees=v2&noprobe=1`. Not omen. The dev server had already transformed the modules.

| Point | Measured |
| --- | --- |
| `forestLanding` primed during prewarm | 121.6 ms |
| `toGlobe` on the earth frame | 0.5 ms (search 0 ms, memo hit) |
| Earth shown | film time 83.37 s, save not written |
| Still inside B14 | 108.10 s, counter "223 million years ago", save not written |
| Hero crossfade | 110.27 s, counter Today, hero opacity 0.082, save not written |
| `finishIntro` | elapsed 116, clock Today, 4.0 ms (release 0.1, enter 0, commit 3.7) |
| Camera 1 s after release, no input | moved about 0 m |
| Camera after one drag | moved about 3.27×10^7 m |

`finishIntro` is not a stall. SwiftShader frames through the film are about 0.5–2.5 s. A Node timing of the first `forestLanding()` was 571 ms; the repeat was under 50 ms. Prewarm pays the first search.

`tasks/evidence/T-0173/b14-today.png` is the disc during B14, before the save: the counter reads Today and the hero reads "Today · 13.8 billion years", with the panel still crossing out. `tasks/evidence/T-0173/arrival-orbit.png` is the globe after the later drag. Coarse shading is SwiftShader.

## Number table

| Value | Game | Source | Match |
| --- | --- | --- | --- |
| Prewarm spread | 4.35 s | 16056.6 − 11702.1 ms, three SwiftShader runs | measured |
| B13 grace | 9 s | `ceil(2 × spread / 1000)` | margin, not the sample max |
| Clamp label | 241 million years ago | `formatClock(107.95)` | the hold |
| 232 million years ago | 108.025 s | `formatClock` | first B14 frames |
| Arrival work | 3.4 ms | `CINE TRACE finishIntro` above | not a stall on this VM |
| Den search, cold Node | 571 ms first, under 50 ms repeated | `tests/forest-landing.test.ts` | memoized |

No biological rate is introduced.

## Tests

`tests/cine-ready.test.ts`: grace starts at the clamp, rejection, a promise that never settles, reduced motion, the B7 pin, `bootP` has no `settleOr`. `tests/forest-landing.test.ts`: the repeat search is the same object and under 50 ms.

`npm test`: 1164 pass, 0 fail, 14 todo. `npx tsc --noEmit`: exit 0. The B14 integration test steps 0.2 s and requires Today, a partial hero opacity with the panel at `1 - opacity`, a sun bias strictly between 0 and 1 and then 1, and `vo-b14-home` played, all before `onPlanet`.

The node tests do not draw the globe. The trace above is one SwiftShader visit. It is not omen.

## Needs from another agent

On the machine that froze, after the click, copy the `CINE TRACE` lines (`forestLanding primed`, `earth.show`, `toGlobe`, `arrival`, `finishIntro`). If `finishIntro` is a few milliseconds and a drag still does not move the globe, the camera release did not run there. If `finishIntro` is seconds, that machine's stall is in the save or `enter`, which this VM did not show.

## Next

Grokbot-2 reviews #359 again. Do not merge.
