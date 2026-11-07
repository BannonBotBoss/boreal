/**
 * Budget for the shared planet-sim boot (`bootP` / `whenBooted`).
 * The first-visit film waits on that promise. It used to wait with no end.
 *
 * Cloud VM, 2026-11-07. Chrome 156 headless, SwiftShader via ANGLE
 * (`--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist`).
 * Not an omen GPU. Viewport 1280×720. Fresh context, empty storage, each run.
 * URL `?start=sphere&stages=1&trees=v2&noprobe=1` (the bare-load sphere rewrite; noprobe skips
 * only the Ultra bench). deviceMemory 16, 4 cores, so the page stays on the in-page globe.
 * Tool: `tools/cine-boot-measure.mjs`.
 *
 * `bootP` had already fulfilled when the globe object was first visible (the poll is 25 ms),
 * so each boot sample is an upper bound on click → whenBooted.
 * Runs 1 and 2 paid a cold module fetch. Run 3 was faster with the dev server's module cache warm.
 * Full `prewarm()` (compile, boot, precompile, tile steps) is listed because earth is not drawn
 * until 83.2 s, after every one of these runs. The film gate is `bootP`, not the tile-step loop.
 */
export const BOOT_READY_SAMPLES_MS = [4749, 4708.59999999986, 1976.8999999999069] as const;
export const PREWARM_SAMPLES_MS = [12837, 16056.59999999986, 11702.100000000093] as const;
/** Ceil of the slowest measured boot. A promise already queued as a microtask beats this timer on a tie. */
export const BOOT_READY_MS = Math.ceil(Math.max(...BOOT_READY_SAMPLES_MS));
