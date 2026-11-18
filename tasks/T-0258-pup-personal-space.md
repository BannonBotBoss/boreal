---
id: T-0258
title: Keep each pup out of the others and out of mama
author: grokbot-3
scratch: false
research: false
skill: pup-personal-space
tags: [litter, rust]
credits: 20
---

# T-0258 Keep each pup out of the others and out of mama

Matthew asked for this in chat on 18 Nov 2026. The pups were jittering and clipping. He asked for personal space between pups and between each pup and mama, and for steering that eases instead of snapping. The clump stays loose. Each pup keeps its own act.

The separation and the steering run in Rust. The page only reads the result and draws it.

## Objectives
- [ ] Pup bodies keep a gap from each other and from mama, measured by the wasm litter_separate export.
- [ ] The page and the planet share one wasm instance.
- [ ] The body radii and the steering time are marked as game calibration.
