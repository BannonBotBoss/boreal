# Skill: space the litter without touching the gait

Use when small canids pile on the wolf's feet. Those are the five pups, not a fox gait. Gait Builder owns the walk.

## Steps

1. Homes are `(back, side)` metres in `PUP_HOME` (`src/core/litter.ts`) and the same pairs in `rust/boreal-sim/src/litter.rs`.
2. Keep them inside the chase view: back is clamped to `LITTER.viewBackM` (1.55 m) and side to `LITTER.lateralM` (1.15 m). At least two stay inside 0.95 m. The five are at least 0.55 m apart.
3. Do not change step frequency, duty, or foot contact.
4. `tests/litter.test.ts` is the lock.

## Mistakes

- Spreading them past the chase view fails the existing clump test and puts them under the camera.
- Editing only one of the TypeScript and Rust tables. They are the same homes.
