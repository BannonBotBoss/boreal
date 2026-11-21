# Skill: Live Photo Rewind/Video/Edit, Needs/V-Camera-Mode/HUD, Audio Hotkey/WebGL-Loss/Resize, and In-Page Drone Band Audit

Use this skill when auditing or fixing Boreal's live Photo Mode rewind/video/sequence/gallery-edit pipeline (`src/photo/photoMode.ts`, `src/photo/gallery.ts`, `src/render/buildScene.ts`, `src/render/post.ts`), embodied needs / `V` camera-adjust mode / desktop HUD prompts (`src/input/padRouter.ts`, `src/main.ts`, `src/core/wolfModes.ts`), global audio hotkey guards & WebGL context-loss recovery (`src/audio/borealSound.ts`, `src/main.ts`, `src/style.css`), and in-page mid-altitude drone flight band (`src/world/globe/inpage.ts`, `src/render/droneGrade.ts`).

## Steps
1. **Start an isolated Vite dev server on an agent-range port** (`agy`: `5250–5269`, never `5173–5209`) and launch headless Edge/Chromium via CDP (`--headless=new --use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader`). Record a real VP8 WebM screencast via CDP `Page.startScreencast` + `ffmpeg`, and always terminate browser & Vite process trees cleanly in `finally`.
2. **Audit Live Photo Mode Rewind, Video, Sequences, & Viewfinder Gallery Edit (`/?nomenu=1&noprobe=1&rec=1`)**:
   - Walk forward (`W` for `~3 s`) to populate `hub.ring`, enter Photo Mode (`#photo-btn`), scrub `#photo-time` to `0`, and verify snapshot rewind coverage across mother wolf, `litter` wolf pups, `driveBridge` Red Fox, `needs`, and `worldSec`/sky.
   - Verify `PHOTO_PARAMS` `focalLength` slider default matches the live camera FOV (not `0 < min: 12` which clamps to `12 mm`).
   - Record a video (`#photo-bar [data-a="rec"]`), wait for `#photo.recording`, and test pressing `Escape` while recording with `gallery.count === 0` — verify `photo.exit()` awaits `recorder.onstop` before checking `gallery.count` so the video is never orphaned behind an unopened gallery.
   - Close Photo Mode (`Done`), reopen Gallery via the bottom-right Viewfinder `Gallery` button (`#vf-bar`), click `Edit` on a photo-mode capture, and verify the world freezes (`active = true`, `body.photo-mode`), gameplay HUD hides, and `WASD`/drag moves the photo camera instead of walking the wolf.
3. **Audit Live Needs, Thought Bubbles, Senses Halo (`O`), `V` Camera Mode, & Desktop HUD (`/?nomenu=1&noprobe=1&rec=1&needs=water:8,energy:8,rest:8`)**:
   - Confirm critical thought bubbles and Senses Halo (`O`) toggle cleanly.
   - Verify pressing `Space` at `Energy <= 10` communicates why jump is blocked instead of failing silently.
   - Verify `#status` displays active keyboard bindings (`Shift run · C stealth · F focus · Q lock` / `release Shift / C`) when `connectedGamepads === 0` rather than hardcoded Xbox `RT`/`LT`/`LB`/`release triggers` copy.
   - Verify pressing `V` (`cameraMode`) with `#camera-panel` closed does not hijack desktop keyboard into Pad Menu's `Badges` tab; with `camera.exposure` unlocked (`localStorage['boreal.badges'] = '{"camera.exposure":"test","camera.filters":"test"}'`), verify keyboard navigation/adjustment/Escape work on `.padx` instead of ignoring keyboard atoms and opening Pause behind `.padx`.
4. **Audit Audio Hotkey Guards, Live Resize, & WebGL Context Loss**:
   - Dispatch `Ctrl+-` and `Ctrl+M` during gameplay, and dispatch `n`/`[`/`-` while a `<select>` outside `#start-menu` (e.g., `#photo-panel select`) has focus; verify `borealSound.ts` ignores `e.ctrlKey || e.metaKey || e.altKey` and `SELECT`/`TEXTAREA`/`isContentEditable`, and provides brief visual feedback on intentional audio hotkey changes.
   - Resize live between `1280×720`, `640×720`, and `800×600`, verifying canvas backing size tracks layout and top HUD elements (`Data (U)`, `<header>`, `#interaction`, `#status`) do not collide.
   - Trigger `gl.getExtension('WEBGL_lose_context').loseContext()` on active gameplay and verify the recovery card includes a clickable Reload button, halts the `requestAnimationFrame` draw loop, and disables/hides stale interactive HUD buttons.
5. **Audit In-Page Mid-Altitude Drone Flight Band (`/?nomenu=1&noprobe=1&transition=inpage` and `&hour=1`)**:
   - Trigger `Shift+G` ascent (`Shift` held across frame tick before `G`) and verify the transition from `2,100 m` band top to orbit has no `6,674×` single-frame altitude snap.
   - Drop to `400 m` drone glide (`G`), capture daytime `400 m` aerial vs `reference/ref-0-blm-wasson-lake-conifer-aerial.jpg`, test `WASD` + `Space` flight, and trace frame-by-frame camera Y on `G` embody (verifying smooth handover blend instead of a `1`-frame `404.35 m -> 4.47 m` teleport).
   - Enter `400 m` drone band at `01:05 AM` midnight (`?hour=1`), verify `scene.fog.color` follows the night sky instead of hardcoded midday blue `RGB(0.45, 0.62, 0.9)` (`inpage.ts:476`), and verify frame mean luminance `< 0.25` / clipped white `< 5%` against `reference/ref-1-midnight-boreal-forest-aerial-reference.jpg`.
6. **Verify gates**:
   - Run `npx tsx refs/audit/live-photo-needs-webgl-drone-audit/audit.ts` -> `calibrationValid = true`, `4 / 4` pass `>= 0.95`.
   - Run `npx tsc --noEmit` and `npm test` (including `tests/sim-home.test.ts`, `tests/rules.test.ts`, `tests/gait-gate.test.ts`, `tests/tasks.test.ts`).

## Pitfalls to Avoid
- Never touch files in `tests/sim-home-ceiling.json` in a way that increases their line count; keep any new simulation state in `rust/boreal-sim` (`AGENTS.md`).
- When dispatching `Shift+G` or `Shift`+`C` chords via CDP under SwiftShader, hold `Shift` across at least one `requestAnimationFrame` tick before pressing the second key so `wolfModes.ts` and `bindings.ts` observe the real key-order sequence rather than a same-sample tie.
