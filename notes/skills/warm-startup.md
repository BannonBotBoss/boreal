# Skill: warm startup on a return reload

When to use: the loading screen runs the full land settle, shader compile, sky bake, and next-tier warm-up on every refresh, even though `boreal.probe.v1` already skipped the Ultra bench. Not for a new quality tier, and not for the intro film.

## Steps

1. Read `src/render/startup.ts` and `src/core/probe.ts`. The probe cache is `localStorage` keyed by renderer string and `PROBE.version`. `?reprobe` ignores it. `?bench` and `?noprobe` set `skipProbe`.
2. Keep one `startup()`. Add a pure route (`startupRoute`) and a budget (`startupBudget`). Cold is the existing sequence. Warm is allowed only when the probe cache hits, the build id matches, and this tab already finished a startup.
3. Store that fact in `sessionStorage` (`boreal.startup.warm.v1`: `{ build, renderer }`), written at the end of a startup that has a probe. Do not put it on the probe record and do not bump `PROBE.version`. A new tab has an empty session, so it stays cold. `import.meta.url` is the build id: a production hash changes it, a dev server does not.
4. Both routes use `settleWhenLandReady`. The cell is `?at=` or `livingHere()`, via `standPoint` / `standChunkIndex` / `chunkBuilt`. Grass and flora may keep `queued()` above zero; they are not the ground. The 20 s ceiling stays, so a missing chunk is not revealed early. Cold does not wait for that queue first: a full grass queue with the chunk already in used to hold the card for the ceiling, then a second ceiling (T-0196, measured 50 s to the card leaving on SwiftShader). A SwiftShader capture on 2026-11-07 showed the splash gone and the embodied view a pale field (mid-frame about 228,228,228, non-pale share 0.08) when the chunk wait did not exist.
5. Apply the cached cap before that wait, then `compile()` once. Leave the sky loop (environment map, or 3 s). Call `warmUp(next, 0)` so the next cheaper tier is queued and the reveal is not blocked. Never skip `compile()`: a reload has a new WebGL context.
6. Do not edit the `startup(...)` call in `src/main.ts`. T-0166 (PR #322) and T-0167 (PR #323) both change that line. `?reprobe` forces cold and still re-benches. `skipProbe` forces the long land wait and does not write a stamp.

## Checks

- `tests/startup-warm.test.ts`: route matrix, stamp and cell parsing, first visit benches and the reload does not, a full interest queue holds only the cold path, a missing chunk holds the warm path to the ceiling, a missing sky map is waited for, `?reprobe` / other renderer / empty cache / new build / `skipProbe` keep probe-cache behaviour.
- `npm test` and `npx tsc --noEmit`.
- The loading screen itself is a browser frame. CI does not capture it. A check on a machine with a display is: cold console line `STARTUP cold` on the first load, `STARTUP warm` on refresh, ground present, sky not black.

## Mistakes to avoid

- Skipping `compile()` or the sky wait because the probe was cached. The cache is a tier cap, not a compiled program or an environment map.
- Ending the land wait on `queued() === 0` for the warm path. That queue does not go quiet while flora is streaming, which is why refresh felt like a full restart.
- Lowering the 20 s ceiling. The short path is an early exit once `chunkBuilt` is true, not a smaller timeout.
- A second loader, or a `localStorage` stamp, when the request is a return reload in the same tab.
- Bumping `PROBE.version` for the stamp. That throws away the bench.
- Editing `main.ts` boot while the cinematic and save/resume branches own that line.
