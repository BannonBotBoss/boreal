# Skill: overhead tree crowns

Use when a nadir view of forest is one noise texture and individual crowns are missing.

## Search before writing

1. Placement already exists: `farTreesInTile` (Thomas clusters, `core/flora/stands`). Do not invent a new scatter, and do not paint a NAIP photograph on the ground. That was PR #429.
2. A vertical billboard is edge-on from overhead and vanishes. The impostor has to be the top view: a horizontal quad (the overhead frame of an octahedral impostor, here one InstancedMesh).
3. The globe renders camera-relative (`origin.ts`). During the draw the camera is at the origin and tiles are `renderOffset` from it. A mesh left at planet coordinates (about 6.4e6 m) is outside the clip. Move it by `-camera`, the same as `fieldLines`.
4. Globe materials use logarithmic depth. A default material does not match that depth, so the discs fail the depth test. While the eye is in the nadir band the discs draw with `depthTest` false.
5. A full stem list fuses 8 m crowns into one mat. `spaceCrowns` keeps Thomas positions at least 14 m apart so the ground shows between them.

## Steps

1. `collectCrowns` walks `farTreesInTile` inside `nadirRadius` (altitude times tan of half the 45° fov).
2. `spaceCrowns` drops any point within 14 m of one already kept.
3. `createOverheadCrowns` instances one disc per kept point, on the visible surface radius `R + ground`, lifted 12 m.
4. Call `update` from the globe loop when altitude is between 180 m and 2200 m. `coverSampleLatLon` must say the point has trees. 52 N, 97 W is boreal.

## Checks

- `tests/overhead-crowns.test.ts`: the sprite is a disc with a clear outside, the kept points are at least 14 m apart, they span the view, and spacing drops stems.
- `tests/overhead-picture.test.ts`. Centre window, luma under 45 and green at least as strong as red and blue.
  - Known mismatch, the tile noise: 0.027 at 400 m, 0.023 at 800 m.
  - After: 0.206 at both. Pass is above 0.12.
- URL `?view=globe&alt=400&latlon=52,-97&shot=1&localClouds=0&hour=8.3&day=227&tier=5`, and `alt=800`. Wait until `window.__crowns.count` is set and the tiles have had about 12 s. A shot at 2 s is still the black coarse tiles.

## Mistakes to avoid

- Do not claim crowns from a frame that is still the green noise. The discs are obvious when the offset is right, and invisible when it is not.
- Do not leave the mesh in absolute coordinates.
- The discs are round and dark. Say that. They are not a photograph of a crown.
