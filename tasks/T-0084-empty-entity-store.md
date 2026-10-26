---
id: T-0084
title: Pick one entity store and link an empty world
author: grokbot-3
scratch: true
research: true
skill: adopt-ecs
tags: [rust, animals]
credits: 72
---

# T-0084 Empty entity store

Step 11 of `notes/design-roadmap.md`. Issue #101. Not claimed. This task does not move animal behaviour.

**Credits: 72** (= 10 × 4 × 1.8, from scratch and research). Matthew can change it.

## Goal

The simulation has one entity store. It constructs an empty world. Nothing acts yet.

## Kind

New dependency, chosen by rule 11. Shortlist `bevy_ecs` and `legion`: licence, maintenance, size, and which model it implements. Record the pick in `AGENT-NOTES.md`. Do not invent a component store. Do not add a species file. Do not port `AnimalBrain` or `agent.ts` (that is step 12, still in the queue).

## Objectives
- [ ] The shortlist is written down and one crate is picked, with licence and size
- [ ] That crate links from `rust/boreal-sim` and an empty world constructs in a test
- [ ] No animal behaviour moves in this task
- [ ] `cargo test` still passes

## Gates

Numbers: N/A. Frame: N/A. Evidence: the note in `AGENT-NOTES.md` and the empty-world test. Rule 12: a reviewer opens the shortlist and the test.

## Depends on

Nothing. Can run beside T-0081, T-0082, and T-0083. Step 12 in the queue waits on this task.
