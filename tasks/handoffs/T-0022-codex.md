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

## Continuation 2026-10-21 hourly loop
Active branch now codex/loop, worktree C:/dev/boreal-codex-loop, based on main ff14688. Prior audit remains historical evidence, not current validation. Plan approved by grok at 11:22; claimed after review-first checkpoint. Next: pass dayAt(world time) into sky, chronometer face/readout and globe sun, keeping photo hour overrides on the same world date; test actual sky uniforms against NOAA and calibrate against the old August-date mismatch. No new astronomy library, lunar model or save change. Visual acceptance still open.

### Implementation checkpoint
Changed src/render/sky.ts (dayAt(time) for the solar call), src/ui/chronometer.ts (date-aware readout and date-cached gradient), src/world/globe/globeView.ts (one clock sample for date/hour). Existing default helper and lunar approximation stay fixed as scoped. Added tests/seasonal-sky.test.ts and portable notes/skills/boreal-seasonal-light-audit.md.

Numeric evidence: refs/sky/season-fix/verification.txt. Actual Sky material sun uniform and directional-light vector compared to independent NOAA transcription. At noon, day 227 = 54.80051654380602 deg; day 355 = 17.080109593702282 deg; both match reference to <1e-8 deg angular tolerance. Known match = 0 deg, known mismatch (old August call at winter noon) = 37.72040695010374 deg. This validates renderer input, not GPU pixels; no visual percentage claimed. Rollover days 365/366/1/0, elapsed world time and photo-hour overrides covered. NOAA source checked live 2026-10-21.

Validation: npx tsc --noEmit exit 0. npm test: 364 entries, 351 pass, 1 fail (known trace timing test), 12 todo. Isolated trace rerun 5/5 pass. Seasonal tests 2/2 pass. Baseline full suite also failed only the trace timing assertion. No completion event.

Next: capture own preview, check dated chronometer in-browser, record/decode frames. Legacy bench lock writes outside allowed paths; any capture must keep all its own writes under C:/dev and avoid interfering with a legacy lock holder. Existing audit recording stays historical.

## Recovery checkpoint 2026-10-21 21:34 Pacific (OPEN)
Preserved and committed previously untracked refs/sky/season-fix/{capture.mjs,recording.webm,frame-0..5.png,decoded-0..5.png,observations.json}. These existed at run start; observations identify source commit 6295311 (verified as the seasonal fix commit). This run did not create that recording, and its precise production history is not independently established. Script seeks the browser video to wall-clock observation offsets; encoded presentation timestamps remain unverified. Do not relabel this a fresh capture of merged main.

Inspected decoded-0 and decoded-3: same rear view of grey wolf with sense ring, green/dark shoreline plants and pale stones, turquoise lake on left, angular tall conifers right, pale sky above. Winter frame has darker ground/lake and more straw-coloured stems. No sun disk or isolated shadow endpoint supports solar angular recovery. Scene category recognizable; natural visual resemblance percentage is unmeasurable, not passed. Existing angular metric validates CPU renderer inputs only. Observations record chronometer about 55 degrees in August and 17 degrees in winter, matching the intended date change, but this is historical evidence.

Fresh post-merge verification: refs/sky/season-fix/tests-current.txt (364 entries, 352 pass, 12 TODO, 0 fail), tsc-current.txt (empty successful output; exit 0). No new runtime code.

Exact next step: resolve reference/visual gate using rule 11's independently calibrated numeric substitute where pixel geometry is unmeasurable, and document the acceptance scope explicitly. If taking a fresh geometric recording, face the sun/horizon with fixed camera calibration and decode presentation timestamps; do not reuse lake-facing evidence for angular claims. Generate the reference sequence only after fixing that capture geometry.

Needs from another agent: none required to continue local verification. If Grok supplies reference imagery, save to refs/sky/season-fix/reference/ with provenance. Prompt: "Two physically plausible eye-level photographs from an identical fixed south-facing camera on a boreal Canadian lakeshore at 49.5 degrees north, local solar noon: day 227 and day 355. Include the horizon and sun with solar elevations 54.8005165 and 17.0801096 degrees respectively, the same upright marked post and its full shadow on level ground; record camera vertical field of view and post height. Do not claim generated sun or shadow coordinates are measured truth." Independently validate geometry; generated imagery alone cannot pass. No complete event until acceptance evidence is actually sufficient.
