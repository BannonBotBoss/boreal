---
id: T-0166
title: Big Bang cinematic — one cosmic clock from the bang to the globe
author: grok-globe
scratch: false
research: true
skill: false
tags: [ui, boot, audio, cosmos]
credits: 52
---
# T-0166 Big Bang cinematic

## Plain-English summary

The bright circle at the start is the early universe, not a loading spinner and not the Sun. First visit: the loading card finishes, the screen goes black, and nothing plays until you click or press a key. Then a short narration, the bang, and a clock that walks from that instant through the hot plasma, the first atoms, the first stars, the birth of the Earth, and only then the planet you can fly. Returning players are not this task: the save that skips the film belongs to another agent. You will hear a low bed, a voice, and one impact. The film is about two minutes. There is no skip on the first visit.

What stays: the loading card, the planet, and the existing deep-time “now”. What is not in this task: a save file, a second clock, or a fake planet swapped in for the real one.

## What the bright circle is

It is the existing early-universe picture (`src/world/cosmos/sphere.ts`): a raymarched hot disc, bloom, and a round screen-space glow. A bare load rewrites to `?start=sphere` and `createOpening` shows it after `#loading` fades. It is not the orbit sun and not the loading card.

## Authority

Spielberg beat sheet v1 plus the addendum. Where they conflict, the addendum wins. One clock: `rust/boreal-sim/src/cosmic_time.rs` until the Sun, then `deepTimeAt(offsetYr)` with `offsetYr = cosmicAgeYr − 13.8e9` so today is 0. Do not move `deepTimeAt(0)` off now. Do not touch `epochOffsetYr`. Wall time, cosmic age, years-from-now, and sim seconds stay four different numbers.

## Scope

- Evolve `src/world/cosmos/opening.ts` in place. Remove the skip-to-planet arc. Beat and keyframe tables live in a small data module.
- After the T-0123 splash, hold on black with a breathing pinpoint and “Click or press any key to begin.” Only a pointer or a key starts narration, the bed, and boot. A gamepad button does not. No audio before that press. The waiting screen must not look like the loading card.
- Boot stays hidden behind the story. Arrival waits on the existing `bootP` gate. If boot is late, extend the drift before arrival. No spinner. Account for the post-paint `spinAndBake` so arrival does not jolt.
- One camera. No `handoverBlend`, no second camera, no auto-fall. Fall gravity stays as it is. Ease into the usual orbit pose. Control returns in orbit only.
- From Earth birth onward the picture is the real globe mesh in the deep-time lava / Hadean state, the same object through to the present.
- Slim panel, not the debugger dump in `src/ui/dataPanel.ts`. Same font and colours. At most 3 rows, an X and the I key, closed state remembered, closing does not pause the film. Hidden until 0:23. Hero lines only: THE BIG BANG, 3 minutes, 380,000 years, Today · 13.8 billion years. HUD hidden for the run and faded in at arrival.
- First visit does not skip. At arrival, dispatch `cinematic:complete` for the save agent. This task does not write a save.
- Audio already in `public/audio/big-bang/`: `narration.mp3`, `bang-impact.mp3`, `bed.mp3`. The flash hits the impact peak at +0.37 s. From about 0:44, loop the bed from 20 s to 45 s with a 3 s crossfade until Matthew asks for more. Hooks only for later music and voice at first light, first stars, and arrival. Do not generate those without a yes.
- Placeholder clips only behind `?cine-refs=1`, files named `PLACEHOLDER_*` under `public/cinematic/refs/`. They are references, not the Photoreal Ultra look. Reduced motion: no camera kick, no shock ring, flash capped at 40%. `?cine=B7` may jump to that beat for review.
- First implementation slice on this branch is the opening through the bang (the black hold, the narration, the impact). The rest of the walk follows on the same branch. No second pull request.

## Objectives
- [ ] One clock and the opening through the bang: click-to-begin, narration, impact flash on the +0.37 s peak, no second clock, `deepTimeAt(0)` still now.
- [ ] The three audio files play on the existing music path; the bed’s 20–45 s loop is ready; later voice cues are hooks only.
- [ ] Slim 3-row panel (X or I, remembered) and placeholder refs gated by `?cine-refs=1`. Arrival emits `cinematic:complete` and does not write a save.
- [ ] Tests for the keyframes against `cosmic_time` and the deep-time milestones, plus `npm test` and `npx tsc --noEmit`.
