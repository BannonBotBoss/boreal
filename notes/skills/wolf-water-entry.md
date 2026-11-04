# Wolf Water Entry & Shared Foot Height (`wolf-water-entry`)

## When to Use
Use this skill when aligning the rendered player foot height and follow-camera ground reference across dry land, shallow wading water, and shoulder-deep lake water without coupling to autonomous water-refusal thresholds (`LEVEL.wolfWater`) or wake/swim systems (`T-0024`).

## Steps
1. **Define one shared foot-height helper (`footHeight(x, z)`) in `src/render/math.ts`**:
   - Sample `bed = heightAt(x, z)`.
   - Determine the local water surface: `(STAGES.on && remoteGameHeight(x, z) === null ? surfaceAt(x, z).lake?.surface : undefined) ?? LEVEL.waterSurface`.
   - On dry ground (`bed >= water`), return `bed`.
   - Under water (`bed < water`), return `bed` while depth `water - bed <= WOLF_SHOULDER_M` (`0.80 m`, the low end of the 80–85 cm adult gray-wolf shoulder height in `src/core/wolfBody.ts`, consistent with Mech 1970 *The Wolf* 0.66–0.81 m), and `water - WOLF_SHOULDER_M` once deeper.
2. **Share `footHeight(x, z)` in both `positionCamera` (`src/render/math.ts`) and `draw` (`src/render/buildScene.ts`)**:
   - Remove the legacy `Math.max(heightAt(x, z), -.2)` clamp that left the wolf standing 5 cm in the air above `LEVEL.waterSurface` (`-0.25 m`).
   - Keep `LEVEL.wolfWater` (`0.2 m`) untouched for autonomous path refusal (`src/core/autonomy.ts`).
3. **Verify with unit tests and a shore-walk replay**:
   - Run `npx tsx --test tests/render-math.test.ts` to verify dry shore (`(175.67, 281.69)`), wading (`(179.58, 291.14)`, depth `0.727 m <= 0.80 m`), and deep water (`depth > 0.80 m`).
   - Replay `?nomenu&bench&rec&stages=1&walkprobe&hour=12&at=175.67,281.69,3.534` in headless Chromium on an `agy` preview port (`5250–5269`) and confirm `drawnY` tracks `h` (`|drawnY - h| <= 0.02 m` at start and `drawnY ≈ -0.979 m` at depth `0.727 m` instead of `-0.202 m`).

## Mistakes to Avoid
- Do not query `surfaceAt(x, z)` when `remoteGameHeight(x, z) !== null` (off-home globe landing), because `surfaceAt` reads the Kenora stage-1 grid rather than the remote planet surface.
- Do not change `LEVEL.wolfWater` or add a second wake/swim system in `buildScene.ts`.
