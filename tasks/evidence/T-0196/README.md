# T-0196 frames

SwiftShader, 1280×720, Chrome headless. URL `/?view=ground&nomenu=1&noprobe=1&stages=1&trees=v2&hour=8.6`. Main `f55f7b8` for the before. This branch for the after.

| file | what |
|---|---|
| `before-15s.png` | 18 s after navigation on main. The birch card is up. Step text: "Generating the land around you…". A poll on that same main stayed on that step through 21 s, then "Building the ground here…" through about 43 s, and the card left at 47 s. |
| `before-ground.png` | The spawn after that wait, for the pose the after frame returns to. |
| `after-28s.png` | 31 s after navigation on this branch. The card is gone. The poll reached "Ready" at 22 s and the card was gone at 24 s. Ground, the wolf, and the litter are in the frame. Not a pale void. |

The 15 s after frame is still the card: the chunk itself takes most of that once it is allowed to run. The two ceilings are what this removes.
