---
id: T-0045
title: Opt-in adaptive music stems (night, day, weather, tension) behind ?stems
author: grok
scratch: false
research: false
skill: game-music-tracks
tags: [audio, music]
credits: 30
---

# T-0045 Adaptive music stems

Board record for a change that reached main with no task. Matthew (Bannon-github) merged PR #40 at 2026-10-23 01:02:45 PT. Merge commit `2f9011b55667c2c839f19e1091c950c8ba681257`. Undo: `git revert -m 1 2f9011b`. CI on that push: actions run 39921888972, conclusion success. The PR author is Bannon-github; the module comment says Grok Bot / Music. This task does not claim the work and does not approve it.

Off by default. `?stems` adds "Adaptive stems" to Menu > Music > Track (`src/audio/musicSettings.ts` `STEMS_ON`). Four Ogg loops in `public/music/stems/` (night, day, weather, tension), decoded once and looped by `AudioBufferSourceNode` (`src/audio/adaptiveStems.ts`). Night and day follow `view.darkness()`, weather follows rain, tension follows a `threat` argument. `src/main.ts` calls `music.update(view.darkness(), Math.min(1, weatherAt(player.x, player.z).rainMmH / 2))` and does not pass threat, so the tension stem stays at 0 in the game. The PR body says the same: "The threat signal is not wired to gameplay."

The gain curves (`STEM_TAU`, `STEM_MASTER`, `STEM_SUM_CAP`, threat hysteresis) are marked in `adaptiveStems.ts` as game calibration, not measurements. The manifest records the synthesis: A minor pentatonic, 90 BPM, 32 bars = 3,763,200 frames at 44.1 kHz, about -20 LUFS, original sample-lab synthesis, no ElevenLabs.

## Objectives
- [ ] `?stems` shows Adaptive stems in the Music track picker and selecting it starts the four loops from darkness and rain. Without `?stems` the picker is unchanged.
- [ ] Weights and the loop length are covered by `tests/adaptive-stems.test.ts`. `npm test` and `npx tsc --noEmit` pass.
- [ ] Threat reaches `music.update` from a real encounter (a hare or deer the wolf is chasing, or the reverse), so the tension stem is not stuck at 0. A timer or a random pulse does not count.

## Acceptance
The picker behaviour above is on main via 2f9011b for objectives 1 and 2. Objective 3 is still open: `main.ts` does not pass threat.
