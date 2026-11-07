/**
 * Measured first-visit timings. Cloud VM, 2026-11-07, Chrome 156 headless, SwiftShader
 * (`--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist`).
 * Not an omen GPU. 1280×720, fresh context, `?start=sphere&stages=1&trees=v2&noprobe=1`.
 * deviceMemory 16, 4 cores. Tool: `tools/cine-boot-measure.mjs`.
 * `bootP` had already fulfilled when the globe object was first polled (25 ms).
 * These are not a timeout on `bootP`. Issue #47 still runs land, elevation, then boot order
 * before the first globe frame, however long the sim takes.
 */
export const BOOT_SAMPLES_MS = [4749, 4708.59999999986, 1976.8999999999069] as const;
/** Full prewarm() from the click: compile, boot, precompile, and the tile steps. */
export const PREWARM_SAMPLES_MS = [12837, 16056.59999999986, 11702.100000000093] as const;
/**
 * Extra seconds the B13 clamp may hold after the frame that first engages it.
 * The three prewarms span this many milliseconds. Twice that span, rounded up to a
 * whole second, is the grace: a run slower than every sample by the whole observed
 * span still finishes before the film gives up. The film has already played to B13.
 */
export const CINE_HOLD_MARGIN = 2;
/** If the planet is still booting at the end of B13, hold the clock this long, then continue on to the globe. */
export const CINE_BOOT_TIMEOUT_S = 15;
export const CINE_HOLD_S = Math.ceil(CINE_HOLD_MARGIN * (Math.max(...PREWARM_SAMPLES_MS) - Math.min(...PREWARM_SAMPLES_MS)) / 1000);
