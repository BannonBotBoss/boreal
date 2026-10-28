---
id: T-0110
title: Meshy animals walk on the existing gait
author: grokbot-3
scratch: false
research: true
skill: meshy-animal-skin
tags: [animals, models, skin, bridge]
credits: 65
---

# T-0110 Meshy animals walk on the existing gait

Biological front end (issue #158, the later comments: grokbot-3 owns the animals on screen and the viewer side of the bridge). Issues #156, #160 and #162. Blitz mode (#157): merged by the author once `npx tsc --noEmit` and `npm test` pass.

The landscape lane is `grokbot-3/eco-front-*` (T-0109). This task does not edit those files.

**Credits: 65** (= 10 × 5 × 1.3). Matthew can change it.

## Mapping

Grizzly Bear is not a name in `src/core/species.ts`. The manifest key `Grizzly Bear` uses `as: American Black Bear`, so it is the black-bear row drawn as a brown-bear variant, at that row's 0.9 m shoulder. Bald Eagle is not a name either. The bird group's representative is the red-tailed hawk, so `Bald Eagle` uses `as: Hawks, Kites and Eagles` and is scaled to that group's 0.55 m bill-to-tail length. Common Raven is the representative of Crows and Jays, scaled to that group's 0.6 m length. The same notes are the `_notes` field of `public/models/animals/manifest.json`.

## Objectives
- [x] All 21 Meshy files are in `public/models/animals`, keyed by species in the one manifest. The loader calls `setMeshoptDecoder(MeshoptDecoder)`. The new gray wolf replaces the old wolf file. A species with no file keeps the procedural body.
- [x] Each stored mesh is skinned onto the existing gait for its body plan. Bones are fitted to the mesh bounds and weights come from proximity. A walk or a run is the Meshy body. Wolf, hare and deer first, then the rest.
- [x] Each model is scaled from the species row (shoulder for mammals, bill-to-tail length for birds), feet on the ground, head toward the heading.
- [x] Geometry is shared. The mid distance is an instanced impostor. Only species in the picture are loaded. The full and mid caps stay on `ANIMAL_LADDER`.
- [x] `npx tsc --noEmit` and `npm test` pass. The number table and the stills are in the handoff.

## Number table

| Value | Game | Real figure and source | Match |
| --- | --- | --- | --- |
| Wolf shoulder | 0.74 m | `MAMMALS` Gray Wolf row. The plan's 80–85 cm note stays on the procedural wolf | reused |
| Deer shoulder | 1.0 m | `MAMMALS` White-tailed Deer | reused |
| Hare shoulder | 0.22 m | `MAMMALS` Snowshoe Hare | reused |
| Black bear / grizzly shoulder | 0.9 m | `MAMMALS` American Black Bear. No grizzly row, so the grizzly uses this shoulder | mapped |
| Eagle length | 0.55 m | `BIRD_GROUPS` Hawks, Kites and Eagles (Red-tailed Hawk). A wild bald eagle is longer; this is the row | mapped |
| Raven length | 0.6 m | `BIRD_GROUPS` Crows and Jays (Common Raven) | reused |
| Withers share | 0.62 of the file height | [game calibration] ears above the shoulders, already on the wolf fit | reused |
| Wolf triangles | 26,033 | meshopt decode of `gray-wolf.glb` | measured |
| Full cap | 6 | [game calibration] 6 × ~26k triangles, inside the Quest 750k cap with the forest | labelled calibration |
| Mid cap | 16 impostors, 2 triangles each | [game calibration] one instanced quad per species | labelled calibration |
| Canid leg scale | species shoulder / 0.82 m | `WOLF_LEGS` comment: the measured canid row is a 0.82 m shoulder | reused |
| Bear leg scale | species shoulder / 1.05 m | `bearBody.ts`: the bear row is a 1.05 m hump | reused |
| Wing flap | 0.6 rad | [game calibration] inside the bird humerus range in `skeleton.ts` (±80°) | labelled calibration |
