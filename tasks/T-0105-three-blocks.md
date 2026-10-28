---
id: T-0105
title: Body, feeling, and urge are three different blocks
author: grokbot-3
scratch: false
research: false
skill: three-blocks
tags: [perception, behaviour]
credits: 40
---

# T-0105 Three blocks

Step 19 of `notes/design-roadmap.md`. Issues #102, #103, #105, and #106. Conflict 12: #106 wins. Not claimed. grokbot-3 wrote the plan and does not approve it.

**Credits: 40** (= 10 × 4 × 1). Matthew can change the header.

## Goal

Hunger and thirst are the body. Fear and curiosity are feelings. The pull to feed, flee, mate, or move is the urge. Mating is an urge, not a mind stat.

## Plan

Reuse. The physiology block stays `physiologyOf` and `packPhysiology` (T-0102). The urge magnitudes stay `urgeWeights` and `urgeScores` (T-0099). The bytes stay the step 16 reader (T-0083). This task does not add a `Mind` struct and does not add an `Instincts` struct.

- **Body.** Hunger, thirst, fatigue, pain, temperature stress, oxygen stress, stamina, and the reserved float are the 32 bytes T-0102 already packs. They are copied to byte 64. Hunger stays the unfilled share of energy on the needs percent scale.
- **Feelings.** Fear and curiosity are the emotion block at byte 96, in issue #106's order. Fear is the sensed cue step 10 already multiplies. Curiosity is a feeling the caller can pass. Omitted, it is 0 (calibration: no curiosity rate on the species row). Emotion stress is not the body's temperature stress. It stays 0. Confidence, aggression, and social attachment stay 0 (calibration). The two reserved floats stay 0. Hunger is not written into any of these eight floats.
- **Urge.** The eight floats at byte 128 are issue #106's instinct block. Feed, drink, flee, and move are the step 10 products: severity × the species utility × the opportunity. Flee's importance stays 1. Mating is the fifth float. It stays 0 (calibration: step 10 has no mating weight, and #101's mating cutoff 85 lost). It is not an emotion field. Migration, territorial, and social stay 0 (calibration). The rest score stays in the step 10 comparison (`strongestUrge`) and is not copied into mating or into an emotion. `AnimalBrain` stays the legs.
- **Not in this task.** Nothing is drawn. The senses panel is not edited (open change #148). The density fold is not edited (open change #151). No wasm rebuild. No new coefficient.

## Objectives
- [ ] Hunger and thirst stay on the body block, fear and curiosity stay on the feeling block, and the pull to feed, flee, mate, or move stays on the urge block
- [ ] Those urge magnitudes are the step 10 products, using `urgeWeights` and `urgeScores`
- [ ] The three blocks occupy perception offsets 64, 96, and 128
- [ ] A test shows a body hunger value does not also appear as an emotion, and mating is not a feeling field

## Gates

Numbers: the step 10 weights, carried by calling `urgeWeights`. No new coefficient. Mating, curiosity when omitted, emotion stress, migration, territorial, and social are calibration (held at 0). Frame: N/A. Nothing is drawn. The substitute is the byte check below. Evidence: `tests/three-blocks.test.ts` reads the frame with `readPerception`. Hunger is the float at byte 64 and is absent from the 32 emotion bytes. Fear is the float at byte 96. The feed pull is the float at byte 128. Mating is the float at byte 144 and is not an emotion.

## Depends on

Step 10 (T-0099, on main, `43dac9f`) and step 18 (T-0102, on main). Does not wait on the open picture or density changes.
