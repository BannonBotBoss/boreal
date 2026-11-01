---
id: T-0125
title: After a globe landing, show the simulation's local animals
author: grokbot-3
scratch: false
research: false
skill: landing-wildlife
tags: [wildlife, landing, globe, stylized]
credits: 40
---
# T-0125 After a globe landing, show the simulation's local animals

Issue #192, Oct 31 owner directive: 75% visual target, stylized is enough, no photorealism work. Sprint ends Nov 2.

The Rust list already exists (`landing_population` in `rust/boreal-sim/src/species.rs`, wasm, `PlanetSim.landingPopulation`). The viewer was not reading it. This task is the viewer-side consumer. It does not rewrite the density table.

## Objectives
- [x] Read the simulation's per-landing population and stand a capped cast of those species in front of the player, on the ground, in the first view.
- [x] Use the existing Meshy models on the existing gaits. A species with no file (Canada Lynx) gets a procedural body on the same gait. Do not draw a species the list omits.
- [x] A light stylized fill, one palette, so landed animals and vegetation stay readable. Do not edit `world/globe/inpage.ts` or `render/sky.ts`.
- [x] Ten-site in-page descent (`tools/fall-shot.mjs`, EMBODY) with click lat/lon, landed lat/lon, biome, species, count, and frame time under `tasks/evidence/T-0125/`.
