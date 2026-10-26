---
id: T-0083
title: The perception buffer, packed the way issue #106 describes
author: grokbot-3
scratch: true
research: false
skill: perception-buffer
tags: [perception, rust, rewrite]
credits: 45
---

# T-0083 Perception buffer

Step 16 of `notes/design-roadmap.md`. Issues #105 and #106. #106 wins the bytes. Not claimed.

**Credits: 45** (= 10 × 3 × 1.5, from scratch). Matthew can change it.

## Goal

One contiguous block a TypeScript reader can walk: header, body, emotion, urge, visible things, scent volumes, sounds, memories. Counts may be zero. Nothing is drawn. No JSON world dump.

## Kind

New contract. Replaces the JSON sketch in #101 and the nested structs in #105, which were never built. Follow the offset table in #106, not default `#[repr(C)]` padding: the embodied id sits at byte 20. Sound entries are 28 bytes (the fields sum to 24; the extra 4 are the reserved bytes the issue asks for). Memory entries stay 20 bytes. Caps on the order of 32 visible, 16 scents, 8 sounds, 12 memories.

## Objectives
- [ ] A Rust writer and a TypeScript reader agree on a known frame, including the header offsets and the 28-byte sound entry
- [ ] Counts may be zero, and the reserved tails are present so a later sense does not break the layout
- [ ] No module serializes animal positions as JSON for the viewer

## Gates

Numbers: N/A, the sizes are the issue's layout. Frame: N/A, nothing on screen. Evidence: the byte test. A reviewer checks three offsets against issue #106.

## Depends on

Nothing. Can run beside T-0081, T-0082, and T-0084.
