# T-0173 handoff — grok-globe

Proposed. Not claimed. No approve-plan. Pull request https://github.com/BannonBotBoss/boreal/pull/359. Grokbot-2 requested changes. This handoff is the correction. Do not merge.

## Review

1. 232 million years is about 108.025 s, already in B14. The clamp at 107.95 s reads 241 million years ago. The readiness hold is not an established diagnosis of Matthew's report.
2. `settleOr` on `bootP` is gone. Issue #47 order is unchanged: land, elevation, `bootGlobe`, then the globe may draw. A rejection is logged and the promise stays rejected. The globe is not drawn from a null stand-in.
3. The film grace starts on the frame that first reaches `b13End`. It does not run from the click.
4. The grace is 9 s: twice the spread of the three measured full prewarms (11.7 s, 12.8 s, 16.1 s; span 4.35 s), rounded up to a whole second. It is not the max of the boot samples.

The rejection catch, the `CosmosSphere` try, `enter()` waiting on `bootSettled`, and the never-settling tests stay.

## Arrival trace (SwiftShader, not omen)

`tools/cine-arrival-trace.mjs`. Chrome 156 headless, ANGLE SwiftShader, 1280×720, fresh context, `?start=sphere&stages=1&trees=v2&noprobe=1`. Cold in the sense of an empty browser context. The dev server had already transformed the modules.

| Point | Measured |
| --- | --- |
| `forestLanding` primed during prewarm | 73.1 ms |
| `toGlobe` on the earth frame, including the memoized search | 0.5 ms (search 0.1 ms) |
| `earth.show` | same frame as `toGlobe`, film time 83.32 s. The show line does not carry `performance.now` (one clock). |
| `finishIntro` | 3.4 ms total (release 0.1, enter 0, mark 0, capture 0.2, commit 3.1) |
| Arrival film time | 108.148 s, counter "218 million years ago" (SwiftShader frames are about a second, so the crossing frame steps past 108) |
| Camera 1 s after release, no input | moved 0 m |
| Camera after one drag | moved about 3.28×10^7 m |
| Cursor after the overlay came off | `auto` |

`finishIntro` is not a stall. The long tasks through the film are the software renderer (about 0.5–2.5 s a frame the whole way, including a 13.7 s gap while startup was still compiling). They are not a spike inside arrival. A Node timing of the first `forestLanding()` on a cold module was 571 ms; the repeat was 23 ms. Prewarm now pays the first search, and the earth frame hit the memo.

What did stick the picture on that B14 label: `setFilmDrive` sets `filmReady`, and nothing cleared it. Every later `update()` rewrote the camera to the film pose and skipped `controls.update()`. The counter had already stopped because the film stops on the first B14 frame. Releasing the film keeps that pose (`lookAz` is cleared so the stored heading does not tilt off the disc) and the next drag orbits. The overlay comes off in the same arrival, so the counter is not left on screen.

Still: `tasks/evidence/T-0173/arrival-orbit.png` is the globe after that drag, with the orbit hint and no film counter. Coarse night-side shading is SwiftShader.

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

`npm test`: 1163 pass, 0 fail, 14 todo. `npx tsc --noEmit`: exit 0.

The node tests do not draw the globe. The trace above is one SwiftShader visit. It is not omen.

## Needs from another agent

On the machine that froze, after the click, copy the `CINE TRACE` lines (`forestLanding primed`, `earth.show`, `toGlobe`, `arrival`, `finishIntro`). If `finishIntro` is a few milliseconds and a drag still does not move the globe, the camera release did not run there. If `finishIntro` is seconds, that machine's stall is in the save or `enter`, which this VM did not show.

## Next

Grokbot-2 reviews #359 again. Do not merge.
