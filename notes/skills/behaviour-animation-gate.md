# Skill: gate a behaviour animation against a sagittal diagram

Use when a behaviour needs its own procedural animation and a 95% timing-and-position score. The live mesh is a later step. This skill is the map, the pose, and the gate.

## Steps
1. Add one row to `src/core/behaviourData.ts`. The id is the animation id. `happening` is one concrete line (species, action, phase, view). Timing and bone lengths come from a row that already exists (`HARE_GAIT`, `canidPlan`, `HARE_BODY`, `WOLF_LEGS`, `holdVisual`, `PHYS.jumpSeconds`). Do not invent a crouch depth, a chew fraction, or a second gravity.
2. `src/core/behaviourPose.ts` `sampleBehaviour(id, phase)` is the recording. Wolf gaits call `gaitFor` and `footTarget`. Hare gaits call `footState` from `core/needs/bound.ts`. A leap uses `gaitPose`'s ballistic height (`gravity()`, not 9.81). A plant pose holds the feet on `ground` or `target`.
3. `tools/anim-gate.ts` `diagramPose` is the reference. It reads the row and does not call `sampleBehaviour`, `footTarget`, or `footState`. `scoreAnimation` asks the six questions over 8 frames. Pass at >= 0.95.
4. `tools/ref-prompt.ts` writes `refs/<species>/<behaviour>/`: `meta.json` (the prompt), `attempts.md`, `see.txt` (a description generated from the recording), `strip.svg` (recording on top, diagram below), `gate.txt`, and `reference/frame-0.svg` … `frame-7.svg`.
5. A photograph is not the position certificate (tasks/RULES.md rule 11). Log that as a rejected try in `attempts.md`. The accepted reference is the diagram, because its footfall can be checked against the published duty.

## Checks that proved it worked
- Known match: `scoreAnimation(id)` >= 0.95 and silhouette IoU is 1 at the same phase. Wolf paw x equals `restX - footTarget().z` within 1e-9 m. Hare flee duties sit within 0.02 of `boundDuty` / `boundForeDuty`. Leap hip offset equals `gaitPose('jump', …).bob`. Airborne fraction is within 0.02 of 0.65.
- Known mismatch: `scoreAnimation('hare-flee', phase => sampleBehaviour('hare-flee', phase + 0.5))` scores 0.333.
- `npx tsc --noEmit` and `npm test`.

## Mistakes to avoid
- Scoring the recording against itself. The diagram has its own foot formula. The phase-shift case is the calibration, and it has to land under 0.95.
- A new unsourced fraction (chew window, crouch depth). Share a constant that is already cited, or leave the pose on the bind.
- Treating an image-model frame as the 5% keypoint band. There is no calibrated picker from that picture to the ten markers.
- A species-named source file. The rows live in `behaviourData.ts`.
- Wiring `playerWolf` in the same change. The gate does not move the mesh. Say that in the handoff.
