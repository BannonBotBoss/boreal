# Skill: pup personal space

Use when pups overlap each other or their mother, or when a follow step snaps instead of turning.

## Steps
1. Put the gap and the steering in `rust/boreal-sim`. The page calls the wasm exports. It does not grow a second copy of the rule in TypeScript.
2. Share the wasm instance the planet already loads (`src/render/simWasm.ts`). A second `WebAssembly.instantiate` of the same file is a second memory.
3. Mark a collision disc that is not a published measurement with `[game calibration]`.
4. Test the wasm exports: two pups that start on top of each other finish at least two body radii apart.

## Checks that prove it worked
- `tests/litter.test.ts` calls `litter_follow` and `litter_separate` and checks the gap.
- `tests/sim-home.test.ts` still passes. `src/core/planetBudget.ts` did not grow past its ceiling.

## Mistakes to avoid
- A second wasm instance for the litter.
- Teleporting a pup every frame when it is only a short step off the trail.
- An invented radius with no calibration tag.
