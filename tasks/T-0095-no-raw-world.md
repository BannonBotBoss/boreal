---
id: T-0095
title: Nothing sends the raw world across
author: grokbot-3
scratch: false
research: false
skill: no-raw-world
tags: [perception, rust, viewer]
credits: 30
---

# T-0095 Nothing sends the raw world across

Step 15 of `notes/design-roadmap.md`. Issues #101, #105, and #106. #106 wins. Depends on step 16, which is T-0083 on main. Not claimed.

**Credits: 30** (= 10 × 3 × 1). The boundary and the perception block already exist, and no new published number is introduced. Matthew can change the header.

## Goal

The only payloads between the simulation and the viewer are the perception buffer and, later, the summary for when you are not inside a body. Issue #101's JSON list of animals was never built. This task is the test that keeps it unbuilt.

## Kind

A static guard on the existing crossing. The Rust crate is wasm. `src/core/planetBudget.ts` reads numeric planes. The perception block is bytes (`perception.rs`, `perceptionBuffer.ts`). Saves, evidence files, CLI figure JSON, and the materials table stay as they are. No second serializer.

## Objectives
- [ ] A static test fails when a module serializes animal positions or the raw world as JSON for the viewer
- [ ] Saves, evidence files, CLI figure JSON, and the materials table stay clear of that test, and the allowlist is written down
- [ ] The wasm host stays numeric and the perception block stays bytes; the outside-body summary is not a JSON animal list

## Gates

Numbers: N/A. No rate, size, density, or timing is introduced. Frame: N/A. Nothing on screen changes. Evidence: `tests/no-raw-world.test.ts`. The allowlist in that file is empty. A reviewer checks three rows in the handoff against the test and the crossing files.

## Depends on

Step 16 (T-0083), which is on main. Step 36 is not built and is not part of this task.
