---
name: ballistic-jump-arc
description: Wire and verify quadruped jump body height against the shared ballistic arc in src/animals/locomotion/jump.ts and walkProbe tilt world height.
---

# Ballistic Jump Arc Skill (`T-0048`)

Use this skill when connecting or auditing quadruped jump body height (`src/core/animalBehavior.ts`, `src/render/playerWolf.ts`, `src/render/animalRig.ts`) against the ballistic trajectory in `src/animals/locomotion/jump.ts`.

## Single Source of Truth

1. **Ballistic jump model (`src/animals/locomotion/jump.ts`)**:
   - Duration: `jumpSeconds() = PHYS.jumpSeconds = 0.85 s`.
   - Stage shares (`SYSTEM_PROPERTIES.jump`): `crouch = 0.18`, `flight = 0.65`, `land = 0.17` (`airSeconds() = 0.65 * 0.85 = 0.5525 s`).
   - Gravity (`src/proc/physics.ts`): `gravity() = G * M / R^2 = 9.82034 m/s^2` (CODATA 2018 `G`, NASA Earth Fact Sheet mass, IUGG mean radius).
   - Ballistic apex: `apexHeight() = g * T_air^2 / 8 = 0.37471 m`.
   - Frame evaluator: `jumpFrame({ t: jumpTime, kind: 'jump' }, hip).heightOff`. At mid-flight (`air = 0.5`, `t = 0.505 * T`), the crouch preload term `-depth * (1 - smooth01(air / 0.2))` has completely eased out (`smooth01(2.5) = 1`), so `heightOff === apexHeight()`.

2. **Quadruped IK pose (`src/core/animalBehavior.ts`)**:
   - `quadrupedPose` computes `lift0 = motion === 'jump' ? jumpFrame({ t: jumpTime, kind: 'jump' }, legs.hip).heightOff : ...`.
   - Do not inline a second parabola or subtract an un-saturated crouch term across mid-flight in `quadrupedPose`.

## Calibrated Verification (`?walkprobe`)

1. Launch the app with `?noprobe&nomenu&walkprobe&rec&hour=12&stages=1&at=148,64,0`.
2. Hold the simulation clock (`window.borealHold(true)`) while initial chunks finish streaming (`window.borealChunkDebug().queued === 0`), then place the player at `(148, 64, 0)` and release the clock (`window.borealHold(false)`).
3. Clear `window.walkProbe`, trigger one `Space` jump, and record `window.walkProbe.frames`.
4. For each recorded frame `{ bx, by, bz }`, subtract terrain elevation `heightAt(bx, bz)` (with `STAGES.on = true`) from the `tilt` group world height `by`.
5. Compute `score = max(by - heightAt(bx, bz)) / apexHeight()`:
   - **Known match**: `jumpFrame` at mid-flight (`tau = airSeconds() / 2`), `score = 1.000`.
   - **Known mismatch**: Pre-fix `0.48 m` fixed parabola (`score = 0.479 / 0.375 = 1.277`).
   - **Pass gate**: `0.95 <= score <= 1.05`.
