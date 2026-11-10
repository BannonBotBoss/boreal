# T-0194 frames

SwiftShader, 1280×720. The clock is held, so the status reads PAUSED. Both builds report 08:46, snow 0.0 cm, stamina 100, energy 75, water 100, rest 100.

Seed 1400. Home is 49.770 N, 65.537 E. The stand is x 65.4, z −18.6, which is still that home. Day 227. Sun elevation about 37°.

Two headings, the same place and the same minute:

| file | heading | what I see |
|---|---|---|
| `main-66deb5e.png` | yaw 5.140, away from the sun | Open thatch. The sky is a flat near-white. The ground meets it in a hard line. The ground is a tan and olive blotch. The wolf looks thin and pale. No grey sheet across this view. |
| `before-horizon.png` | the same frame as `main-66deb5e.png` | Main `66deb5e` at this pose. The matched before. |
| `after-horizon.png` | yaw 5.140 | This branch at the same pose. Same white sky, same hard line, same blotchy ground, same thin wolf. |
| `spawn-main.png` | yaw 2.054, the spawn stand, toward the sun | Spruce, a pale sky, and a grey-blue band across the middle distance. Cool-sheet score 0.068. |
| `spawn-branch.png` | yaw 2.054 | The same band, same score. This branch does not remove it. |
| `ref-comanche-horizon.png` | — | Comanche National Grassland, 29 May 2015. Public domain, US National Park Service. Snow-free shortgrass. Blue sky, and the plain fades into a blue-grey haze. Not Kenora. Not 49.77 N, 65.54 E. |

The sheet score is the share of rows, in the middle of the frame, that contain a cool flat run across more than 22% of the view. The open-prairie pair scores 0. The spawn pair scores 0.068 on both builds.

Sky luminance is Rec.709 luma in x 0.36–0.62, y 0.12–0.24. The reference is 189 and blue (B−R 59). Main and this branch are 232 and nearly neutral (B−R 5).

The horizon profile is twelve luma bins down the centre, y 0.22–0.55, x 0.42–0.68. The largest step is 31 on the reference and 99 on both game frames.
