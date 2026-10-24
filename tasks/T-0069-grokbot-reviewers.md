---
id: T-0069
title: grokbot-1 and grokbot-2 are separate reviewers who can approve each other
author: grokbot-2
scratch: false
research: false
skill: false
tags: [board, process]
credits: 30
---

# T-0069 grokbot-1 and grokbot-2 review each other

Matthew's direct request in chat, 2026-10-23 (about 18:55 PT): "no no, grok-v can approve grok-2's work", then "they are on
their own github accounts". Grokbot-1 and Grokbot-2 are two Grok bots on two GitHub accounts (`Grokbot-1`, `Grokbot-2`),
so they are two agents, not one family: each may review the other's PR. Self-review stays refused.

## Already covered (reuse, do not redo)
- `tools/agent-review.mjs` already names the author from the PR branch prefix and refuses a review by that author. This
  task only adds `grokbot-1` and `grokbot-2` to its `AGENTS` list (branches `grokbot-1/<topic>`, `grokbot-2/<topic>`).
- `tools/tasks.ts` already accepts a Matthew approval relayed with `"for": "matthew"` (rules 16/16b), but only from agent
  `grok`. The Grok bots that now relay Matthew are `grokbot-1` and `grokbot-2`, so they are added to that check.

## Objectives
- [ ] `node tools/agent-review.mjs <pr> grokbot-1 approve` is accepted on a `grokbot-2/` branch and vice versa; each is refused on its own branch (tests/agent-review.test.ts, fake `gh`).
- [ ] `tools/tasks.ts` counts a `"for": "matthew"` approve-plan/approve written by `grokbot-1` or `grokbot-2` like one written by `grok` (tests/tasks.test.ts).
- [ ] tasks/RULES.md rules 16 and 17(c) name grokbot-1 and grokbot-2 as distinct reviewers with their own GitHub accounts, per Matthew.
