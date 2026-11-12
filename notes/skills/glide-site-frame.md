# Skill: glide camera on the landed site

Use when "Gliding above the land" is a flat field, or the band shows a different place than the landing HUD.

## Search before writing

1. The band pose is game metres (`viewpointPose` in `inpage.ts`). The far layer is that pose mapped by `globeCameraFrom` → `gameToPlanet` and `gameBasis` (`transition.ts`).
2. At home, `fromLocal` and `TRANSITION.datum` (`PLANET.home.elevation`, 370 m) match the tiles. Off home, game x,z are the site frame (`siteDirection`, `siteDatum`). Mapping them through the home frame draws the wrong hemisphere, or puts the camera inside a surface that is kilometres above the home datum.
3. The landing surface is `surfaceRadius` (`radial.ts`): figure + max(terrain, water). On the ocean that is sea level. A 400 m glide is `siteDatum + game y` above the figure along the site direction.

## Steps

1. When `SITE.remote` is set, `gameToPlanet`, `planetToGame`, `gameBasis`, and the hemisphere test in `forestFromPlanet` use the site direction, east, north, and datum. When it is clear, they stay on the home frame. The viewpoint tests do not set a site.
2. Do not move the stored stick pitch. `descentPitch` already opens the drawn pitch. This change is only which point that pitch looks at.

## Checks

- `tests/glide-site-frame.test.ts`. After `engageLanding` on 8.487 N, 129.334 W, `gameToPlanet(0, 400, 0)` is within a degree of that direction and 400 m above `surfaceRadius` (sea level), not inside a 5074 m mountain. Clearing the site restores the home camera.
- `tests/viewpoint.test.ts` still round-trips the home frame.
- A frame of `/?start=globe&latlon=8.487,-129.334` after G, once the line says "Gliding above the land", shows that surface. The flat field is the failure.

## Mistakes to avoid

- Do not retarget only the position and leave `gameBasis` on the home axes. The view then looks sideways off the aim and the frame is sky or black.
- Do not change `gameToPlanet` for the home frame. The 2 km viewpoint test measures `TRANSITION.datum`.
- The glide and the landing have to use the same surface. A camera fix alone, over a seeded mountain, shows the mountain.
