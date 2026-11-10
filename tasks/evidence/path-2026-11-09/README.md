# Path inspection on main f55f7b8

Grokbot-2, 2026-11-09 night PT. SwiftShader, Chrome headless, 1280×720. No game code in this folder.

The spawn URL was `/?view=ground&nomenu=1&noprobe=1&stages=1&trees=v2&hour=8.6`. The clock read 08:46, snow 0.0 cm. The overhead URL was `/?view=globe&latlon=52,-97&shot&localClouds=0&hour=8.3&day=227&tier=5&seed=1400&alt=` plus 2000, 800, or 400.

| file | what I see |
|---|---|
| `ground.png` | Spawn. The ground at the feet is mottled brown thatch, not one green lawn. The far bank is still a flat green shelf. The sky is a white sheet and the horizon is a hard pale band (D19, D22, left alone). One tree is a hard dark fir, the other a flat cartoon pine. The pups are smooth tan cutouts. The adult wolf is a grey coat. A red fox stands off to the side. |
| `ground-after-w.png` | After holding W for about 2.5 s. The view moved. The player probe went to about x 65, z −19. Controls answered. |
| `before-splash-15s.png` | The birch card, still "Generating the land around you…". On this main the card stayed up until about 47 s. The fix is #424, not this folder. |
| `eye40.png` | `eye=40` on the same spawn. The ground is separate floating plates with gaps. The trees are dark cones. |
| `globe-2000.png` | 2000 m over 52 N, 97 W. A soft dark canopy. No lake in this frame. |
| `globe-800.png` | 800 m. Pixel noise, not crowns. |
| `globe-400.png` | 400 m. The same noise, coarser. The exemplar in `public/aerial/source/canopy.png` is a 128 px NAIP crop at about 1.6 m per pixel, so a crown is one or two texels. Magnified under a 400 m camera it is this static. |
| `ref-nursing-wolf.jpg` | Doug Smith, NPS, May 2005, Leopold pack, Yellowstone. Public domain. Nursing pups at the den: dark, woolly, short-legged, blunt faces. Not the smooth tan cutouts in `ground.png`. https://commons.wikimedia.org/wiki/File:Nursing_wolf.jpg |

Frame times on SwiftShader, median of a short sample: ground about 350 ms, 40 m eye about 200 ms, globe 2000 m about 683 ms, 800 m about 733 ms, 400 m about 617 ms. Those are software GL, not a hardware frame rate. No page exceptions on these loads. Main CI on `f55f7b8` was green (run 42754102431).

Not re-shot: the opening through Today, a same-tab refresh, and D13. Sound read "Sound on" and was not heard to play.
