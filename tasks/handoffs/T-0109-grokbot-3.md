# T-0109 handoff (grokbot-3)

Branch: `grokbot-3/eco-front-horizon`. Issue #156, step 1. Lane: front end and the bridge (issue #158, the later comments). Blitz mode is #157. Grokbot-1 is told on issue #162. grokbot-2 is not tagged.

## What this step is

T-0108 left a chunk square inside the coarse globe (`tasks/evidence/T-0108/home-low.png`, `prairie-glide.png`). This step puts distance rings under that square, out to the geometric horizon, using the planet height and the globe colour that already exist. It does not yet look like a drone photograph. That failure is below, in the frame answers.

## What was built

- `src/world/globe/horizonSkirt.ts` builds doubling rings from 28 m out past `sqrt(2 R h + h²)`. Height and colour are `planet.sampleSurface` and `surfaceColour`. The sphere drop `R − R² / sqrt(R² + r²)` puts the horizon at eye level. Far quads behind the eye are dropped so a ring cannot smear across the sky. Lighting normals are planet-up, because a coarse chord's geometric normal paints wedges.
- `src/render/horizonMesh.ts` is one mesh, rebuilt when the camera crosses 40 m. A remote landing adds `surfaceDetail`, faded out by 2 km.
- `inpage.ts` draws it in the drone, extends the far plane past the horizon, and widens the chunk dither (`patchDiscRadius`) so the square's corners fall inside the fade. `render/fade.ts` feathers from half the disc radius.
- `XR_CAPS` is unchanged. The skirt cap is 6,000 triangles. Ultra globe tiles plus that cap stay under the 750k Quest figure in `src/core/quality.ts`.

## Number table

| Value | Game | Real figure and source | Match |
| --- | --- | --- | --- |
| Horizon | sqrt(2 R h + h²) | Line of sight to the tangent point. Drop at that distance is h R / (R + h). R is the IUGG mean radius already in `PLANET` (Moritz 2000) | yes |
| At 400 m | 71.4 km, drop 400.0 m | Same formula. The mesh outer radius in `frames.json` is 77.1 km | yes |
| At 36 m | 21.4 km, outer 23.1 km | Same formula | yes |
| Triangles | 1,480 at 36 m, 1,872 at 400 m | Cap 6,000. Ultra globe 160 × 48² × 2 ≈ 737k (`GLOBE_LOD`). Together under 750k (`src/core/quality.ts`) | yes |
| Inner ring | 28 m | [game calibration] Under the chunk dither | labelled calibration |
| Haze | 6 % to 72 % of the outer radius | [game calibration] Not a measured extinction coefficient | labelled calibration |
| Globe land albedo | spruce 0.028, 0.045, 0.022 | MODIS boreal canopy about 3–6 % visible reflectance, already the globe table | reused |

## Frames

Headless Chrome, swiftshader, `tasks/evidence/T-0109/capture.mjs`, Vite on 127.0.0.1:5286. Same places as T-0108. Glide pitch is the isometric aim the fall hands over, −0.615 rad. Low pitch is −0.45 rad so the horizon is in the frame. Counts are in `frames.json`.

| Still | What is on screen |
| --- | --- |
| `home-glide.png` | 400 m over home. Dark green-grey fills the frame. No pale horizon line. Faint lighter streaks. It does not read as a landscape. |
| `home-low.png` | 36 m. A pale sky band across the top, then a dark band, then blurry dark green ground. The old hard square is not the thing in the middle of the frame. The ground is too dark to count as a photograph. |
| `boreal-glide.png` | 55 N, 400 m. Flat dark blue-grey. No horizon, no shore, no relief. |
| `boreal-low.png` | 40 m. Pale sky, then flat cyan that reads as atmosphere or water, and a dark textured patch in the lower right with a hard corner and a dithered edge. |
| `prairie-glide.png` | 42 N, 400 m. Flat dark blue. The planet sample here is ocean (`skirtSample` returns water). No horizon in the frame. |
| `prairie-low.png` | 36 m. Pale sky, a horizon, dark blue water, and a rectangular textured patch in the lower right. The patch edge is still there. A dotted fade sits on its right side. |

## Verdict against a drone photo

Not a match. Uncalibrated: there is no measured score, and these frames would not pass one. A drone photo at 36–400 m shows the ground in the same detail from the camera out to the horizon, with a bright sky, relief, and a shore that is not a rectangle. `home-low.png` and `prairie-low.png` do put a horizon in the frame, which T-0108's glide stills did not. The ground between the chunk patch and that horizon is a dark flat colour, and at prairie the chunk rectangle is still obvious. `home-glide.png` and `boreal-glide.png` do not show a readable landscape at all.

## Needs from another agent

The next steps on this lane do not wait. Real elevation and a licensed photograph are still to be forced through here. Prairie, tundra, and desert cover need a data shape from Grokbot-1; that issue is filed with the cover step.

## Leftovers

- Objective 2 stays open. The square edge is still in `prairie-low.png` and `boreal-low.png`.
- The rings use the procedural planet relief. A mountain is the seed, not a DEM.
- The colour is `surfaceColour`. Up close it does not hold.
- Water is the globe's lake and ocean albedo. No reflection.
- Trees are still only the chunk instances.
- Multiplying the skirt colour to lift it out of the dark turned the coarse triangles into bright facets. That lift was taken back out. The dark band is the honest current picture.
