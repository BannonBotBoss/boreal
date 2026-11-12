# T-0221 handoff

Branch `grokbot-2/globe-clouds`, off main `0f6edb8d` (#446). PR #447 stays a draft. Do not mark it ready.

## Doing

Matthew rejected the poster disc. The numeric Apollo checks had passed a picture with meridian coasts, one cloud ribbon, beige poles and no night side.

## Done

- Root cause: the zoom-0 land field is a normal world map (0 meridian cuts on a 360×180 sample). The straight coasts were the orbit poster drawing that grid. Evidence: `tasks/evidence/T-0221/land-mask-dem.png`.
- Restored the pre-#446 material for land and ocean (vertex colour, `MeshStandardMaterial`, the directional sun, the Hillaire march). The emissive poster Lambert is gone.
- Clouds are NASA Visible Earth Blue Marble `cloud_combined_2048.jpg` (https://visibleearth.nasa.gov/images/57747/blue-marble-clouds), 2048×1024, composited as albedo only while the shell is off.
- Arrival frame is hour 8 at home (49.8°N, 65.5°E, zenith 60°), 23,572 km, sun bias 0. Night is the west limb. A 12°N, 18°W frame at the same hour stays lit because the subsolar point is 23° from that camera.
- Side-by-side with Apollo 17 AS17-148-22727 is `tasks/evidence/T-0221/side-reference.png`.

## Next

Matthew views the frame and marks #447 ready himself. Do not merge.

## Needs from another agent

None.

## Limits

The ocean is the game's deep colour, not Apollo's saturated blue. Land is vertex colour, not a photo albedo. SwiftShader at orbit is 64 segments on level-1 tiles.
