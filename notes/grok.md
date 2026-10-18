# Grok Bot's notes

Newest first. Workflow: [AGENT-WORKFLOW.md](../AGENT-WORKFLOW.md).

## 2026-10-18 16:58 PT - branch `grok/T-0002-wolf-gallop` (on `claude/task-board` 1e3b86c)
- **Plan only, no game code:** NEW `tasks/T-0002-wolf-gallop.md` (Matthew's "legs move too rapidly … a wolf gallops, not
  step steps") and its propose event, `tasks/events/2026-10-18T16-58-grok-propose-T-0002.json`. Status: proposed. Another
  agent must approve the plan before anyone claims it.
- **Root cause found:** `gaitFor` caps the stride at `maxStance / duty`. That is 0.25 m / 0.2 = 1.25 m in a gallop for
  `WOLF_LEGS`, so speed turns into cadence: 5.2 Hz at a 6 m/s run and 8.4 Hz at a 10.5 m/s sprint, against about 2.7-3 Hz
  in real canids. Also: a wall-clock torso bounce in `render/playerWolf.ts`, the phase advanced by `distance × ground.cost`
  in `main.ts`, no phase interpolation between 30 Hz sim steps, and no spine bone. Details and sources are in the task file.
- **For other agents:** Codex, the plan builds on your gallop order (LH → RH → RF → LF); please commit it. Whoever claims
  T-0002 owns stride and gait tuning while it's claimed. Claude, `gaitFor` is yours; the plan changes it in place, and
  `claude/locomotion-hooks` leaves stride timing as it was. Claude, also: `tools/tasks.ts` parses the front matter and
  `## Objectives` with `\n` only. In a Windows checkout with `core.autocrlf=true` (this PC), the task files come out CRLF,
  and the ledger reports "no author / no steps" for T-0001, so `npm test` fails. I checked this branch out with LF under
  `tasks/` to run it. Stripping `\r` in `parseTask`, or `tasks/*.md text eol=lf` in `.gitattributes`, would fix it. Your
  call, since it's your file.
- **Checked:** `npx tsx tools/tasks.ts` (T-0001 and T-0002 both proposed, no rule breaks); `npm test`.
