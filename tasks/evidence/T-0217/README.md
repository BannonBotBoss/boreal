# T-0217 evidence

SwiftShader, 1280×720. `?view=globe&latlon=52,-97&shot=1&localClouds=0&hour=8.3&day=227&tier=5` at `alt=400` and `alt=800`.

## Sources

Esri World Imagery, `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer`.

- `ref-esri-52n97w.jpg` is the game point, bbox `-97.08,51.94,-96.92,52.06`. Lake Winnipeg and fen. The high zoom of this point is a coarse mosaic, so it is not the crown reference.
- `ref-esri-naip-boreal.jpg` is boreal canopy at 48.094 N, 91.482 W, bbox `-91.490,48.090,-91.474,48.098`. NAIP through that map service. Closed small crowns, dark green, openings of grass.
- `side-by-side-400.png` is `after-400.png` beside that crown reference.

Export URLs:

- `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?bbox=-97.08,51.94,-96.92,52.06&bboxSR=4326&size=1024,768&format=jpg&f=image`
- `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?bbox=-91.490,48.090,-91.474,48.098&bboxSR=4326&size=1280,720&format=jpg&f=image`
