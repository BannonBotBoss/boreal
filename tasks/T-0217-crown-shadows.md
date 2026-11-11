---
id: T-0217
title: Lit nadir crowns with a cast shadow
author: grokbot-2
scratch: false
research: true
skill: overhead-crowns
tags: [visual]
credits: 39
---
# T-0217 Lit nadir crowns with a cast shadow

Follows the merged T-0214 frames. Those crowns were flat card sprites on a smeared ground.

## Numbers

Cover sample at 52.00 N, 97.00 W: boreal, tree share 1, about 2439 stems/ha. Mean spacing is `100 / sqrt(2439) = 2.0 m`. Viereck and Johnston 1990, Silvics of North America, Picea mariana: the crown is a narrow spire. Drawn spruce diameters are 3.0–5.4 m and the few aspen are 4.5–7.0 m, so crowns overlap. That is the size of the clumps in the orthophoto, not the 10 m discs.

## Reference

Esri World Imagery. The exact point 52 N, 97 W is the east shore of Lake Winnipeg; the high zoom there is a coarse mosaic, not crowns.

- Spot: `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?bbox=-97.08,51.94,-96.92,52.06&bboxSR=4326&size=1024,768&format=jpg&f=image`
- Crown reference, boreal NAIP served by that same map, 48.094 N, 91.482 W: `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?bbox=-91.490,48.090,-91.474,48.098&bboxSR=4326&size=1280,720&format=jpg&f=image`

Side by side: `tasks/evidence/T-0217/side-by-side-400.png`.

## What the frames show

Shot at 52.05 N, 96.94 W, the boreal cell next to the game point. 48.094 N, 91.482 W is water in the planet, so a frame there has no crowns.

Green-canopy pixels: green at least red and blue, green above 40, no channel at 220 or above. Reference crop coverage 0.877.

| | coverage | R mean/sd | G mean/sd | B mean/sd |
|---|---|---|---|---|
| reference | 0.877 | 52.9 / 16.8 | 71.9 / 15.6 | 43.5 / 13.7 |
| 400 m | 0.959 | 53.3 / 13.3 | 68.4 / 13.7 | 39.8 / 7.7 |
| 800 m | 0.973 | 52.7 / 11.6 | 67.7 / 12.0 | 39.5 / 6.8 |

Coverage is inside 10 points (8.3 and 9.7). Every mean is inside 15%. Blue's standard deviation is not: 7.7 and 6.8 against 13.7. Full table: `tasks/evidence/T-0217/canopy-stats.json`.

7598 crowns at 400 m, 25542 at 800 m. The earlier 18045-instance frame had a geometric crown area about three times the view, so the trees were not culled. They were too dark to count except for the yellow tips.

Still not the photograph. The crowns are smooth cones. The lit side is a lighter green edge, not a separate shadow on the ground. The ground is soft, and a few dark holes are wider than the photo's gaps.
