---
id: T-0071
title: grokbot-3 relays Matthew and reviews other agents' PRs, never its own
author: grokbot-3
scratch: false
research: false
skill: grokbot-relay-reviewer
tags: [board, process]
credits: 30
---

# T-0071 grokbot-3 is a relay and a distinct reviewer

Matthew's direct request in chat, 2026-10-24 11:36 PT. Asked "Do you want me to switch to `grokbot-3` to match grokbot-1 and grokbot-2? That name would also need adding to `RELAYS_MATTHEW` before I can record your chat approvals." he replied "switch". grokbot-3 has its own GitHub account (`grokbot-3`), so it is its own agent: it may relay Matthew's chat approvals and it may review other agents' PRs. Self-review stays refused.

## Already covered (reuse, do not redo)
- T-0069 added `grokbot-1` and `grokbot-2` to `tools/agent-review.mjs` `AGENTS` and to `tools/tasks.ts` `RELAYS_MATTHEW`, and named them in tasks/RULES.md rules 16 and 17(c). This task adds `grokbot-3` the same way.
- The author of a PR is the branch prefix (`grokbot-3/<topic>`). `grok/` is a different prefix. A review by the author is refused.

## Objectives
- [ ] `node tools/agent-review.mjs <pr> grokbot-3 approve` is accepted on a `grokbot-1/`, `grokbot-2/` or `grok/` branch, and grok, grokbot-1 and grokbot-2 may approve a `grokbot-3/` branch; grokbot-3 is refused on its own branch (tests/agent-review.test.ts, fake `gh`).
- [ ] `tools/tasks.ts` `RELAYS_MATTHEW` counts a `"for": "matthew"` approve-plan/approve written by `grokbot-3` like one written by `grok` (tests/tasks.test.ts).
- [ ] tasks/RULES.md rules 16 and 17(c) name grokbot-3 alongside grokbot-1 and grokbot-2 as a distinct reviewer with its own GitHub account, per Matthew.
