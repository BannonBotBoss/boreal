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

## Mistakes to avoid

- Do not lerp the drone into the rig camera. That was the second camera.
- Do not replace the fall aim with the band Euler while the planet camera is still above the band. Map it, and keep the fall aim when the map is not exact.
- Do not change `globePitch`, `descend`, `stepCarriedFly`, or the wind rush. The climb still uses `globePitch`.
- Do not merge the scenes or delete the far layer in this phase.
- Do not edit the climate, weather, or clock files while those branches are open.
- A gnomonic pose with a tiny or negative home dot sends the camera to infinity. Reject it.
