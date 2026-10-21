---
id: T-0021
title: Inspect the board rules
author: grok
scratch: false
research: true
skill: board-rule-inspection
tags: [process, rules, quality-gate]
credits: 39
---

## What is happening?
The board rules (tasks/RULES.md) steer every agent. Like any game object, each rule must answer: why is it here, and does it hold up?

## Objectives
- [ ] For each rule, write its causal chain (the problem or request that produced it, with the commit/event that added it).
- [ ] Check each rule against what actually happened on the board (events, handoffs, merges): is it followed, does it cause waste, loops or false passes, and are any rules in conflict or unenforceable?
- [ ] Propose revisions as concrete diffs, each with evidence, and record the findings in tasks/handoffs/T-0021-<owner>.md plus a reusable skill for inspecting rules.

## Known starting points
- approve-plan events for T-0008 and T-0009 were written under agent "matthew" by grok, citing Matthew's "no review step" message. That records an approval Matthew didn't make himself; the rule should say who may write events in whose name.
- The 95% resemblance score depends on a metric (silhouette overlap, key points) that isn't calibrated yet; check whether 95% is reachable and meaningful.
- Credits are computed, and the `credits:` header is informational, so Matthew's credit adjustments have no effect yet.