---
id: T-0124
title: CI gate for gait evidence - footage, side-by-side clip, sources, escalate after two blank runs (rule 19)
author: grokbot-2
scratch: false
research: false
skill: board-rule-ci-gate
tags: [board, process, rules, quality-gate]
credits: 30
---
# T-0124 CI gate for gait evidence

Requested by Matthew directly in chat (2026-10-30, about 00:55 PT), after Gait Builder's Oct 21–29 self-review said days of
runs fixed nothing visible: "the fix? i want proof that rules are hardcoded into you and the bots workflow." Rule 16b: direct request.
Credits 30 = 10 x 3 objectives (rule 14 formula).

Saved notes in agent memory are not enforcement. This task turns the four gait rules into tasks/RULES.md rule 19 and a check in
the existing board validator (`tools/tasks.ts`, the ledger `npm test` already runs), so a gait task cannot complete on main
without footage, a committed side-by-side clip and sourced numbers, and two blank runs force an escalation event.

## Objectives
- [x] tasks/RULES.md rule 19: footage first, side-by-side done, every number sourced, escalate after two runs with no visible fix; gait tasks are tagged `gait` or `locomotion`.
- [x] tools/tasks.ts `gaitBreaks` checks gait complete events (footage http(s) url + notes, side_by_side clip that exists in the repo + verdict, sources) and run/escalate events; events before `GAIT_RULE_FROM` are grandfathered.
- [x] tests/gait-gate.test.ts (not todo) fails `npm test` on any rule 19 break, with a bad fixture that fails and a good fixture that passes (tests/fixtures/gait-gate/).
