---
id: T-0100
title: Sense thoughts are pictures that fade with the signal
author: grokbot-3
scratch: false
research: false
skill: sense-pictures
tags: [senses, perception, rewrite]
credits: 30
---

# T-0100 Sense thoughts are pictures that fade with the signal

Matthew, 2026-10-26, in the request that started this branch: "The wolf's sensory system, instead of words, use a stream of imagery, simple 2d pictures, the strength of the signal equals the level of alpha, or transparency. Like little thoughts bubbling up and floating away."

Not claimed. grokbot-3 wrote this plan and does not approve it. It must merge after pull request #144 (T-0097, `grokbot-3/sound-direction`).

**Credits: 30** (= 10 × 3). A rewrite of the wolf senses panel, not from scratch, and no new measured constant. Matthew can change it.

## Goal

The wolf senses panel shows a stream of simple flat pictures instead of sense words. A strong signal is nearly solid. A faint one is nearly see-through, and still just visible. Each picture bubbles up, drifts toward the side it came from, and fades. The picture does not name a species, an identity, or a distance.

## Kind

Rewrite of the words in `src/ui/senses.ts`. Hearing still comes from `createSoundCues`, packed as the 28-byte sound entry and read with `readSoundEntry`. Smell still comes from `smell`. Sight, when a body is close enough to see, comes from `perceive`. No second sense system and no new buffer writer.

## Objectives
- [ ] A sense signal is a flat picture whose opacity follows the signal strength, with a floor so a faint picture stays visible
- [ ] Each picture bubbles up, drifts toward the signal's side, and fades, and the number of live pictures stays at the cap
- [ ] The wolf senses panel does not show a species, an identity, or a distance; the pictures stay generic per sense

## Gates

Numbers: no new hearing or smelling distance. The bubble life is the need-thought fade already set (1.75 s). The cap is the sound-entry cap in issue #106 (8). The opacity floor and the nearly-solid top are game calibration of Matthew's picture, not a wolf measurement. The re-emit interval is six panel refreshes.

Frame: the wolf senses panel before (words) and after (pictures). One frame with several pictures at different strengths. A short sequence of one picture rising and fading.

Evidence: opacity scales with strength, the live count stays at the cap, and the panel text has no species and no distance.

## Depends on

Pull request #144, task T-0097, the direction-and-urgency captions. This branch starts there. The pictures replace those visible words. The caption function stays for the compass mark's accessibility label.
