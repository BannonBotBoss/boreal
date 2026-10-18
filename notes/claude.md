# Claude's notes

Newest first. Workflow: [AGENT-WORKFLOW.md](../AGENT-WORKFLOW.md).

## 2026-10-18 08:30 PT - branch `claude/locomotion-hooks` (on top of `claude/agent-workflow`, from main 18b5881)
Gait Builder asked for two things: fold the wolf fork back into the original files, and add support for distant animals.
Both are done, along with the remaining locomotion hooks.
- **Fold-back** (Grok Bot's steps, done as written): `git apply src/animals/locomotion/fork/MERGE.patch` applied cleanly to
  `src/render/playerWolf.ts` and `src/core/wolfBody.ts` (both still at 56506c5). Then `game.ts` and `lab.ts` import
  `../../render/playerWolf`, `src/animals/locomotion/fork/` is deleted, and `tests/locomotion-rig.test.ts` imports the rig.
  The default wolf now has the fork's look: the photo coat with seeded variety, darker saddle, reshaped skin, ears,
  muzzle and paws. It also has the fork's draw-call trim: merged teeth, and tiny parts kept out of the shadow passes.
- **Hooks 1 + 2** (rig descriptor `loco`, `animate(..., legPose)`): these came in with the fold. One addition: when
  `legPose` stops arriving, the tilt group and the girdles' sideways swing return to the plain pose. Before, they kept
  the last pose. The no-op test now checks that directly, because comparing the file with itself would prove nothing.
- **Hook 3**: `AnimalBrain.intent?: { kind: 'jump' | 'pounce' | 'stop'; target? }`. It is set when a jump starts and cleared
  when the jump ends. A player jump is `pounce`; an obstacle jump is `jump`, with the obstacle as its target.
  `game.ts` passes `b.intent` to the layer on the jump's first frame and falls back to the old pounce if it is missing.
  Nothing sets `stop` yet. The field is tagged `snapshot` in `core/stateFields.ts`.
- **Hook 6**: `gaitFor`'s Froude number uses `gravity()` from `proc/physics` instead of `G = 9.81`. The allowlist entry in
  `tests/rules.test.ts` is gone, so no file is allowed a literal g any more. g is now 9.82 (derived), so the gait
  thresholds move by 0.1 %.
- **Distant animals**: a `loco` column in the `core/quality.ts` LADDER sets the full-detail locomotion radius per tier,
  using Gait Builder's numbers: Ultra 40, High 30, Medium 24, Low 16, Very low 10, Minimum 6 m. Under XR it is capped at
  16 m. `LOCO_LOD.nearRadius` and `lodAt()` read it through `applied()`, so the radius follows the governor and the
  manual caps. Animals beyond it run the cheap `mid` path. Beyond `INTEREST.mid` an animal is not instantiated at all
  (core/interest.ts), so no third tier is needed.
- **Tests that changed with the new look, and why:**
  - `tests/body.test.ts` failed on the fork's smaller paws: hind paw width 6.8 cm, against the published 7–11 cm. I widened
    the three sole rings 3.5 % (6.8 → 7.0 cm). The paws still look small, and the test passes without changes.
  - `tests/render-math.test.ts`: the ear-tip bound is now ≥ 0.98 m, because the photo's shorter ears top out about 1 cm
    under 1 m. The leg and head checks now find the bones through `wolf.loco`, because the bones moved under the tilt group.
  - `tests/proc.test.ts`: the fur digest was re-recorded for the new body. The chunk digest is unchanged.
  - `tests/animal-behavior.test.ts`: the Froude check uses `gravity()`.
- Checked: `tsc` clean, `npm test` 232/232 (rules included), `vite build` ok. Smoke load with and without `?loco=1`.
- **Not done (proposals):** the bear has no `loco` descriptor yet. It is plantigrade, and the IK clamps to `CANID_LIMB`, so
  the limb model needs a decision first. The deer still needs a bone rig. Spine bones (hook 5) come later.
  `claude/growing-animals` replaces `wolfBody.ts` with a shared quadruped generator, so it needs this look ported in
  before it can merge. I'll rebase it onto this branch next.

## 2026-10-18 03:00 PT - branch `claude/agent-workflow` (from main 18b5881)
- NEW `AGENT-WORKFLOW.md`: agents only add. Each agent works on its own branch, and Matthew merges, either with the .bat in
  `Desktop\Boreal inbox\` or in GitHub Desktop. Undo is a revert. No copying files over newer ones, no reset/clean/force. Notes go in per-agent files under `notes/`.
- EDIT `PROJECT-RULES.md` (checks before you commit, items 3–4): the dated entry goes in your `notes/<agent>.md`, and other
  agents' code changes go on your branch for Matthew to review (or as a proposal in your notes).
- EDIT `AGENT-NOTES.md`: one pointer line at the top. The history below it is unchanged.
- Why: on 2026-10-15 at 09:23 I copied files from my older workspace copy over newer committed work in this folder, and photo
  mode disappeared. Codex restored the committed versions on 2026-10-18 at 02:27 and saved a backup first, so nothing was lost.
  Under this workflow that can't happen: my work arrives as a branch, and git refuses to overwrite.
