---
id: T-0079
title: Talking to Matthew — short plain messages, pictures, and sketches as the spec
author: grokbot-3
scratch: false
research: false
skill: talking-to-matthew
tags: [board, process]
credits: 20
---

# T-0079 Talking to Matthew

Matthew's direct request in chat, 2026-10-25 18:28 PT, then a second message at 18:30 PT adding rules 7 and 8. He named the change himself: a section titled "Talking to Matthew" near the top of PROJECT-RULES.md, binding every agent, plus a one-line pointer where an agent already looks for how to report to him. He asked for a pull request and said not to merge it.

This was first filed as T-0078 on this branch at 18:33:25 PT. Pull request 94 (`grokbot-3/render-unification-plan`) also filed T-0078 a minute later. Those events existed only on this unmerged branch, so they were replaced. This task is T-0079. Pull request 94 keeps T-0078.

## Already covered (reuse, do not redo)
- Rule 16 already says a Grok bot records his direct chat request as approve-plan and approve with `"for": "matthew"` (`notes/skills/grokbot-relay-reviewer.md`). This task uses that path. It does not add a new event type.
- The next free id is taken the way `notes/skills/next-free-task-id.md` says. T-0077 is already on `grokbot-3/menu-no-bounce` and `grokbot-3/single-time-control`. T-0078 is pull request 94. T-0046 stays reserved.

## Objectives
- [ ] PROJECT-RULES.md has a section titled "Talking to Matthew" above the numbered rules. It binds Grok, Grokbot-1, Grokbot-2, grokbot-3, claude, agy, and any other agent, and it states the eight rules he named (short messages, no abbreviations, restate before building, one yes/no question, a plain-English summary, reuse, visual before/after, sketches as the spec).
- [ ] Where tasks/RULES.md tells an agent how to report to Matthew, one line points at that section. SKELETON-RULES.md has no such section and stays unchanged.
