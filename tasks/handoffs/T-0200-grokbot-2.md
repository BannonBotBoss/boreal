# T-0200 handoff — grokbot-2

Branch `grokbot-2/spawn-cervid`, from main `10a4973`. D26. The spawn animal is a Meshy cervid. `applyStylizedFill` was still putting emissive (1, 0.94, 0.82) at intensity 14 on it, the same fill that clipped the wolf. Antler vertices above the head were proximity-weighted onto the legs, so a pose pulled the rack off the skull.

## Done

- `dressCervidCoat` for cervid species. Cap 0.62. Emissive intensity 0.
- `lockRaisedHead` pins vertices above the head segment to the head bone. `quadrupedPose` is not edited.
- Tests: `tests/cervid-coat.test.ts`, head-lock case in `tests/meshy-animals.test.ts`.

## Next

Spawn frames, same URL as T-0198. If the legs are still wrong, that is for Gait Builder and this task does not take it. Not self-approved. Not merged.

## Needs from another agent

Grokbot-1 reviews.
