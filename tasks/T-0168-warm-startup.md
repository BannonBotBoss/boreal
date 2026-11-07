---
id: T-0168
title: Warm startup so a return reload does not rerun the full loading path
author: grokbot-2
scratch: false
research: false
skill: warm-startup
tags: [startup, loading, probe]
credits: 30
---
# T-0168 Warm startup on a return reload

Matthew, via omen in the Cinematic Coder chat, 2026-11-05 afternoon PT (America/Vancouver): the loading phase should not restart on every refresh, and it takes a long time.

Credits 30 = 10 x 3 objectives (rule 14). `scratch` stays false: the probe cache, `startup()`, and the loading screen already exist.

## Why it restarts

Every bare page load runs `startup()` in `src/render/startup.ts` behind `createLoading()` (`src/main.ts`). The probe result is already cached in `localStorage` (`boreal.probe.v1`) after the first successful bench, so a refresh does not measure the GPU again. The long part is the rest of the sequence:

- `settle(15, 20000)` waits until the interest queue is empty for 15 frames, or 20 s. Grass, flora, and moss keep that queue full, so the wait hits the ceiling.
- `photoreal.compile()` builds the live tier's programs. A reload has a new WebGL context, so this cannot be skipped.
- The sky loop waits until `scene.environment` exists, at most 3 s.
- `photoreal.warmUp` then blocks for up to 6 s on the next cheaper tier.

A refresh feels like a full restart because those four steps run again even when the probe cache hit.

## Path

One route inside `startup()`, not a second loader.

- **Cold.** First visit, a new tab (empty `sessionStorage`), a different build id, `?reprobe`, `?bench` / `?noprobe`, or no cached probe. The land wait, the Ultra bench (when the cache misses or `?reprobe` is set), the compile, the sky wait, and the blocking warm-up stay as they are.
- **Warm.** This tab already finished a startup for this build (`sessionStorage` `boreal.startup.warm.v1`) and `cachedProbe` still matches the renderer. The land wait ends once the standing chunk has been in the scene for a few frames (same 20 s ceiling if it has not). Shaders for the cached tier are compiled once, after that tier is applied. The sky wait is unchanged. The next tier is queued and not awaited. The Ultra bench does not run.

The build id is the module URL, so a production bundle hash misses the stamp. `?reprobe` still ignores the probe cache and forces the cold route. `main.ts` is not edited: the cinematic boot line (T-0166, PR #322) and the save/resume boot line (T-0167, PR #323) both own that call.

## Id

T-0165 is PR #321, T-0166 is PR #322, T-0167 is PR #323. No `tasks/T-0168*` file or event was on any branch when this id was locked.

## Objectives

- [ ] A return load in the same tab, on the same build, with a cached probe, takes the warm path: the standing chunk ends the land wait, the live tier is still compiled, the sky wait stays, and the Ultra bench does not run again.
- [ ] A first visit, a new tab, a build change, `?reprobe`, `?bench` / `?noprobe`, or no cached probe keeps the full land wait, the Ultra probe when the cache misses or `?reprobe` is set, and the blocking next-tier warm-up.
- [ ] `npm test` and `npx tsc --noEmit` pass. `boreal.probe.v1` stays per renderer string, and `?reprobe` still replaces it.

## Acceptance

1. Tests cover the route choice and a full queue: cold stays on the 20 s land ceiling, warm returns after the standing chunk, and both still compile.
2. A missing chunk does not take the short land wait. A missing environment map does not skip the sky cap.
3. No change to the cinematic film or to the save/resume boot in `main.ts`.

## Out of scope

The intro skip and the place restore (T-0167, PR #323). The B0–B14 film (T-0166, PR #322). A new quality tier. Promoting the session stamp to `localStorage` so a new tab is also warm: a new tab is a different browsing context, and this task only shortens the return reload.
