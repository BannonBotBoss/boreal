# T-0110 handoff — grokbot-3

Biological front end. Issues #156, #160, #162. Blitz #157. Branch `grokbot-3/bio-front-meshy-animals`. The landscape agent on `grokbot-3/eco-front-*` already took T-0109, so this is T-0110.

## Doing

Skin the 21 Meshy animals onto the gait they already have, at the species size, and show that at the home landing and at one landing that is not home.

## Done

- 21 files in `public/models/animals` (about 14 MB). Manifest keyed by species. `setMeshoptDecoder(MeshoptDecoder)`. Old `wolf.glb` and `wolf-low.glb` removed. The new gray wolf is `gray-wolf.glb` (26,033 triangles).
- Mapping, also in the manifest `_notes`: Grizzly Bear → American Black Bear at 0.9 m (brown-bear variant; there is no grizzly row). Bald Eagle → Hawks, Kites and Eagles at 0.55 m (the red-tailed hawk length). Common Raven → Crows and Jays at 0.6 m.
- `src/render/meshySkin.ts` fits the quadruped chain (or a bird body, wings and legs) to the mesh box and writes proximity weights. Canids use `WOLF_LEGS`. Cervids use `DEER_LEGS`. Ursids use `BEAR_LEGS`. Other mammals use the plan ratios and the same `quadrupedPose`. Birds flap.
- Feet on y = 0. Mammals scaled with the shoulder row. Birds scaled on bill-to-tail length. Heading is the group's yaw; the file's head (−X) is −Z.
- Picture: shared geometry, per-animal skeleton, impostor quads in the middle (instanced, 2 triangles), specks beyond. Only the species in the picture are fetched. `fullCap` 6, `lowCap` 16.
- A species with no file (Canada Lynx, and the rest of the checklist) stays procedural.
- Quantized positions are converted to float before the fit. Without that, the wolf's feet sat at −1.

## Number table

See `tasks/T-0110-meshy-animal-skin.md`. Wolf height after the fit is 1.19 m, which is 0.74 / 0.62. A run moves a wolf foot about 0.24 m. Deer foot about 0.11 m. Hare foot about 0.02 m on a 0.22 m animal.

## Frames

`tasks/evidence/T-0110/`. The capture script is `capture.mjs`. The parade page poses eight species at phase 0.05 and 0.55.

- `parade-a.png` and `parade-b.png`: wolf, hare, deer, black bear, moose, red fox, bald eagle, elk, feet on the ground, sizes from the species rows. The elk's hind leg is back in the second frame and planted in the first. That is the gait, not a rigid mesh.
- `home-a.png` and `home-b.png`: the home shore, 15 Aug, 11:06. The counter reports one full mesh. It is the gray wolf from behind, grey and tawny, standing (the readout is walk at 0 speed). A second animal is on the grass ahead of it.
- `boreal-a.png` and `boreal-b.png`: not the home square (55 N, clock 11:10). Reeds, a far hill, open water. A pale animal lies on the grass. The full-mesh counter was 0 in that shot, so that shape is not claimed as a skinned portrait. The landing itself is a different shore.

The measured foot travel is in the test, not eyeballed from these frames: a run moves a wolf foot 0.24 m on the decoded mesh.

## Needs from another agent

None for the files. Worldwide ranges stay with Grokbot-1 (biological back end). The horizon and the drone-photo landscape stay on `grokbot-3/eco-front-*`.

## Next

1. When a landing's population lists a species that now has a file, the picture already loads it. No new loader.
2. The low wolf mesh from T-0108 was not replaced with a second file. The mid step is the impostor.
3. Grizzly and eagle stay on the borrowed rows until a species row exists.
