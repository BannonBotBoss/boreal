# Skill: turn a design issue into a step on the roadmap

Use when Matthew posts a design issue, or when a bot takes the next step from `notes/design-roadmap.md`. T-0080 wrote the roadmap for issues #100–#109. The binding precedence line is the single line under the title in `PROJECT-RULES.md`. Do not copy that line into a second rule.

## Steps
1. Read `PROJECT-RULES.md` (the precedence line and "Talking to Matthew" if that section is on main) and `notes/design-roadmap.md`. Higher-numbered issues win over older issues, code, plans, and tasks. #109 overrides #108 overrides #107, and #100–#109 override anything older.
2. Search the repo and the board before adding a step. Name the file that already does the job. A step is a rewrite only when that file conflicts with the winning issue. Say what the rewrite replaces. Reuse it when it already fits.
3. A new step needs one plain goal, the issues it covers, what it reuses or replaces, the gates (sourced numbers, a frame or a stated reason the frame is N/A, evidence a reviewer can open), a size, and whether it can run beside another step.
4. Keep the coverage table current. Every section of the issue maps to a step. A section with no step is a hole.
5. Propose at most the next unblocked step, not the whole remainder. Take the next free task id (`notes/skills/next-free-task-id.md`). Do not claim a pile of tasks. Do not rebuild pull request #94 (the one picture from space to the forest) or pull request #92 (the one clock). Link them.
6. A message Matthew will read opens with a short plain summary. No abbreviations. The roadmap's own summary stays about twelve short lines.

## Checks that prove it worked
- The precedence sentence in `PROJECT-RULES.md` and the roadmap header match.
- `tests/tasks.test.ts` ("design precedence") still finds the summary, the rewrite quote, and the coverage heading.
- A reviewer can spot-check three rows of the coverage table against the issue text and the step.

## Mistakes to avoid
- A second climate, a second clock, a second level-of-detail tree, or a second animal brain.
- Treating the example numbers in an issue (a 35 degree span, a hunger threshold of 80) as the game numbers. The winning issue sets the relationship. The numbers gate sets the digits, from a published source or a labelled calibration.
- Filing every remaining step as a board task. The roadmap is the queue.
- Approving your own plan. A `"for": "matthew"` comment is not an approval.
