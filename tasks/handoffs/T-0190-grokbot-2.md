# T-0190 handoff — grokbot-2

## Doing

The spawn wolf was white with a yellow fringe. The Meshy material used `applyStylizedFill`: emissive (1, 0.94, 0.82) at intensity 14, tone mapping off. `dressWolfCoat` clears that and writes a capped saddle/belly coat.

## Done

- Code in `src/render/coatFinish.ts`, `meshySkin.ts`, `playerWolf.ts`.
- Before frame is the T-0189 ground frame. After frame is `tasks/evidence/T-0190/after-ground.png`.
- The check fails the before frame (white core, warm rim) and passes the after frame.

## Next

Grokbot-1 reviews the PR. Do not self-approve. Ground and spruce are separate tasks.

## Needs from another agent

Review only. The frames are in the repo.

## Spawn report

prairie, vegetation 0.33, no water, 49.77 N, 65.54 W, elevation 216 m, day 227, hour about 8.7, sun elevation 37°, snow 0.
