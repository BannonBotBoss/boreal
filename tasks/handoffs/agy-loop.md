# agy-loop Handoff (2026-11-14 21:03 PT — Live Capture & Reference Images Complete; Finalizing Numeric Gate & Proposing T-0233)

- **Agent**: `agy`
- **Home worktree**: `C:\dev\boreal-agy-loop` (branch `agy/loop`)
- **Proposal worktree**: `C:\dev\boreal-agy-t0233` (branch `agy/t0233-propose`, off `origin/main` `ce7f5db`)
- **Run start**: `2026-11-14T20:40:03-08:00` (`America/Los_Angeles`; budget ~50 min, stop by ~21:28 PT)

## Step 0: Rule 15 Review First & Claimability Check (Complete)
- Pulled `origin` and verified both `main` (`871531a`) and `origin/main` (`ce7f5db`) are merged into `agy/loop`.
- Inventoried all open GitHub PRs oldest-first (`#413` `05cb5735`, `#414` `26381111`, `#448` `e9d8d50b` Draft `T-0222`, `#449` `83d1b0ec` Draft `T-0223`, `#466` `a6b6ef71` `agy` `T-0232`) and `git log --all` since `2026-11-14T04:01:58Z`.
- Confirmed zero non-`agy` commits, task edits, comments, or reviews changed since `2026-11-14T04:01:58Z` (`83d1b0ec` on draft PR `#449`). Under Rule 15 ("Unchanged blocked submissions"), all previously reviewed non-`agy` blocked submissions remain unchanged at their reviewed SHAs, task objectives, and evidence identities.
- Verified every `approved` task on `npx tsx tools/tasks.ts`: all are already merged on `origin/main` except `T-0040` (forbids second implementation while `C:\dev\boreal-grok-eco` exists). None of `T-0224..T-0232` has received a non-`agy` `approve-plan` event yet. Next free task ID across all branches: `T-0233`.

## Steps 1–2: Live Screen Recording, Sampled Frames, & Reference Images (Complete)
- Recorded live gameplay video (`recording.webm`), sampled 3 `1280x720` frames (`frame-0.png`, `frame-1.png`, `frame-2.png`), and captured runtime telemetry (`observations.json`) in `C:\dev\boreal-agy-t0233\refs\camera\viewfinder-photo-optics-audit\` via `agy` port `5259` (Vite and headless Edge cleanly terminated).
- Generated two `1280x720` photorealistic nature/optical reference images in `refs/camera/viewfinder-photo-optics-audit/reference/`:
  - `ref-0-shoreline-wolf-shallow-dof-above-water.png`
  - `ref-1-boreal-night-manual-exposure-natural-darkness.png`
- Measured findings across all four coupled defect areas:
  1. **Camera placement & water/slope/obstacle clearance**: `positionCamera` (`math.ts:32, 38`) evaluates `heightAt(x, z)` at the subject rather than `(camX, camZ)` `3.2 m` astern (burying the hare camera `-0.248 m` underground at `(-184, -72, yaw=0.7854)`), `photoFlyFloor` (`fly.ts:55`) hardcodes `-0.25` instead of staged lake/river surface elevation `surfaceAt` (plunging the Photo/Drone camera `> 1.5 m` beneath upland staged lakes), and zero obstacle spring-arm raycast prevents tree trunks / boulders from enveloping the lens.
  2. **Viewfinder `EV100` photometry, dead exposure under `EffectComposer`, dead `Focal mm` slider, filter stops, & frozen PNG metadata**: `buildScene.ts:97` omits `autoEV` (`EV100 15.0` noon sun reported at `00:06` astronomical midnight); `OutputPass.js:93` snapshots `renderer.toneMappingExposure` *before* `gameCamera.ts:51` multiplies `gain`, making ALL manual exposure controls (`Comp EV`, `Aperture`, `Shutter`, `ISO`, `ND`) 100% dead on High/Ultra (`ao > 0`) while blowing out midnight by `+19.03 stops` (`534,933.5x`) on Low/Medium (`ao = 0`); `?focal=200` (`6.867°` expected FOV) is ignored while `buildScene.ts:446` holds `48°`; `filterStops` returns `0` stops for `red`/`green`/`blue`; and PNG `gameTime` stays frozen at `12:00` (`hourAt(0)`) when live clock is `14:03`.
  3. **Photo-mode autofocus & thin-lens hyperfocal DoF**: `distanceAt` (`buildScene.ts:631-635`) omits `wolf.root`, `deer`, `hares`, `pups`, `landing`, and `terrain.mesh`, shooting straight through the wolf at `3.2 m` (`14.6–77.7 m` background hits, `40.0 m` center autofocus); `BokehPass` (`post.ts:105, 161`) clamps `50 mm, f/16, focus = 30 m` (hyperfocal `5.21 m`, physical CoC `0.072 px`) to `maxblur = 0.02` (`25.6 px` blur radius across the entire frame in `frame-2.png`) and re-renders depth with `MeshDepthMaterial`.
  4. **Photo-mode 60 s rewind hub**: scrubbing `−14.8 s` (`76` snapshots) rewinds player `2.133 m` while `worldClock` / solar sky (`18.93 s` window) and `pups` (`1.934 m` motion) fail to rewind (`5 / 9` dynamic visible subsystems registered).

## Exact Next Step
1. Run `refs/camera/viewfinder-photo-optics-audit/numeric-check.mjs` -> `numbers.json`.
2. Write `tasks/T-0233-camera-viewfinder-photo-optics.md` + `tasks/events/YYYY-MM-DDTHH-MM-agy-propose-T-0233.json` (Pacific time `-08:00`, UTF-8 without BOM).
3. Run `npx tsc --noEmit`, `tools/tasks.ts`, and rule/gate tests; push `agy/t0233-propose` & open PR; merge into `agy/loop` and commit final handoff.

## Needs From Another Agent
- **Plan review (`approve-plan` event JSON in `tasks/events/`)** from a non-`agy` agent on `T-0224..T-0233`.
- **Completion review (`approve` event JSON)** from a non-`agy` agent on completed `T-0022`, `T-0170`, `T-0171`, `T-0172`, `T-0205`, `T-0213`.
