# T-0043 handoff (grok-globe)

- **Doing:** globe drag release inertia (tasks/T-0043-globe-inertia.md). Requested by Matthew directly in chat 2026-10-22 23:37 PT:
  "when i grab and rotate the globe, allow it to continue rolling a bit,  say, for 3 seconds".
- **Branch:** grok-globe/globe-inertia, worked on the box in /workspace/boreal-gh (omen offline at ~00:08 PT; its claim 868fb95 and
  its code never reached origin, so both were redone here on top of origin's 0a29beb propose + eb11755).
- **Status:** completed. approve-plan by grok for matthew (23:48 PT, f4f3f58 on main, verified); origin/main merged (408feae);
  claim 00041fe; tests first e87f8d8; code 86bb20d; evidence + complete event; PR. Review via tools/agent-review.mjs; not merged.

## Prior art (reuse only; Matthew 2026-10-23: "dont be reinventing stuff")
- **three `THREE.MathUtils.damp(x, y, lambda, dt)`** (https://threejs.org/docs/#api/en/math/MathUtils.damp): three's
  frame-rate-independent exponential smoothing (lerp by 1 - e^(-lambda dt)). It is the whole coast and the drag-rate smoothing.
  No hand-written decay; eb11755's (1 - t/3 s)^2 test and the planned inertia.ts were dropped.
- **three OrbitControls** (already the globe's drag): its `getAzimuthalAngle()` / `getPolarAngle()` give the drag's angles,
  its `start` / `end` events mark grab and release. Its own `enableDamping` / `dampingFactor` is a per-frame factor: the tail
  halves at 2x the frame rate and any longer tail lags every drag, so it cannot give "3 s at any frame rate" (now off).
- **camera-controls (yomotsu)** (https://github.com/yomotsu/camera-controls, MIT): considered (time-based smoothing), not added as
  a dependency: it would replace OrbitControls and the globe's own log zoom/heading code for one feature three already has.

## Built
- `transition.ts`: `GLOBE_COAST = { sec: 3, rest: .02, track: .05 }`, `coastLambda = ln(1/rest)/sec` (1.304 /s): speed is 2 % of the
  release speed at 3 s, where the coast stops.
- `globeView.ts`: `controls.enableDamping = false` (drag is 1:1). While dragging, the drag rate in OrbitControls' spherical angles,
  divided by `rotateSpeed` (so the coast slows with altitude like the drag), is damp-smoothed (lambda 1/track = 20 /s). After `end`
  it is damped toward 0 with `coastLambda`; the camera direction turns by the trapezoid of the speed each frame.
  Stops at once: OrbitControls `start` (a new grab), any pointerdown on the globe, H, the in-page descent (`ext`: the transition
  flies the camera), the standalone auto handoff (`leaving`), `attachInput(false)` (game mode, menu), and 3 s.
  Dev: `globe.coasting`; standalone `window.__globe` (the capture script reads it).
- PR #35 comment follow-ups: transition.ts T-0034 cloud comment says 1500 km -> 150 km; surfaceAt.ts isDry and dryStartSteps each
  under their own comment; atmosphere.ts setClear comment names the clearLift threshold rise (and setTier's comment is back on setTier).

## Numbers (rule 6)
| value | game | real figure + source | resembles? |
|---|---|---|---|
| coast length | 3 s to 2 % speed (lambda 1.30 /s) | Matthew's spec "say, for 3 seconds"; iOS UIScrollView `DecelerationRate.normal` 0.998 per ms (https://developer.apple.com/documentation/uikit/uiscrollview/decelerationrate/normal) reaches 2 % in 1.95 s (lambda 2.0 /s) | yes: same exponential fling shape, 1.5x longer as asked |
| coast distance | release speed x 0.75 s | iOS normal: release speed x 0.49 s (1/lambda) | yes (longer by design) |
| drag-rate smoothing | 50 ms time constant | pointer events 60-125 Hz (8-16 ms) vs frames: ~3-6 events | yes (forgets a 0.5 s hold: 4.5e-5 left) |

## Measured (refs/T-0043/capture.mjs on the box: headless Chrome, SwiftShader software GL, standalone `?view=globe&hour=12`, mouse drag 48 px
in 0.6 s released while moving; every rAF logs `globe.coasting` and the camera direction)
- **Coast time**, timing pass (no screenshots, median 13.7 fps): `globe.coasting` true from release to **3.18 s wall**, **2.95 s of globe
  time** (sum of the globe's dt, which is capped at 0.1 s per frame); stops on the first frame past 3 s (one frame = ~70 ms here).
  Speed (deg/s, +-250 ms windows): 0.15 s 24.7, 1 s 11.8, 2 s 3.2, 3 s 1.2, 4 s 0. v(2)/v(1) = 0.272 vs e^-1.304 = 0.271 expected.
- Stills pass (screenshots stall frames past the 0.1 s dt cap): 3.73 s wall, 2.90 s globe time; longitude 91.8 -> 108.3 (+1 s)
  -> 110.7 (+2 s) -> 111.9 (+3 s) -> 112.8 deg (+4 s, at rest).
- Unit tests (tests/globe-inertia.test.ts): MathUtils.damp with coastLambda at 60/144/240 fps: same speed at 1/2/3 s (< 1e-9),
  2 % at 3 s, same distance (< 0.1 %) = the continuous integral (< 0.2 %); wiring + every stop by source check.
- Calibration (rule 11): the rec log's clock is performance.now; the known-good case is the unit-tested damp curve (ratio 0.271 per s),
  matched by the browser to 0.4 %. Software GL fps are NOT comparable with omen's GPU.

## Checks
- npm test 493 pass / 0 fail (506 incl. todo/skip); `npx tsc --noEmit` clean.
- smoke-tiers on the box: see the complete event (software GL; the tool's GPU check fails by design there).

## Frame answers (rule 6)
- grid.jpg / coast-*.jpg: before the drag the lit planet with home's green continent at centre; at release the globe has turned east
  (~26 deg): a blue ocean disc with white cloud cells and green land; +1 s it has rolled on noticeably (land moved left by ~1/5 of the
  disc); +2 s, +3 s smaller steps; +4 s the same as +3 s (at rest). coast.mp4: the roll eases out smoothly, no jump at release or at the stop.
- Natural? A flicked globe on a bearing slows smoothly to rest; this does, with no snap. 95 % reference gate: N/A (input-feel timing,
  nothing new to look at); substituted the calibrated speed-ratio and coast-time measurements above.

## Risks
- Drag is now 1:1 with the pointer (no 0.12 lag): it feels tighter; anyone used to the old floaty drag will notice.
- A release after holding still gives (almost) no coast, by design (50 ms smoothing).
- Wall-clock coast stretches when frames exceed 0.1 s (the globe's existing dt cap), e.g. 3.7 s while screenshots stall it.
- Not measured on omen's GPU (offline): run the capture there at 60/144 fps once it is back.

## Needs from another agent
- None.
