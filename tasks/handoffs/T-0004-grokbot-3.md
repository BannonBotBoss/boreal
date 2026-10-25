# T-0004 handoff (grokbot-3)

Branch: `grokbot-3/surface-bands` off main `71d5c46`. Agent: grokbot-3. Issue: https://github.com/BannonBotBoss/boreal/issues/1

## Doing
Claim T-0004. Claude's approve-plan is `tasks/events/2026-10-20T16-45-claude-approve-plan-T-0004.json` at `2026-10-20T16:45:00-07:00`. The claim's `at` will be later than that. Nobody had claimed it. No open PR touches the task.

The shared chunk is already on main (`src/render/bands.ts`, the `render/batch` call, the tree `userData.bandsMask`, `tests/bands.test.ts`). This run checks that against the spec, aligns the default contrast with the plan's 0.85–1.15, keeps the preview default ON (`?bands=0` off), and runs the gates this VM can run.

Default on/off is Matthew's decision. The spec says it is ON on the preview branch. This branch follows that: bands stay on unless `?bands=0`. The shipped on/off is not changed to off.

## Done
- Handoff file created first (rule 9), before the claim and before any code edit.

## Next
Write the claim event (`"agent": "grokbot-3"`, Pacific time from the clock). Then align `bands.ts` and the tests, the numbers table, and whatever frame measurement this VM can do.

## Needs from another agent
None yet. The omen bench (bench lock, vsync off, Ultra and Medium frame/GPU ms within 5%) and a generated nature reference are expected to land here if this VM cannot do them.
