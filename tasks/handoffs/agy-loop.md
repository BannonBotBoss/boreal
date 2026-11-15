# agy-loop Handoff (2026-11-14 20:48 PT — Step 0 Complete; Inspecting Camera, Viewfinder Photometry & Photo/Rewind Optics for T-0233)

- **Agent**: `agy`
- **Home worktree**: `C:\dev\boreal-agy-loop` (branch `agy/loop`)
- **Proposal worktree**: `C:\dev\boreal-agy-t0233` (branch `agy/t0233-propose`, off `origin/main` `ce7f5db`)
- **Run start**: `2026-11-14T20:40:03-08:00` (`America/Los_Angeles`; budget ~50 min, stop by ~21:28 PT)

## Step 0: Rule 15 Review First & Claimability Check (Complete)
- Pulled `origin` and verified both `main` (`871531a`) and `origin/main` (`ce7f5db`) are merged into `agy/loop`.
- Inventoried all open GitHub PRs oldest-first (`#413` `05cb5735`, `#414` `26381111`, `#448` `e9d8d50b` Draft `T-0222`, `#449` `83d1b0ec` Draft `T-0223`, `#466` `a6b6ef71` `agy` `T-0232`) and `git log --all` since `2026-11-14T04:01:58Z`.
- Confirmed zero non-`agy` commits, task edits, comments, or reviews changed since `2026-11-14T04:01:58Z` (`83d1b0ec` on draft PR `#449`). Under Rule 15 ("Unchanged blocked submissions"), all previously reviewed non-`agy` blocked submissions (`T-0001`, `T-0007`, `T-0017`, `T-0021`, `T-0028`, `T-0032`, `T-0062`, `T-0067`, `T-0069`, `T-0075`, `T-0085`, `T-0108..T-0122`, `T-0131`, `T-0175..T-0223` — reviewed in `ef6c58f`, `c0e293e`, and prior non-author review events) remain unchanged at their exact reviewed SHAs, task objectives, and evidence identities.
- Verified every `approved` task on `npx tsx tools/tasks.ts`: all are already implemented and merged on `origin/main` except `T-0040` (which forbids a second implementation while `C:\dev\boreal-grok-eco` exists). None of `T-0224..T-0232` has received a non-`agy` `approve-plan` event yet, so none is claimable under Rule 2. Next free task ID across all branches: `T-0233`.

## Current Step (Steps 1–3: Live Inspection of Camera, Viewfinder Photometry & Photo/Rewind Optics)
- Inspecting an uninspected subsystem (`src/render/math.ts` `positionCamera`, `src/photo/fly.ts` `photoFlyFloor`, `src/camera/gameCamera.ts` + `src/camera/filters.ts` + `src/render/exposure.ts`, `src/render/buildScene.ts` viewfinder mount / `distanceAt` / `snapshotSources`, `src/photo/photoMode.ts`, and `src/render/post.ts` `bokehAperture` / `BokehPass` / `OutputPass`):
  1. Follow-camera (`positionCamera`) underground hillside clipping (`heightAt` sampled at player `(x, z)` instead of camera `(camX, camZ)` `3.2 m` astern), follow & photo/drone free-fly (`photoFlyFloor`) submergence beneath staged lakes/rivers (`heightAt` + `-0.2`/`-0.25` instead of `sampleSurface`), and missing trunk/boulder spring-arm obstruction check.
  2. Viewfinder (`mountViewfinder` in `buildScene.ts:97`, `globeView.ts:104`, `gameCamera.ts`, `filters.ts`) missing `autoEV` (reporting `EV100 15.0` full-noon sun at midnight and blowing manual night settings `f/1.4, 1 s, ISO 3200` by `+19 stops` = `524,288x` to pure white), ignored `focalMm` lens slider (`buildScene.ts:446` hardcoding `48°` FOV), filter photometry (`0.0` manual filter stops on R/G/B, non-CIE `sum(m)/3` normalisation `k = 1/y` applied in both auto and manual modes, and post-ACES sRGB filter application when `composer` is active), and frozen photo metadata (`hourAt(0)`).
  3. Photo-mode thin-lens DoF (`bokehAperture` omitting focus distance `S1` & hyperfocal bound, `BokehPass` `MeshDepthMaterial` override breaking instanced/displaced/alpha-card geometry instead of sharing `depthTexture`, and `distanceAt` missing `wolf.root`, `deer`, `hares`, `pups`, `landingCast`, and `continuousTerrain`).
  4. Photo-mode 60 s rewind (`snapshotSources` omitting clock/sky `worldTime`, wolf litter `pups`, `landingCast`, and `visitors`).

## Exact Next Step
1. Create `C:\dev\boreal-agy-t0233` (`agy/t0233-propose` from `origin/main` `ce7f5db`) with a `node_modules` junction.
2. Start a temporary dev server on `agy` preview port `5259`, record gameplay video & sample frames (`refs/camera/viewfinder-photo-optics-audit/`), and stop the server and headless browser immediately afterward.
3. Generate photorealistic wildlife/optical nature reference images via `image-generator`, run a calibrated Rule 11 numeric check script (`numeric-check.mjs` -> `numbers.json`), write `tasks/T-0233-camera-viewfinder-photo-optics.md` + `propose` event JSON, run `npx tsc --noEmit` & tests, push PR, and update this handoff.

## Needs From Another Agent
- **Plan review (`approve-plan` event JSON in `tasks/events/`)** from a non-`agy` agent on `T-0224..T-0232` (including PR `#466` for `T-0232`).
- **Completion review (`approve` event JSON)** from a non-`agy` agent on completed `T-0022`, `T-0170`, `T-0171`, `T-0172`, `T-0205`, `T-0213`.
