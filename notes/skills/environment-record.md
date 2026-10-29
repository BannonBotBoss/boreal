# Skill: environment record (one read of the air, shared shader uniforms)

Use when a shader or system needs the weather where the viewer is (temperature, humidity, rain, wind, season, sunlight, clock rate)
and must not grow a second weather reader or a second wind. First built for T-0089 (issues #111, #110).

## Steps
1. Read weather only through the existing queries: `weatherAt(x, z)` (core/weather.ts) on the ground, `weatherAtLatLon(latDeg, lonDeg, sim)`
   (core/planetWeather.ts, T-0082) on the globe. Never read Rust grid planes directly.
2. Fill `ENV` (src/render/environment.ts) with `fillEnvironmentGround()` or `fillEnvironmentGlobe(lat, lon, day, hour, sim)` where the
   caller already samples the weather (globeView samples once per 60 frames at the camera sub-point). It returns false and sets
   `source = null` when no grid is booted; readers keep their fallback.
3. Shaders take `ENV_UNIFORMS` (three.js UniformsLib pattern: plain `{ value }` objects shared by reference). Wind is the trees'
   `WIND_UNIFORMS` objects, not a copy.
4. Time: the one clock (core/worldClock.ts). Rate = `clockRate()`; game seconds = world seconds x `gameSecondsPerWorldSecond`; observation
   scale bands = `SCALE_BOUNDS` / `resolveObservation`. `observationRecord().rate` was still the 0/1 placeholder on main on 2026-10-28.
5. Anything integrated over time (cloud drift angle) is stepped per frame from the world-second delta, never `time x rate`, so a wind or
   rate change does not jump it. Hold it with `1 - smoothstep(exit, enter, |rate|)` of the band you stop at.
6. Physical growth laws that diverge (Hanel f(RH) at RH = 1) get a cited cap, and the cap goes in the numbers table.

## Checks that proved it
- tests/environment.test.ts: every field equals its live source; `ENV_UNIFORMS.uWindDir === WIND_UNIFORMS.uWindDir`; drift after one game hour
  = u x 3600 / (R cos lat) within 1e-9; hold band equals SCALE_BOUNDS; f(RH) matches the law and is finite at RH 1.
- Dev hooks for frames: `?envrh=0.95&envu=40` force the record (ENV_FORCE).
- Box capture: Playwright-core + /usr/bin/google-chrome with SwiftShader; wait for `__globe.stats().drawn > 0 && queued === 0`.

## Mistakes to avoid
- Copying a scale threshold (800/1200) instead of reading SCALE_BOUNDS.
- Defining your own game-seconds factor instead of `gameSecondsPerWorldSecond`.
- One sub-point wind turns the whole cloud shell: a per-latitude zonal drift needs the layer texture's u plane (later step).
