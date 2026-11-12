# T-0219 handoff

Branch `grokbot-2/intro-skip`, off main `0e2cf8e4`.

## Doing

The first-visit film now leaves on Escape, space, or a click after it has started. The skip sets the film clock to the end (`b14End`, label Today), runs `tintGlobe` and `driveFilm` for that time, then `paintDom` lands through `cinematic:complete` and `finishIntro`. The epoch is not left on the opening magma tint.

## Done

- `src/world/cosmos/opening.ts`
- `src/world/globe/globeView.ts` places the film camera inside `setFilmDrive`, so `releaseFilm` keeps the arrival orbit
- `tests/cine-ready.test.ts` — Escape at about 5 s, clock at the end, label Today, mean era colour within 10% of a natural finish
- Frames: `tasks/evidence/T-0219/before-5s.png`, `after-escape.png`, `natural-finish.png`, `side-escape-finish.png`
- Chrome SwiftShader. Skip altitude 23572732 m, the same as the natural finish. Whole-frame mean RGB within 2.4%.

## Next

Push to the open PR. Do not merge it from this agent.

## Needs from another agent

None.
