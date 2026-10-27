# Skill: one viewpoint from orbit to the forest

When to use: the planet view and the forest view should share one camera, or a second camera is being blended in at the handover.

## Search before writing a camera

1. The forest camera is `PerspectiveCamera` in `src/render/buildScene.ts` (48°, near 0.2, far 700 in the game).
2. The planet camera is the one in `src/world/globe/globeView.ts`. In the band it is already driven from the forest camera by `globeCameraFrom` and `drive`.
3. The pose the band already flew is `viewpointPose` in `src/world/globe/transition.ts`: `(x, groundY + height, z)` and `Euler(pitch, yaw, 0, 'YXZ')`. Do not invent a third pose.
4. Orbit clip is `orbitClip`: near = altitude × 0.02 clamped to 0.5 m … 100 km, far = limb past the mean sphere with the radical clamped. That is the clip `globeView` already used. Do not pick new near or far numbers.
5. The free fall stays `lookAt(0,0,0)`, then `rotateZ(-lookAz)`, then `rotateX(fallPitch − NADIR)`. Do not aim it with a second `lookAt`. `forestFromPlanet` is the inverse of `globeCameraFrom`. It returns false off the home-facing hemisphere (`dot` with home under 0.25), and the fall's own aim stays.

## How the one viewpoint is wired

1. `inpage` calls `globe.attachViewpoint(view.camera)` when the shared globe is created. The standalone page does not.
2. Above the band (`ext` is null), after the fall or orbit has aimed the planet camera, `forestFromPlanet` writes that pose onto the forest camera and `globeCameraFrom` maps it back. The draw uses the mapping only when position is within 1 cm and the angle is within 1e-4 rad. Otherwise the planet camera is left as the fall aimed it.
3. Inside the band, `inpage.camera` writes `viewpointPose` onto the forest camera and `drive` flies the planet camera from it. That is the old band pose. At 2 km it matches within a centimetre because it is that pose.
4. Becoming the animal calls `handoverBlend`, which returns the one pose. `TRANSITION.blendSec` stays 1 and is not applied. There is no lerp into the rig camera.
5. Two scenes remain. Globe mode draws the planet scene once (`globe.step(null)`). The band draws the planet into the far layer once (`globe.step(far.target)`) and the forest once. Do not draw the planet twice in one frame.

## Checks

- `tests/viewpoint.test.ts`: at 2 km the position gap is under 1 cm, the handover returns the same object at t = 0, 0.5 and 1, a nadir-plus-rotate aim round-trips under 1 cm, and the far side returns false.
- `tests/flight-entry.test.ts` still locks the double-click, the 180° spin, the isometric pitch at 10,000 ft, carried speed, and `orbitClip`.
- `npx tsc --noEmit` and `npm test`.
- Stills: orbit, 2 km, 600 m, 60 m, on `?start=globe&stages=1&trees=v2&noprobe&inpagedev`. The 2 km, 600 m and 60 m stills are the drone after a handoff at that height (speed zero, pitch already isometric, because the fall finished at 10,000 ft). Read `__inpage.height`, the elevation, and `camera.y − (groundAt + height)`. The budget is `STATS.globeMs + STATS.drawMs` against the same capture on main. One `globe.step` per frame.

## The camera sits on the figure

`gameToPlanet` / `planetToGame` use `figureRadius` for the radial term only. East and north stay on the mean radius, which is the gnomonic scale `fromLocal` already uses. The tiles are built on the hydrostatic figure (`tile.ts`). A camera on the mean sphere is about 5 km too high over the home region, so `DETAIL` (fades in below 5 km) and `NEAR_SPLIT` (below 3 km) never turn on, and the atmosphere's discard sphere (`uRp`) treats the air under the mean sphere as sea-level density. `globeView` passes `R + ground` (`surfaceRadius`) into `atmos.update` each frame so `uRp` and `uRa` follow that same surface. The dome mesh is not rebuilt. The same radius is the sphere for the existing tile split, frustum and horizon test (`surf = R + ground`).

## The near split uses the footprint

`NEAR_SPLIT` deepens nodes under the camera below 3 km. The old gate was distance from the camera to the node centre, compared with altitude × `reach`. A level-7 cell is about 78 km across, so the camera sits inside it while the centre is about 45 km away, and a reach of a few kilometres never contains that centre. The boost never starts, and the frame stays one coarse leaf. `nearNode` measures along the surface from the cell's footprint (the same half-diagonal slack the horizon test uses). The draw cap still multiplies the far-field split (`splitK`, floor 0.35). It must not multiply the near split: the same 45 km centre then falls just outside the reduced factor and the cell collapses again. `splitWanted` applies the boost to the tier split (`lod.split`), and the cap only to nodes the camera is not over.

## The closed pad menu

