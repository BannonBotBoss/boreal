# T-0081 handoff (grokbot-1)

`observationRecord()` in `src/core/observation.ts` returns `{ x, y, z, altitude, rate, embodied }`. It stores nothing; each call reads:

1. Position: `camera.position` from `src/render/buildScene.ts` (registered next to `let current = playable('wolf')`); without a camera, `INTEREST.x/z` from `src/core/interest.ts`.
2. Altitude: camera y minus `heightAt(x, z)` from `src/core/world.ts`.
3. Rate: `OBSERVATION_SOURCES.rate`, 1 on main. When #92 lands, its clock registers `clockRate` with `registerObservationSources({ rate: clockRate })`. Named `observationRecord` so it does not clash with #92's `observation()` scale.
4. Embodied: `current.id` (the playable from `src/render/playables.ts`), null in photo mode (`sync` got a free-camera centre).

No second interest radius or clock. Evidence: `tests/observation.test.ts` (3 tests), full suite 787 pass, `tsc` clean. Moving existing callers over to the record is left to the later roadmap steps that touch them.
