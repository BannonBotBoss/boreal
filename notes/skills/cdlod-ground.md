# Skill: fill the ground to the horizon with CDLOD

Use when the eye sees separate terrain plates, sky in the gaps, or concentric rings with a visible step. The old skirt (`buildSkirtMesh` in `src/world/globe/horizonSkirt.ts`) is not the surface to keep tuning.

## What is drawn

Filip Strugar, "Continuous Distance-Dependent Level of Detail for Rendering Height Maps", GPU Pro (A K Peters, 2010). The mesh is `src/world/terrain/cdlod.ts`. `src/render/horizonMesh.ts` builds it. The chunk meshes stay for the near ground, the water sheets, and the entities. This mesh fills the gaps and continues out past `horizonMetres`.

1. A node of world size S is a fixed grid (`CDLOD.grid` quads, finest side `CDLOD.leaf` = 32 m, so 4 m quads). Split while the camera is closer than S * `CDLOD.range` (2). Neighbours stay within one level.
2. Odd vertices morph onto the parent grid across the outer half of that band. An edge against a finer neighbour stays on the raw height. An edge against a coarser neighbour snaps to the straight edge. Both use the unmorphed samples, or the coarse edge lifts off the fine edge and opens a crack.
3. Curvature is `curvatureDrop` after the height sample and before the morph, so a morphed vertex sits on the coarser edge. Do not drop quads behind the camera. Do not dither inside the horizon: `aFade` stays 1.
4. The ground camera far plane is `groundFarPlane` (past the mesh). The mesh is a full disc, so a turn does not rebuild it. Snap on the camera cell.

## Checks

- `tests/cdlod-ground.test.ts`. A flat disc and a bumpy disc have `interiorGaps` 0 inside the horizon. The same poses as the game (spawn eye and 40 m) have zero sky pixels below the geometric horizon. Removing faces in front of the lens scores above zero. That is the calibration: a known match is 0, a known hole is not.
- `npx tsc --noEmit`. The old `tests/horizon-skirt.test.ts` still covers the ring helper. Do not extend the rings to fix a hole.

## Mistakes to avoid

- Do not morph a coarse edge toward its parent while the fine edge keeps the raw height. The seam opens by tens of centimetres.
- Do not force morph 1 on an edge that borders a finer node. That edge has to stay raw.
- Normals are +Z cross +X. The other cross points down and the ground lights as if it were the underside.
- A height that is not the camera's ground makes the horizon test look at the sky on purpose. The flat calibration surface is `heightAt` under the camera.
- `skirtSample` matches `heightAt` on land. On a lake it is the water surface and `heightAt` is the bed. Use the surface for the drawn mesh.
