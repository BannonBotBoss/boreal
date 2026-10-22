---
id: T-0037
title: One systems properties file - every system's tunables, wiring and a generated system map
author: grok
scratch: false
research: false
skill: system-properties
tags: [config, tooling, docs, controls, camera, audio, quality]
credits: 40
---
# Systems properties file

Status: proposed by grok for Matthew (2026-10-22 ~01:25 PT: "just add those figures to a system properties file" and "yes, a systems properties file will tie everything together and it will allow me to see how everything is rigged up"). Needs another agent's approve-plan (claude, codex or agy). Credits = 10 x 4 objectives = 40. Work: branch grok/system-properties, worktree C:\dev\boreal-grok-sysprops; handoff tasks/handoffs/T-0037-grok.md.

## Evidence and cause
- Tunables are spread over ~60 modules: exported tuning objects (core/tuning LEVEL/BLOCK/PHYS, core/playerTuning PLAYER, core/quality LADDER/GOVERNOR, core/renderSettings RENDER/USER, ui/chronometer CHRONO, ui/haptics FEEL, core/senses SENSES ...), loose module-top literals (render/math camera pitch/rider, core/timeOfDay clock) and ~60 URL flags parsed in 17 files. Nothing shows how the systems feed each other.
- grok/interact-outline (T-0035) and grok/wolf-hydration (T-0036) each already create src/config/systemProperties.ts (plain `SYSTEM_PROPERTIES = { <group>: {...} } as const`, one alphabetical key per system). This task keeps that exact shape so their groups merge as whole sections.

## Proposed implementation / scope
Reuse first: keep every existing module's exported names (CHRONO, FEEL, PLAYER, GOVERNOR, DEFAULT_PITCH ...) so no call site changes; those modules now read their figures from SYSTEM_PROPERTIES. Large data tables (quality LADDER, species, gait tables, materials, flora) are linked, not inlined. Per system the same file carries a wiring entry (modules, depends on, feeds, URL flags, linked tables) and per-figure units + source/estimate + readers. tools/system-map.ts renders docs/system-map.md (mermaid wiring + tables) from it; `npm run system-map`; a test fails when the doc is stale. No behaviour change: a test pins every moved figure to its pre-move value.

## Objectives
- [ ] 1. Inventory every system in src (terrain/stages, trees/vegetation, water, sky, lighting, clock, weather, animals/locomotion, agent/behaviour, controls, camera, stamina, audio, UI, graphics tiers, save/load, globe, URL flags) into src/config/systemProperties.ts with per-system wiring, units, source/estimate and readers.
- [ ] 2. Move the player-facing figures (camera, movement/jump, controls feel, chronometer, haptics, loading, senses/interaction, footsteps, quality governor, clock) into the file system by system, tests green after each; values-lock test proves behaviour is unchanged.
- [ ] 3. tools/system-map.ts -> docs/system-map.md (mermaid wiring diagram + tables), npm script `system-map`, staleness test.
- [ ] 4. Skill notes/skills/system-properties.md (adding a system or tunable); npm test + npx tsc --noEmit; handoff with the evidence gate (rule 12).

## Acceptance
Matthew opens docs/system-map.md (or the .ts file) and sees every system, what feeds what, and where each figure lives; changing a moved figure in the file changes the game; npm test and tsc pass; values-lock and doc-staleness tests pass.
