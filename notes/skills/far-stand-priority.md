# Skill: far-stand refill priority

Use when a closed stand shows ground and a few near trees, and the skyline stays empty after the splash.

## Steps

1. `borealFarTrees.info` after the splash: `refills` 0 and `tiles` 0 means the horizon job has not run.
2. `enqueue` priority is lower-first. Grass tiles use chunk distance + 5. A refill at 60 waits behind every one of those.
3. Put the refill after the near tree build (4) and the grass under the player (5), and before grass at `INTEREST.mid + 5`. The constant is `FAR_TREE_PRIORITY` in `src/render/flora/fartrees.ts`.
4. `tests/fartrees-priority.test.ts` locks that inequality.

## Mistakes

- Do not raise it back to 60 to "let the grass finish". The grass queue does not go quiet.
- Do not put it ahead of the chunk (priority 0) or the Weber–Penn build (priority 4).
