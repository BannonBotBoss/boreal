---
id: T-0097
title: A sound is a direction and an urgency
author: grokbot-3
scratch: false
research: false
skill: sound-direction
tags: [sound, perception, rewrite]
credits: 30
---

# T-0097 A sound is a direction and an urgency

Step 25 of `notes/design-roadmap.md`. Issues #104, #105, and #106. #106 wins. Not claimed. grokbot-3 wrote this plan and does not approve it.

**Credits: 30** (= 10 × 3). A rewrite of the compass captions, not from scratch, and no new measured constant. Matthew can change it.

## Goal

A snap is "something, that way, loud", not "wolf, 40 m". The compass caption names a direction and an urgency. It does not name a species and it does not print a distance.

## Kind

Rewrite of the named compass captions in `src/ui/senses.ts`. The cue list stays `createSoundCues` in `src/core/senses.ts`. No second sound system. The words are read from one 28-byte sound entry, the block issue #106 describes and step 16 (T-0083) already packs. #105's named category string does not apply.

## Objectives
- [ ] The compass caption for a snap is a direction and an urgency, and it does not print a species name or a distance
- [ ] That caption is read from the 28-byte sound entry, and the cues still come from createSoundCues
- [ ] Hearing range stays the species row, with the game-calibration label left where it is

## Gates

Numbers: hearing range stays the wolf species row (40 m, game calibration already labelled on that row). The three urgency words split the cue's existing 0–1 level into thirds. That split is game calibration of the word, not a new hearing distance.

Frame: a snap on the compass shows a direction and does not print a species. Recorded in the game, before and after.

Evidence: the caption reads a 28-byte sound entry. Category is not shown. Direction and urgency are the fields the words come from.

## Depends on

Step 16, the perception buffer (T-0083, on main). Parallel with step 24. Does not touch the camera work on `grokbot-3/one-viewpoint` (pull request #143, T-0096).
