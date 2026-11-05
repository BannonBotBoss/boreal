---
id: T-0166
title: Remember the cosmic intro and resume the last place
author: grokbot-2
scratch: false
research: false
skill: save-resume
tags: [save, intro, resume]
credits: 30
---
# T-0166 Remember the cosmic intro and resume the last place

Matthew, 2026-11-05 ~12:06 PT, asked for a save so a player who already watched the Big Bang comes back where they left off. At ~12:13 PT he raised the bar: the first visit still walks the cosmic intro and does not jump to the present. The film, the data panel, and the sound stay with Globe Builder. This task is only the save.

T-0165 is pull request #321. This is the next free id.

Credits 30 = 10 x 3 objectives (rule 14). `scratch` is false: the events save, `saveAll`, and `hasSave` already exist.

## Objectives

- [ ] The existing events save (`boreal.events.v1`) round-trips `introComplete` and the last place. A damaged place is dropped. A first visit still chooses the cosmic intro.
- [ ] The intro is marked only when it finishes or the player dismisses it. A later load with that flag skips the intro and restores the saved mode and place. Explicit ground, bench, menu, and `at` queries stay as they are.
- [ ] Tests cover the round trip and the first-visit versus return-visit choice. `npm test` and `npx tsc --noEmit` pass.

## Acceptance

1. `hasSeenBigBang`, `markBigBangSeen`, `loadResume`, and `saveResume` read and write the events document. No second store.
2. `bootChoice('sphere', false, …)` is `sphere`. `bootChoice('sphere', true, place)` is the saved game or globe place.
3. The sphere film, the data panel, Rust cosmic rendering, and intro audio are untouched.

## Out of scope

The cosmic timeline (cooling, plasma, atoms), data-panel close, 3D number reveals, and ElevenLabs audio. Claim waits on the approve-plan in this same direct request (rule 16b).
