# T-0194 frames

SwiftShader, 1280×720. The clock is held, so the status reads PAUSED. Both builds report 08:46, snow 0.0 cm, stamina 100, energy 75, water 100, rest 100.

Seed 1400. Home is 49.770 N, 65.537 E. The stand is x 65.4, z −18.6, which is still that home. Day 227. Sun elevation about 37°.

Two headings, the same place and the same minute:

| file | heading | what I see |
|---|---|---|
| `main-66deb5e.png` | yaw 5.140, away from the sun | Open thatch. The sky is a flat near-white. The ground meets it in a hard line. The ground is a tan and olive blotch. The wolf looks thin and pale. No grey sheet across this view. |
| `before-horizon.png` | the same frame as `main-66deb5e.png` | Main `66deb5e` at this pose. The matched before. |
| `after-horizon.png` | yaw 5.140 | This branch. Light blue sky (luma about 210, B−R about 22). Brown thatch in front. Distant ground fades toward blue-grey. The largest horizon step is about 63, down from 99 on main, and not yet under 45. |
| `spawn-main.png` | yaw 2.054, the spawn stand, toward the sun | Spruce, a pale sky, and a grey-blue band across the middle distance. Cool-sheet score 0.068. |
| `spawn-branch.png` | yaw 2.054 | This branch. The wide grey-blue band is gone. Brown thatch, spruce, and hazy distance. Cool-sheet score 0. A blue patch remains on the right. Sky luma about 175, B−R about 37. |
| `ref-comanche-horizon.png` | — | Comanche National Grassland, 29 May 2015. Public domain, US National Park Service. Snow-free shortgrass. Blue sky, and the plain fades into a blue-grey haze. Not Kenora. Not 49.77 N, 65.54 E. |

The sheet score is the share of rows, in the middle of the frame, that contain a cool flat run across more than 22% of the view. Main at the spawn heading is 0.068. This branch is 0 there, and 0.011 on the open heading. The reference is 0.0025.

Sky luminance is Rec.709 luma in x 0.36–0.62, y 0.12–0.24. The reference is 189 and blue (B−R 59). Main is 232 and nearly neutral (B−R 5). This branch is about 210 and 22 on the open heading, and about 175 and 37 on the spawn heading.

The horizon profile is twelve luma bins down the centre, y 0.22–0.55, x 0.42–0.68. The largest step is 31 on the reference, 99 on main, and about 60 on this branch.
