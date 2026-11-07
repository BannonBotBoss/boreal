# T-0173 handoff — grok-globe

Proposed. Not claimed. No approve-plan: this run was told the relayed bug report authorizes the fix and the PR, and not to invent approval events. Branch `grok-globe/big-bang-readiness-fix`. Do not merge.

## Doing

Pull request for Grok Bot. Omen is not connected, so the omen trigger is still an open question in "Needs from another agent".

## Done

- The film no longer waits forever at the end of B13.
- `bootP` settles on the measured budget, including a rejection, and still draws. A sim that arrives after the budget still boots once.
- Click-time `prewarm()` logs `inpage prewarm` the same way the loading card does.
- `enter()` switches to the globe on this frame only when `bootSettled` is already true.

## Diagnosis

`opening.ts` sets `elapsed` to `CINE.b13End - 0.05` (107.95 s) while `begun && !booted`, and only the `.then` of `earth.ready()` sets `booted`. A first visit passes `inpage.whenBooted()`, which is `loadGlobe().then(g => g.bootP)`. A rejection never entered that `.then`. A promise that never settles never did either. The loading-card catch

```text
.catch(e => console.warn('inpage prewarm', e))
```

is skipped when `cine` is true, and the click used to call `prewarm()` with no catch.

`formatClock(107.95)` is **241 million years ago**. `formatClock(108.025)` is **232 million years ago**, a label about 70 ms after B13. The hold snaps before paint, so a stuck frame does not read 232. The report and the hold are the same beat.

A wasm fetch that never returns also leaves `openForestPlanet` pending, and that `finally` is what starts the frame loop. The counter only reaches this beat if frames are already running. A hung wasm file is a freeze before the film, not this one.

On this VM the globe module did load and `bootP` did fulfill (see timings). Aborting `globeView.ts` in the browser reproduced the rejection: `cine earth ready` and `inpage prewarm` both logged the failed import, the counter ran through to Today, `hasSeenBigBang` became true once, the overlay came off, and the mode stayed `game` (the forest that was already drawing). That is SwiftShader, not omen.

## Timings (SwiftShader, not omen)

Chrome 156 headless, `--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist`, 1280×720, fresh context, `?start=sphere&stages=1&trees=v2&noprobe=1`. deviceMemory 16, 4 cores, so the page is in-page without `?transition=`. `noprobe` skips the Ultra bench only. Prewarm still starts on the click. Tool: `tools/cine-boot-measure.mjs`. `bootP` had already fulfilled when the globe object was first polled (25 ms), so these are upper bounds on click → `whenBooted`.

| Run | Module cache | bootP ms | full prewarm ms | step-loop ms | frames | tiles |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | cold | 4749 | 12837 | 8022.1 | 7 | 10 |
| 2 | cold | 4708.6 | 16056.6 | 11289.5 | 10 | 16 |
| 3 | dev-server cache warm | 1976.9 | 11702.1 | 9696.7 | 7 | 13 |

Prompt appeared in 23–25 s on the cold runs (`STARTUP cold`). That startup time is not the boot budget.

`BOOT_READY_MS` is `Math.ceil(4749)` = **4749**. It is the slowest successful `bootP`, not a rounded guess. A fulfillment already queued as a microtask beats the timer on a tie. The slowest full prewarm was 16.1 s. Earth is drawn at 83.2 s, after every prewarm here, so the steady film is not cut off. The gate stays `bootP`, which is what the clamp waits on.

## Number table

| Value | Game | Source | Match |
| --- | --- | --- | --- |
| Boot budget | 4749 ms | Slowest of the three SwiftShader `bootP` samples above | yes, ceil of that sample |
| Full prewarm | 16.1 s slowest | Same runs, not the gate | earth at 83.2 s is later |
| Held counter | 241 million years ago | `formatClock(107.95)` | the stuck frame |
| "232 million years ago" | ~108.022–108.028 s | `formatClock` | a passing label, not the hold |

No biological rate is introduced. The beat table in `cineBeats.ts` is unchanged.

## Tests

`tests/cine-ready.test.ts` drives `createOpening` with a fake document and controlled `step(1)` (no real timer):

- settling `ready()` crosses 108 s without stopping on 107.95, shows the earth once, lands once, marks the save once, leaves `#cine` up, layer gate on
- rejected `ready()` plays to 116 s, does not show the earth, lands once, removes the overlay
- a promise that never settles does the same after the measured budget
- reduced motion lands with the layer gate off
- `?cine=B7` seek to 112 s does not finish the intro
- return visit `bootChoice('sphere', true, …)` is `globe`
- `settleOr` returns the value, the rejection fallback, or the wait fallback, and does not cancel a late value

`npm test`: 1164 pass, 0 fail, 14 todo. `npx tsc --noEmit`: exit 0.

These node tests do not draw the globe. The browser runs below are the picture.

## Frames (SwiftShader)

`tools/cine-boot-arrival.mjs`. Same Chrome flags and URL.

- `tasks/evidence/T-0173/reject-today.png` — `globeView.ts` aborted. Counter and hero read Today · 13.8 billion years. The film was not sitting on 241 million years ago. HUD still hidden.
- `tasks/evidence/T-0173/reject-arrival.png` — same run, after `elapsed` 116, `hasSeenBigBang` true, `#cine` removed, `mode` `game`. The forest that was already rendering, with the game chrome. Not a cleared globe canvas. Console: `cine earth ready` and `inpage prewarm`, both the failed dynamic import.
- `tasks/evidence/T-0173/normal-b14.png` — globe module allowed. `mode` `globe`, `seen` true, `#cine` still up, `elapsed` 108.05, counter "229 million years ago" (the first B14 frame, the landing already on main). The disc is on screen. Coarse tiles are SwiftShader, not a claim about omen.

The normal landing stops the film at the first B14 frame, so the Today hero is not part of that path. That matches the code that was already on main. The rejection path is the one that plays through B14, because there is no globe to land on at 108 s.

## Needs from another agent

Omen, or any machine where Matthew saw the freeze. In the console, after the click:

- `cine earth ready` followed by an error means `whenBooted` rejected (failed `globeView` import or a throw inside it).
- `inpage prewarm` with the same error is the click-time prewarm.
- neither line, and the counter still moves through B14, means `bootP` fulfilled.
- a hang with no line and a counter stuck on "241 million years ago" means `whenBooted` was still pending past 4749 ms of film time. On this build that wait is bounded; if omen still sticks, the frame loop or `dt` is not reaching `step`.

Do not treat the SwiftShader stills as that measurement.

## Next

Grok Bot reviews the PR. Do not merge. Do not deploy.
