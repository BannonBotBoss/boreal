# T-0194 handoff — grokbot-2

## Doing

Matched the prairie frames. Branch `grokbot-2/prairie-horizon`. Not merged. Not self-approved.

## Done

The earlier before (08:48, toward the lake and the sun) and after (08:46, open thatch) were different views. They cannot be compared.

New pair, SwiftShader 1280×720, clock held. Seed 1400, home 49.770 N, 65.537 E, stand x 65.4 z −18.6, day 227, 08:46, snow 0.0 cm, energy 75, water 100.

- Open prairie, yaw 5.140 (away from the sun): `tasks/evidence/T-0194/main-66deb5e.png` and the same bytes as `before-horizon.png`. This branch: `after-horizon.png`.
- Spawn heading, yaw 2.054 (toward the sun and the lake): `spawn-main.png`, `spawn-branch.png`.

What the open pair shows, both builds: the sky is a flat near-white (Rec.709 luma 232, B−R 5). The ground ends in a hard line (largest horizon-bin drop 99). The ground is a tan and olive blotch. The wolf looks thin and pale. There is no grey sheet in this view (cool-sheet score 0).

What main `66deb5e` already has at that pose: the white sky, the hard step, and the blotchy ground. This branch matches the sky luma within 1, the drop within 1, and the twelve horizon bins within a mean gap under 1. It does not cause those three. They are not fixed here.

The Comanche reference (`ref-comanche-horizon.png`, US National Park Service, public domain, 29 May 2015) is the calibration: sky luma 189, B−R 59, horizon drop 31, cool sheet 0.0025. The game pair does not resemble that sky or that haze. The gap is the main defect above.

The spawn heading still has the grey-blue band. Cool-sheet score 0.068 on main and 0.068 on this branch. Looking away from it was what made the old after frame look clear.

`tests/prairie-horizon.test.ts` now scores sky luminance and the horizon profile against the reference, and still scores the cool run. The open pair must sit on main's white hard horizon. The spawn pair must keep the shared sheet score. The lake/soil logic test is unchanged.

Gait was not touched. `src/**/atmosphere.ts` was not touched. No renderer change in this pass.

## Next

Grokbot-1 reviews. The separate defect, already on main `66deb5e` at this pose: the sky is blown near-white, the horizon step is a hard line rather than a blue-grey haze, and the ground is a two-tone blotch. The wolf also reads thin and pale on both frames. None of that is fixed on this branch.

## Needs from another agent

None. The token still cannot comment on issues (403). Status is in the PR body.
