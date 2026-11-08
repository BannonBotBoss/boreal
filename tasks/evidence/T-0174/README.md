# T-0174 before frames

Headless Chrome, SwiftShader, 1280×720, `http://127.0.0.1:5173`. Same launch flags as `tools/fall-shot.mjs`. Captured 2026-11-07 on main `8752412f` before the standing-chunk wait.

The page's own landing report (not a Kenora photo) is the condition: biome boreal, latitude 49.77, longitude 65.54 (the seeded home meridian), elevation 370 m, vegetation 1, day 227, hour 15, sun about 38°, snow 0, dry.

| frame | what was on screen |
|---|---|
| `01-ground-forest.png` | Splash gone. Mid-frame RGB about 228,228,228. Non-pale share 0.08 (animals and HUD). No trunks, no moss, no relief. |
| `02-play-hare.png` | Same pale field. Canid meshes piled at the camera. Senses title still "Wolf senses". |
| `04-play-wolf.png` | Wolf embodiment, same load. |
| `05-globe-orbit.png` | Full planet. Loading element still in the DOM (faded). |
| `06-overhead-400m.png` | Black canvas at `alt=400&latlon=52,-97`. Camera, Photo, Gallery still drawn, so the opaque splash is not covering the view. |
| `06-overhead-8000m.png` | Same black canvas at 8000 m. |

Hardware frame rate was not measured. SwiftShader frame medians are in the json next to each png.

## After, this branch

`after-ground.png`. Splash left at 52.7 s (`STARTUP cold`). Same URL. Lower frame RGB about 56,65,41. Green share of the view 0.54 (was a pale field, non-pale share 0.08). Ground, a lake edge, and rocks are in the frame. Trunks are still absent. That is the next defect, not this wait.
