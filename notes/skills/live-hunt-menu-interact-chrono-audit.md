# Skill: Live Hunting Carry, Pause Menu `More`, World Interactions & Chronometer/Photo Audit (`live-hunt-menu-interact-chrono-audit`)

Reusable workflow for live browser verification of Boreal's end-to-end hunting carry pose, `Pause -> More` sub-panel round-trips, rock/herb world interactions, and Chronometer/Photo Mode UX.

## When to Use
- Auditing or verifying carried-prey 3D placement and rotation (`src/animals/hare.ts`, `src/core/huntHold.ts`) on non-zero staged terrain elevation and non-zero wolf headings.
- Auditing or verifying `Pause -> More` sub-panels (`Appearance`, `Planet view (Shift+G)`, `Photo mode`, `Generation inspector`) in `src/ui/menu.ts` and `src/main.ts`.
- Auditing or verifying `E` world interactions (`src/core/rocks.ts` `placeRockSeed`/`pushContact`, `src/core/events.ts` herb gather, `src/core/fields.ts` regrowth, `src/render/buildScene.ts` `revision` chunk rebuilds).
- Auditing or verifying Chronometer (`T`) date rollover, diurnal weather sync, scrub input preservation, `#help-binds` copy vs `P` key, and Photo Mode Gallery exit state.

## Steps
1. **Launch temporary Vite server** on an agent-range port (`agy`: `5250–5269`, never `5173–5209`) with headless Microsoft Edge (`--use-gl=angle --use-angle=swiftshader --enable-webgl --mute-audio`) and clean teardown in `finally`.
2. **Test Hunting II carry on elevated staged terrain at a non-zero heading** (`?nomenu=1&noprobe=1&rec=1&stages=1&trees=v2&tier=4&hour=12`):
   - Place wolf at `yaw = 1.2 rad` on a hare, pounce (`Space`), record VP8 WebM (`canvas.captureStream(15)` + `MediaRecorder`), walk briefly, and sample `wolfRoot.position.y`, `heldHare.root.position.y`, and `heldHare.root.rotation.order`.
   - Verify `hareY > wolfY + 0.25` (elevated in jaws, never buried underground) and `rotation.order === 'YXZ'` matching `huntHold.ts` `yawOf(heading, rotX(pitch, ...))`.
3. **Test `Pause -> More` round-trips live**:
   - Open `Esc -> More -> Appearance`, capture PNG before and after moving sliders to extremes, and verify the canvas redraws live (non-identical bytes).
   - Open `Esc -> More -> Planet view (Shift+G)` and verify `#start-menu.hidden === true` and globe frames actually render.
   - Open `Esc -> More -> Photo mode` and verify `document.activeElement` is NOT trapped inside `#start-menu` on an orphan `Back` button.
4. **Test rock pushability & herb gathering live**:
   - Count pushable (`rockDiameter <= 0.22 m`) vs total rocks on forest floor (`fastRockSite(x, z).rock < 0.2`) across `3×3` staged chunks.
   - Gather a `plant` herb via `E`, check `records[key].removed`, `#act`, and deterministic `1.5 s` regrowth in `fields.ts` `settledGrams`/`takePatch` so micro-regrowth (`~1.8 µg`) cannot award another full `+1` herb.
5. **Test Chronometer (`T`), `P` key, and Photo Mode Gallery exit**:
   - Verify `.chrono-face` shows calendar date on midnight rollover, `weatherAt().tC` responds to a 12-hour scrub, held arrow keys survive `T` toggle, `#help-binds` matches actual `P` behavior, and `#photo-gallery` review clears `body.photo-mode`.
6. **Run calibrated Rule 11 script** (`refs/audit/live-hunt-menu-interact-chrono-audit/audit.ts` -> `numbers.json`) and verify `calibrationValid === true`, `knownMatchScore >= 0.99`, `knownMismatchScore <= 0.25`, `npx tsc --noEmit`, and board/guardrail tests (`tests/tasks.test.ts`, `tests/gait-gate.test.ts`, `tests/sim-home.test.ts`, `tests/rules.test.ts`).

## Pitfalls to Avoid
- Never test `carryPlace` only on flat `y = 0` ground at `heading = 0` — that masks both the missing `heightAt` elevation offset (`-1.85 m` burial on staged Kenora hills) and the `'XYZ'` vs `'YXZ'` Euler roll bug (`71.68°` error at `yaw = 1.2 rad`).
- Always verify `localStorage` and visual screenshots separately for `Pause -> More -> Appearance`: `localStorage['boreal.genome.v1']` can update while `main.ts:757` freezes the 3D canvas completely.
- Always check `tasks/T-*.md` across all branches before proposing to guarantee zero overlap with existing tasks, and write JSON events as UTF-8 without BOM matching Pacific local time (`-08:00` PST / `-07:00` PDT).
