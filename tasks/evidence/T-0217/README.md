# T-0217 evidence

Numbers are in `canopy-stats.json`. A green-canopy pixel has green at least as high as red and blue, green above 40, and no channel at 220 or above. The bottom 40 rows are the HUD and are left out.

Reference coverage 0.877. After 400 m is 0.914 (3.7 points). After 800 m is 0.950 (7.3 points). Both are inside 10 points. Every RGB and HSV mean is inside 15%. The standard deviations are not.

The darkest 8×8 block is luminance 29.6 at 400 m and 31.9 at 800 m. The reference 1st percentile is 15.1, so neither frame has a black block.

The shot is 52.05 N, 96.94 W. The planet calls 48.094 N, 91.482 W water, so a frame there has no crowns. This cell is boreal in the game and forest in the imagery. Crown counts: 4355 at 400 m, 16397 at 800 m. Meadows are where shore cover is high and the stand mottle that feeds that weight is high.

SwiftShader, 1280×720. `?view=globe&latlon=52,-97&shot=1&localClouds=0&hour=8.3&day=227&tier=5` at `alt=400` and `alt=800`.

## Sources

Esri World Imagery, `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer`.

- `ref-esri-52n97w.jpg` is the game point, bbox `-97.08,51.94,-96.92,52.06`. Lake Winnipeg and fen. The high zoom of this point is a coarse mosaic, so it is not the crown reference.
- `ref-esri-naip-boreal.jpg` is boreal canopy at 48.094 N, 91.482 W, bbox `-91.490,48.090,-91.474,48.098`. NAIP through that map service. Closed small crowns, dark green, openings of grass.
- `side-by-side-400.png` is `after-400.png` beside that crown reference.

Export URLs:

- `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?bbox=-97.08,51.94,-96.92,52.06&bboxSR=4326&size=1024,768&format=jpg&f=image`
- `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?bbox=-91.490,48.090,-91.474,48.098&bboxSR=4326&size=1280,720&format=jpg&f=image`
