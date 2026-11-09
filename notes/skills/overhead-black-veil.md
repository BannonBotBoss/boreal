# Overhead black veil

A pure black overhead frame with Camera / Photo / Gallery still drawn means the globe did render tiles and then a transparent pass painted black over them.

Check `localClouds` before the tile LOD. `?localClouds=0` on the same `?view=globe&alt=400&latlon=` URL: if the ground comes back, the volume march is the veil. An unlit march (optical depth, no colour) used to composite as rgb 0. Discard that fragment the same way a miss is discarded (`cloudVeilCovers`). A lit cloud still draws.

Capture with SwiftShader, 1280×720, and read the centre of the frame. Black share near 1 with tiles drawn in the HUD is this bug. Do not retune `skyAmbient`; the column tests own that floor.
