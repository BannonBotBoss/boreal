# Skill: an animal becomes a number when it is far or time is fast

Use when a creature should stay an individual up close and at real time, and become a herd, a density, or a species range when the camera leaves the near radius or the time scale leaves Immediate. Roadmap step 14. Issues #101, #107, and #109. #109 wins the conflict: the thing transforms. It does not pop out.

## Steps
1. Read `notes/design-roadmap.md` step 14 and conflict rows 2 and 5. Do not add a second list of time scales. The signal is `observation()`, `resolveObservation`, and `OBSERVATION_SCALES` in `src/core/worldClock.ts`. The radii are `INTEREST.near` and `INTEREST.mid` in `src/core/interest.ts`.
2. Put the ledger in `src/core/coarse.ts`. `animalShares` returns a body share and a density share that sum to 1. `markFor` paints the density disc before the body is allowed to disappear, and keeps the disc readable (`INK_FLOOR`, game calibration) while the body is still up. `pictureKind` maps the existing scales: Immediate and near is an individual, the mid band or Behavioral is a herd, Ecological through Generational is a density, Evolutionary and coarser is a range.
3. The coarse step is Verhulst's closed form, `coarseStep`. Carrying density is a published count per square kilometre, not a new guess. Deer: 1/km², Kenora District WMU 6, 1978, reported by Ranta & Lankester 2017, Alces 53:159–179, citing Ranta & Shaw 1982. Wolf: `WOLF_CEILING_PER_1000_KM2` already on `src/core/habitat.ts` (Fuller, Mech & Cochrane 2003), divided by 1000. The year rate `COARSE_R_PER_YEAR` is game calibration. A count of 0 stays 0. A non-positive time step holds.
4. Headless animals use `demoteFar` / `promoteField` on `src/core/sim`. Fully folded animals leave the individual tick. Their water, energy, and rest are the mean, so coming back does not mint a blank body. The controlled player stays an individual. Partly faded animals stay in the sim; the drawing shows both and the ledger still counts them once.
5. The picture is the T-0070 disc: a round point (`src/render/animalDensity.ts`). Herd width is the deer's cohesion distance. Density and range widths are the interest radii. It is not a standing shape. `densityTintGate` is 0 at ground level, so the sprite is not drawn there (a close camera-facing disc is cut by the ground and looks like a dome). The same point is a faint ground stain only when the eye is at least the 1 km station and looking down. The mark sits `DENSITY_MARK_LIFT_M` above the ground. `buildScene` calls `density.sync` before `setBodyShare`, and passes the camera position. `main.ts` passes the forward world seconds with `noteWorldDt`. Rewind passes 0. Individuals still step only on `simWorldSec`, which is 0 above Immediate.
6. Do not edit another agent's open branches. Do not add `TIME_LEVELS` beside the eight names. Do not store `body_mass`.

## Checks that prove it worked
- `tests/coarse-population.test.ts`: every half-metre from 0 to 200 has shares summing to 1 and at least one picture; just outside the near radius both are up and the density is first; a rate of 20× near the animal is a herd with no body; the 8×–12× band shows both; a folded count of 5 deer eases toward 1/km² and does not move the individuals; demote plus the field equals the old count, and promote restores the needs.
- `npx tsc --noEmit` and `npm test`.
- In the game, from the ground: close and at real time, the animal is a body. Farther, or with time sped past Immediate, the body fades and no dome or blob stands on the grass. The count is still in the census. From high above, looking down, the same mark is a faint stain. Frames in `tasks/evidence/T-0104/`.

## Mistakes to avoid
- Hiding the body on one frame and counting the density on the next. Sync the mark first, in the same frame.
- Drawing that mark as a large camera-facing sprite from the ground. The ground cuts the bottom off and it looks like a dome bigger than the trees. Keep the sprite off unless `densityTintGate` is open.
- A second scale enum, or reading `TIME_LEVELS` from `render/observationTable.ts` as a live dial. That file is a note. The dial is the clock.
- Inventing a deer-per-kilometre figure. Use the Kenora survey, or label the number calibration.
- Letting the coarse step also tick the individual. Fully folded animals are out of `stepAgent` and out of the headless `tick`.
- Despawning a hare at 70 m and spawning a new one. Fold the same record and bring it back.
- Calling `worldSec()` again inside the draw to measure the frame. Main already has the delta. A second call moves the clock.
