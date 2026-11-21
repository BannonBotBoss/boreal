# Skill: Live Universe Seed / Big Bang, Play As Switching, Autonomous Wolf & Data/Controls/Graphics Audit (`live-universe-playas-auto-ui-audit`)

Reusable workflow for live browser verification of Boreal's Start Menu universe/legacy seed flows, `Pause -> More -> Player` runtime species switching, `Autonomous: On` wolf & herbivore behavior, `Data (U)` panel keyboard/pad hooks, and `Pause -> Controls` / `Graphics` menus.

## When to Use
- Auditing or verifying `Generate universe` / `Universe options…` / `Forest only (legacy)…` seed persistence and Big Bang opening lifecycle (`src/main.ts`, `src/core/universeSeed.ts`, `src/world/cosmos/opening.ts`, `src/ui/menu.ts`).
- Auditing or verifying runtime `Play as` switching (`Wolf -> Deer -> Snowshoe Hare`) across autonomy, HUD prompts, vocals, and rig state (`src/main.ts`, `src/render/buildScene.ts`, `src/render/playables.ts`).
- Auditing or verifying `Autonomous: On` routing, obstacle avoidance, energy conservation, and scent/water wiring on staged hillside terrain (`src/core/autonomy.ts`, `src/core/plan.ts`, `src/main.ts`).
- Auditing or verifying `Data (U)` global key capture / pad polling (`src/ui/dataPanel.ts`), `Pause -> Controls` rebinding (`src/ui/controls.ts`), and `Pause -> Graphics` Quality synchronization, `GOVERNOR.probeCap` immutability, `<select>` contrast, and header overlap (`src/ui/menu.ts`, `src/core/renderSettings.ts`, `src/style.css`).

## Steps
1. **Launch temporary Vite server** on an agent-range port (`agy`: `5250–5269`, never `5173–5209`) with headless Microsoft Edge via Playwright (`channel: 'msedge'`, `--use-gl=angle --use-angle=swiftshader --enable-webgl --mute-audio`) and clean teardown in `finally`.
2. **Test Start Menu `Generate universe` twice & `Forest only (legacy)…` seed**:
   - Generate universe seed `1400`, confirm `#cine` plays on first run, skip to globe (`Escape`), open Start Menu (`Escape`), and click `Generate universe` a second time — verify whether `#cine` plays for the new universe instead of skipping via preserved `introComplete: true`.
   - Open `Universe options… -> Forest only (legacy)…`, enter seed `424242`, click `Start`, reload, and verify `STAGES.seed` actually equals `424242` (not overridden by stale `boreal.universe.seed.v1`).
3. **Test `Pause -> More -> Player` runtime switching (`Wolf -> Deer -> Snowshoe Hare`)**:
   - Switch live to `deer` and `hare`, enable `Autonomous: On`, and verify the herbivore does NOT execute `autonomousWolfStep()` (`following hare ...`), does not display wolf `Q lock` hints, and cannot wolf-howl/growl.
4. **Test `Autonomous: On` wolf on sloped staged terrain & thirsty mode**:
   - Record VP8 WebM (`canvas.captureStream(15)` + `MediaRecorder`) over ~4 s on `?nomenu=1&noprobe=1&rec=1&stages=1&trees=v2&tier=4&hour=12`.
   - Check yaw stability (no `> 180°` spin spikes), continuous travel past open-meadow stones (no permanent `waiting: the way is closed` deadlock from `|heightAt(to) - h0| <= 0.45 m`), energy conservation (no free `+1/s` refill while idle without food), and live scent/water wiring (`?needs=water:15`).
5. **Test `Data (U)` + `Pause -> Controls` rebinding + `Pause -> Graphics`**:
   - Open `Data (U)`, test `View early universe` and `Follow game clock`, close `Data (U)`.
   - Open `Esc -> Controls`, click an action row (`Howl`, entering `.capturing`), press `U`, and verify `U` binds to `Howl` instead of popping `#data-panel` open.
   - Open `Esc -> Graphics`, select `Ultra`, verify `renderStore` (`quality.auto` / `quality.tier`) stays synced, `GOVERNOR.probeCap` is never clobbered downward, `<select>` text meets WCAG AA (`>= 4.5:1`), and `Graphics` does not overlap `Boreal`.
6. **Run calibrated Rule 11 script** (`refs/audit/live-universe-playas-auto-ui-audit/audit.ts` -> `numbers.json`) and verify `calibrationValid === true`, `knownMatchScore >= 0.99`, `knownMismatchScore <= 0.25`, `npx tsc --noEmit`, and board/guardrail tests (`tests/tasks.test.ts`, `tests/gait-gate.test.ts`, `tests/sim-home.test.ts`, `tests/rules.test.ts`).

## Pitfalls to Avoid
- Never test `Generate universe` only on a blank `localStorage` — the Big Bang skip bug (`clearWorldSaves(true)` keeping `introComplete: true`) and the `Forest only (legacy)…` seed override (`boreal.universe.seed.v1` shadowing `boreal.seed.v1`) only appear on a second run once a universe seed and intro flag exist!
- Never test `plan()` / `wolfGround()` only on flat `y = 0` terrain — the permanent `waiting: the way is closed` deadlock only fires on gently sloping staged hills where a stone's detour endpoint differs by `> 0.45 m` from the wolf's starting elevation.
- Always check JSON event files are UTF-8 without BOM and match Pacific local time (`-08:00` PST / `-07:00` PDT).