`.padm` sets `display:flex`. That author rule beats the browser's `[hidden] { display: none }`, so the closed menu stays on screen: an empty centered box, `min(980px, 92vw)` wide and 36 px tall (the padding), background `#0d131e`. On a 1100×700 frame it is the dark bar across the middle. `.padm[hidden]{display:none}` is required, the same way `.time-hud[hidden]` already is.

## Coarse vertex lakes below 8 km

The dark sharp polygons at 2 km are vertex-field lakes (`aLake` / `vLake`) with the home shoreline mask off (`hm` is 0). They are lake colour (`GLOBE_COLOURS.lakeDeep`), drawn as many small triangles that read as one polygon. They are not tile outlines, cloud shadows, or holes to space. Once the cell under the camera is fine, each triangle is only a few pixels, so a fade keyed on segment size never sees the body.

Three.js uploads a `MeshStandardMaterial`'s uniforms once per material per frame. A uniform written in each tile's `onBeforeRender` sticks on the first tile. `LAKE_FADE.uHide` is one value, set in `renderTo` before `renderer.render`: 1 when globe altitude is under `COARSE_LAKE.below` (8000 m), else 0. The fragment then does `landMask = mix(landMask, 1.0, vLake * (1.0 - hm) * uHideLake)`. The home mask still draws the real shore. Oceans (`vLake` 0) stay. Orbit and 10 km keep the far-field lakes.

## The floor look

The fall finishes at the isometric pitch (`ISO_BELOW_HORIZON`, about −35.264°) and the drone keeps that stick pitch. At 1 m that aim looks into the ground a couple of metres ahead, and into the nearest trunk. The flat teal is the far-layer atmosphere where the forest geometry is missed, because the eye is inside the stem and backfaces are culled.

`descentPitch` changes only the drawn pitch, and only on the way down, between `FLOOR_LOOK.high` (48 m) and `HORIZON_TILT.floorAlt` (8 m). At 100 m and above the drawn pitch stays isometric. At the floor it is the horizon tilt (−0.18 rad, about −10.313°). The stored stick pitch is unchanged, so the climb still uses `globePitch` alone. Roll stays 0: `viewpointPose` is `Euler(pitch, yaw, 0, 'YXZ')`. Do not edit `positionCamera` in `src/render/math.ts`. That is the wolf follow camera, and `grokbot-3/level-view` owns it.

`eyeClearOfTrees` shifts only the rendered eye when height is under `EYE_CLEAR.below` (18 m). It does not write the flight spot and it does not move the wolf spawn (`LANDING_VIEW` / `clearViewSteps`). The gap is 1.6 m, outside a black spruce stem (dbh 15–25 cm) and outside the near plane at 1 m (0.2 m). The grey stripes are the bark plate shader seen from inside the stem (`conifer.ts`, `fract(pl * 3)` on bark `0x6b5a4a`). Needles stay `0x8eb054`. Do not change the bark shader. A grey snag in a frame taken from outside the stem is a dead tree.

## Mistakes to avoid

- Do not put the driven camera on the mean sphere. The round trip of `gameToPlanet` and `planetToGame` still passes when both sides use the mean sphere, and both are still wrong relative to the mesh.
- Do not decide the near split by distance to the node centre, and do not let the draw cap shrink that near factor. Both leave the cell under the camera at one coarse leaf. Sitting the split sphere on the figure is necessary and is not sufficient.
- Do not move only the camera onto the figure and leave `uRp` on the mean sphere. Below about 5 km the camera is then inside the discard sphere and the additive sky draws over the terrain.
- Do not lerp the drone into the rig camera. That was the second camera.
- Do not replace the fall aim with the band Euler while the planet camera is still above the band. Map it, and keep the fall aim when the map is not exact.
- Do not change `globePitch`, `descend`, `stepCarriedFly`, or the wind rush. The climb still uses `globePitch`.
- Do not merge the scenes or delete the far layer in this phase.
- Do not edit the climate, weather, or clock files while those branches are open.
- A gnomonic pose with a tiny or negative home dot sends the camera to infinity. Reject it.
- Do not write a `MeshStandardMaterial` uniform inside `onBeforeRender` and expect each tile to see its own value. The upload happens once per material per frame.
- Do not hide the 2 km lakes by segment pixel size. After the near split those triangles are small and the dark body remains. Gate it on altitude, once, before `renderer.render`.
- Do not replace the descent with `globePitch`. 100 m and 600 m stay at the isometric pitch. `descentPitch` eases only the drawn pose in the last tens of metres.
- Do not move the wolf spawn to clear the drone eye. `eyeClearOfTrees` shifts the drawn eye only. `LANDING_VIEW` stays the camera-wolf line.
- Do not edit `positionCamera`. Roll on this camera is already 0 in `viewpointPose`. The wolf follow roll belongs to `grokbot-3/level-view`.
- Do not repaint the bark to hide the grey stripes. Those stripes are the plate shader seen from inside the stem. Move the eye out.
