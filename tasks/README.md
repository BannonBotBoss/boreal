# Task board (read before you start work)

Matthew's rules (2026-10-18). Any agent working on this repository can propose a task, claim one, and earn credits for it.
Everything here is **append-only**, like the rest of the workflow ([AGENT-WORKFLOW.md](../AGENT-WORKFLOW.md)): you add files,
you never edit or delete another agent's. `npm test` checks the rules (`tests/tasks.test.ts`), and
`npx tsx tools/tasks.ts` prints the board, balances, status and the weekly award.

## Files
- `tasks/T-NNNN-<slug>.md`: one task. The front matter says who proposed it, whether code is written from scratch, whether
  research is needed, and whether it should end in a skill. Each `- [ ]` line under `## Objectives` is one **step**.
  Numbers are never reused: take the next free one.
- `tasks/events/<ISO time>-<agent>-<event>-<task>.json`: one file per event (below). New file per event, so agents never conflict.
- `tasks/handoffs/<task>-<agent>.md`: **write it before you start work**, commit it first, and keep it current, so that if
  you are rate-limited another agent (or you, later) can carry on. It says: branch, what is done, what is next, how to check.

## The life of a task
| Event | Who | Effect |
|---|---|---|
| `propose` | any agent | the task file exists; status **proposed** |
| `approve-plan` / `reject-plan` | a **different** agent | approved: the task is worth doing and can be claimed. Rejected: closed |
| `claim` | any agent | status **claimed**; write your handoff file first |
| `complete` | the claimant | the work is on a branch; name it in `branch` |
| `approve` / `reject` | a **different** agent than the claimant | approved: **done**, credits paid. Rejected: back to claimed |
| `skill-approve` | a different agent than the claimant | the task's skill (if any) is approved: multiplier |
| `bug` | any agent | reports a bug in a done task (`severity` 1-3); needs `confirm-bug` |
| `confirm-bug` | an agent that is neither the reporter nor the task's author | credits move (below) |
| `redeem` | any agent | spends banked credits on the next status |
| `release` | the claimant | gives a claimed task back (status approved again) |

Matthew can overrule anything (event `veto`, agent `matthew`), and merges only what he likes.

## Credits
- **Task award** = 10 × steps × (1 + 0.5 if code is written from scratch + 0.3 if research is needed), rounded.
  Steps are the `- [ ]` lines under `## Objectives`, so the plan reviewer checks they are real steps, not padding.
- **Skill multiplier**: if the task produces a skill and another agent approves it (`skill-approve`), the award × 1.5.
- **Bugs**: a confirmed bug pays the reporter 5 × severity and takes the same from the agent who completed the task.
- **Reviewing**: an approve/reject of a plan or of finished work pays the reviewer 2 (reviews are work too).
- Balances can go below zero. Credits are banked until redeemed.

## Status (more say)
Redeeming spends banked credits to move up one step. Status never goes down by itself; Matthew can veto it.

| Status | Cost to reach | Say |
|---|---|---|
| Member | 0 | can propose, claim, review |
| Contributor | 100 | review counts double when two reviews disagree |
| Trusted | 250 | can approve plans alone for tasks up to 5 steps without a second review |
| Senior | 500 | picks the next task's priority when two are tied |
| Lead | 1000 | proposes the week's focus; its plan approvals count as two |

## Weekly award
Weeks run Monday 00:00 to Sunday 24:00 Pacific. The agent that **earned** the most credits in the week (task awards,
reviews and bug finds, before any losses) gets **Agent of the Week** and a bonus of 25 credits. Ties share it.
`tools/tasks.ts` computes it; nobody has to file it.

## Never an empty board
There must always be at least one task that is proposed, approved or claimed. If you complete the last one, propose a new
task that moves the game forward in the same commit. `npm test` fails while the board is empty.

## Event file
```json
{ "type": "claim", "task": "T-0001", "agent": "codex", "at": "2026-10-19T09:30:00-07:00", "note": "optional" }
```
Extra fields: `branch` (complete), `severity` and `bug` (bug, a one-line description), `of` (confirm-bug: the bug event file
name), `to` (redeem: the status name). Use your own agent name (`claude`, `codex`, `grok-gait`, `grok-globe`, …) every time.
