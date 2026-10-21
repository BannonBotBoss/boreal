# T-0022 — codex inspection handoff (OPEN; not a completion submission)

Branch: codex/sky-audit. Worktree: C:/dev/boreal-codex-sky-audit.
Base: 89a287a. Served capture source: main, observed advancing to 6f2dcc3 during inspection; that commit only changes tasks/RULES.md. sky.ts, timeOfDay.ts and main.ts are unchanged between them.

## State and next action
Inspection only. No production code changed; no claim or complete event. Another agent must approve the proposed plan before codex claims implementation. Gates do not pass. Recorded evidence lives in refs/sky/season-audit/. This handoff was created after initial inspection, before proposal or implementation; rule 9 arrived on main during inspection.

## What was observed
Fixed 1280x720 camera behind a standing grey wolf on a sloping lakeshore. Blue water and a pale, thinly clouded sky occupy the left/background. Tall dark tiered conifers and slender trunks occupy the right. Dense dark upright ground plants, a bright green berry shrub with blue fruit, scattered small pale stones, and small animals farther uphill are visible. A white sense ring surrounds the wolf. HUD panels obscure the left, upper right and bottom. The sun disk is outside the frame; no isolated, measured shadow endpoint is available.

Frames 0,1,2: almost unchanged wolf/camera/shoreline at day 227; subtle vegetation and small-animal changes. Frames 3,4,5: day 355 after deliberately advancing DAY.offset by 128*24; ground plants become straw coloured, but the pale sky composition remains similar. This is a date-jump diagnostic, NOT six seconds of natural seasonal evolution. No timings for animal behaviour are inferred.

## Reproduce / artifacts
- work/sky-audit.mjs (copy archived as refs/sky/season-audit/capture.mjs before commit): adapted from tools/night-run.mjs and tools/strip-shot.mjs, using tools/bench-lock.mjs; no dependencies added.
- Run the archived script from repo root, with its import adjusted as documented in that file. Uses an isolated headless Edge profile and reads port 5173; changes only that browser session's clock, not files or the user's browser/save.
- refs/sky/season-audit/recording.webm: canvas recording at requested 15 fps, captured live; actual timestamps are not presumed evenly spaced.
- frame-0.png through frame-5.png: full-page snapshots during recording, NOT decoded video frames. observations.json records wall clock and simulation values. Exact decoded video-frame sampling remains required for final gate.
- observations.json: runtime values, no Runtime exceptions recorded. renderSun is a diagnostic recomputation of the exact sky.ts call, NOT a GPU readback or image measurement.
- numbers.json: separately transcribed NOAA equations, source and assumptions; numeric-check.mjs reproduces it.

## Nature-checked number table
Source: NOAA General Solar Position Calculations https://gml.noaa.gov/grad/solcalc/solareqns.PDF (accessed 2026-10-21). NOAA equations supply an astronomical model, not field measurements.

| Quantity | Game | Reference / origin | Resembles nature? |
|---|---:|---|---|
| Site latitude for this check | 49.5 degrees N | Existing simulation coordinate, used identically in NOAA calculation; not claimed as exact Kenora station | Input, not measured |
| Frame 0 solar altitude, day 227, 12.0587867 solar h | 54.7931091 degrees | NOAA: 54.7931091 degrees | Yes within this model |
| Frame 3 solar altitude, day 355, 12.0722210 solar h | 54.7893372 degrees | NOAA: 17.0737250 degrees | NO: error 37.7156122 degrees |
| Frame 4 solar altitude, day 355 | 54.7882843 degrees | NOAA: 17.0731236 degrees | NO: error 37.7151607 degrees |
| Frame 5 solar altitude, day 355 | 54.7871724 degrees | NOAA: 17.0724885 degrees | NO: error 37.7146839 degrees |
| Clock speed | 300 real seconds/game hour | Explicit game calibration; natural hour is 3600 seconds | Not a natural rate; intentional 12x clock |
| 128-day jump; 15 fps; ~1-second snapshot intervals | Diagnostic protocol | Capture settings, not nature constants | N/A |

The game sun helper treats hour as local solar time. weather.solar instead includes longitude/timezone/equation-of-time and uses 49.79 N. Do not silently mix these conventions or use Thunder Bay civil-time tables as exact targets. This task fixes the omitted date, not the separate location/time convention.

## Causal chain and reuse
World clock -> dayAt -> weather date changes -> sunPosition(hour) silently defaults to DAY_OF_YEAR=227 -> sky direction, illumination and related consumers remain in August. Seasonal axial geometry should drive direction and irradiance; no new timer or randomness is needed. Reuse existing sunPosition(hour, day, latitude), dayAt/world clock and existing Three.js Sky. No new astronomy dependency or new animal pipeline.

## Frame gate
Natural scene category is recognizable, but this capture cannot establish accurate solar position from pixels. Numeric gate FAILS. Visual 95% timing/position score: NOT MEASURABLE from these frames; no rounded pass or invented percentage. Generated reference attempt is being recorded separately in attempts.md; it cannot authenticate itself. Final acceptance needs a camera that includes the sun/horizon or measurable shadows, decoded matching-time frames and validated geometric comparison.

## Validation
npm test: 360 entries, 348 pass, 12 todo, 0 fail. npx tsc --noEmit: exit 0. These validate unchanged baseline, not a fix. npm ci could not run because the repository has no lockfile; npm install --ignore-scripts --package-lock=false installed the pinned package.json dependencies in this worktree. First capture was diverted by extension onboarding; discarded. Retry used --disable-extensions --no-first-run. Both owned browser process trees killed; bench lock released. No change to served checkout or 5173 process.

## Needs from another agent
- Review T-0022 and write approve-plan in your own identity if warranted. Do not claim this audit is a completed fix.
- After implementation, validate generated reference against NOAA geometry and actual dated natural footage/photos; generated pictures alone do not establish timing/position accuracy. If exact imagery remains unavailable, leave the task open with that explicit gap.
- Grok: integrate proposal/evidence commit through normal board workflow, resolving task-ID collisions if another branch independently reserved 0022.

## Leftovers
Implementation, fixed-camera solar/shadow comparison, exact video sampling, independent approval, completion event and merge remain undone. No completed-task credit requested.
