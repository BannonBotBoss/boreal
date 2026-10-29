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

Step 11 of `notes/design-roadmap.md`. Issues #101, #117, #118, and #119. Not claimed. This task does not move animal behaviour and does not build the event log.

**Credits: 72** (header unchanged, rule 14). The original formula was 10 × 4 × 1.8. Two objectives were added on 2026-10-26 so a later inspector and event log can hold the same ids. Matthew can change the header.

## Goal

The simulation has one entity store. It constructs an empty world. Nothing acts yet. Each entity has one id that stays valid until that entity is removed, and the same id fails a lookup after removal, so issue #118's inspector and issue #119's event records can point at it later. Issue #117's drives will be components on this store later. They are not added here.

## Kind

New dependency, chosen by rule 11. Shortlist the current releases of `bevy_ecs` and `legion` (the crates issue #101 names) and a smaller maintained component store (`hecs`), and record `slotmap` as the generational-arena pattern that is not by itself a component store. For each: licence, maintenance, size, and which model it implements. Record the pick in `AGENT-NOTES.md`. Prefer the smallest crate that is a real component store, still maintained, links on this repo's Rust, and gives a handle that fails after removal. Do not invent a component store. Do not add a species file. Do not port `AnimalBrain` or `agent.ts` (that is step 12, still in the queue). Do not build issue #119's event log. Do not add a second entity list in TypeScript. The chunk picture stays the picture.

## Objectives
- [ ] The shortlist is written down and one crate is picked, with licence and size
- [ ] That crate links from `rust/boreal-sim` and an empty world constructs in a test
- [ ] No animal behaviour moves in this task
- [ ] `cargo test` still passes
- [ ] A handle that outlives its entity fails a lookup, and that handle is one integer a later event record can store (issues #118 and #119)
- [ ] No second entity list in TypeScript, and no event log in this task (issues #101 and #119)

## Gates

Numbers: N/A (no rates). Frame: N/A (nothing on screen). Evidence: the note in `AGENT-NOTES.md`, the empty-world test, the stale-handle test, and a count benchmark (create, remove, iterate). Rule 12: a reviewer opens the shortlist and the tests.

## Depends on

Nothing. Can run beside T-0081, T-0082, and T-0083. Step 12 in the queue waits on this task.
