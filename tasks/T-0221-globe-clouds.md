---
id: T-0221
title: Orbit clouds are a real map, and the sun still sets
author: grokbot-2
scratch: false
research: true
skill: globe-surface-optics
tags: [visual]
credits: 26
---
# T-0221 Orbit clouds are a real map, and the sun still sets

Matthew, direct chat 2026-11-11 18:37 PT, rejected the fourth orbit disc (poster colours, meridian coasts, one cloud ribbon, beige poles, no night side) and said the numeric checks are not a test of realism. Stop tuning the procedural shader. Sample the planet's own land mask, restore the earlier material if it rendered better, composite NASA Blue Marble clouds, and shade with the arrival-hour sun. well, anything i request by direct chat shouldnt need approval (Matthew, 2026-10-22 01:52 PT).

Credits 26 = 10 x 2 objectives x 1.3. Not from scratch.

## Objectives

- [x] The straight coasts are diagnosed from the planet's own land mask, and the disc is the pre-#446 mesh again (vertex colour, the real sun, a night side).
- [x] Orbit clouds are NASA Visible Earth Blue Marble `cloud_combined_2048.jpg` at 2048×1024, and the frames plus the land mask are in the evidence folder.

## Coastline root cause

The zoom-0 DEM is a world map. `coarseMetresLinear` on a 360×180 lat/lon grid has no longitude that is a land/ocean boundary for more than 35% of its height, and Africa is land while the central Atlantic is ocean. The mask is `tasks/evidence/T-0221/land-mask-dem.png`. The straight cuts were the poster shader: a sharp display of that grid, whose pixel edges are meridians and parallels. They were not a planet-generation bug, and not a UV that pasted the map as plate carrée (a column scan of the field is 0).

Git history: the disc before #446 (`51ffd33f`, T-0169, and the morph in `74992927`) is vertex colours on `MeshStandardMaterial` plus the atmosphere. The baked poster (`0f6edb8d` and the later orbit shader) is what flattened the shading and drew the grid. That poster is no longer drawn. Land and ocean are the mesh again.

## Numbers

| What | Result |
|---|---|
| Meridian cuts in the DEM | 0 of 360 longitudes are a coastline for more than 35% of their height |
| Arrival sun | hour 8, day 227. Zenith at home (49.8°N, 65.5°E) is 60°. Subsolar point is 14°N, 6°E |
| Cloud map | 2048×1024, public domain, cited below |

The Apollo mean-RGB and saturated-blue checks passed the rejected poster. They are not the gate anymore.

## Frames

Clouds: NASA Visible Earth, Blue Marble clouds, August 2004 composite `cloud_combined_2048.jpg`. https://visibleearth.nasa.gov/images/57747/blue-marble-clouds and https://assets.science.nasa.gov/content/dam/science/esd/eo/content-feature/bluemarble/images/cloud_combined_2048.jpg. Reference disc: Apollo 17 AS17-148-22727. https://images.nasa.gov/details/as17-148-22727.

- Land mask, north at top: `tasks/evidence/T-0221/land-mask-dem.png`
- Arrival, hour 8, 23,572 km, no sun bias: `tasks/evidence/T-0221/after-clouds.png`. West limb is night. Home is the boreal site, so the lit face is western Asia, not Africa.
- Same hour over 12°N, 18°W: `tasks/evidence/T-0221/after-africa.png`. The subsolar point is 23° from that camera, so this disc stays lit. It is the geography of the rejected poster, with the grid gone.
- Beside Apollo 17: `tasks/evidence/T-0221/side-reference.png`
- Speckle beside the arrival disc: `tasks/evidence/T-0221/side-before-after.png`

## Notes

Ocean and land are the game's vertex colours under Lambert, so the ocean is darker than Apollo and the land is not a Blue Marble albedo. The cloud map is albedo, so the same sun shades it. `presentW` still holds the film's early colours. The PR stays a draft.
