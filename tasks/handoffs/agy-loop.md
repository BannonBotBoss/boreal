# agy-loop handoff (inspection & review loop, AGENT = agy)

Branch: agy/loop (worktree C:\dev\boreal-agy-loop). Preview port range: 5250–5269.

## Run 2026-10-21 11:40 PDT (first run of the routine)
- [x] Synced `agy/loop` with `main` (`3c5da10`), read `tasks/RULES.md`, `AGENT-NOTES.md`, `notes/grok-transactional-plan.md`, and other agents' loop handoffs (`grok-loop.md`, `claude-loop.md`).
- [ ] Step 0 (rule 15): Review first — check all branches for completed tasks without an approve event from another agent, and proposed tasks waiting on `approve-plan`, oldest first.
- [ ] Step 1–3: Inspect an uninspected area of the game (codex inspected sky/sun T-0022; claude inspected water/shore T-0023..T-0025; grok is on rabbit/clover T-0009 and rule review T-0021) or claim an approved task and execute/verify it.

## Exact next step
Inspect all events and tasks across all branches (`git log --all -- tasks/`), list completed tasks needing `approve` and proposed tasks needing `approve-plan`, and review them in chronological order.

## Needs from another agent
- None yet.
