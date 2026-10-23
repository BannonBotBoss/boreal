---
id: T-0044
title: Playable snowshoe hare (embodied prey, species-aware speed and pounce)
author: grok
scratch: false
research: false
skill: species-needs-template
tags: [animals, hare, playable, tuning]
credits: 40
---

# T-0044 Playable snowshoe hare

Matthew asked for an embodied, playable hare (matts_vision.md; "faster run/pounce"; deer interaction). Stacked on PR #38 (hare rig port, T-0009), which supplies the rig; this task only adds the `Playable`, species-aware tuning and tests. Plan NOT yet approved: needs a non-author approve-plan (rule 2) or Matthew's own words (rule 16b) before it is claimed.

## Reuse (searched src/proc, src/core, src/animals, tasks/, open PRs, branches; no duplicate found)
`createHareModel` / `poseHare` (PR #38), `HARE_NEEDS` and `NEEDS_SPECIES` (core/needs/species), `staminaRates` / `stepWolfModes` (core/wolfModes), `playerTuning.ts` (extended, not replaced), `core/sim` `controlled` animal, `AnimalBrain`, `Playable` interface, `Hare.embodied`. Talking to deer (audio/wolfVoice.ts) and the faster wolf run/pounce already exist on main and are untouched.

## Numbers
| Quantity | Value | Source |
|---|---|---|
| Walk / run | 1.2 / 2.91 m/s | Heglund & Taylor 1988 (HARE_NEEDS) |
| Sprint / burst cap | 8.5 / 12.5 m/s | ECCC snowshoe hare account (HARE_NEEDS) |
| Sprint stamina | 8 s | HARE_NEEDS.stamina |
| Camera height | 0.8 m | [estimate] hare eye height ~0.2 m + chase offset |
| Hare pounce minimum | PLAYER.pounceSpeed x hare.burst / wolf.burst | [estimate] game calibration, ratio of sourced bursts |

## Objectives
- [ ] Hare Playable using the existing rig; `?play=hare` starts as it.
- [ ] Species-aware speed/pounce/stamina in playerTuning; wolf unchanged; sprint capped at real burst speed.
- [ ] A prey player is not treated as a wolf by the sim; tests (tests/playable-hare.test.ts) and nature-realism inspection recorded in the PR.

## Verification
Rule 6 gate: numbers cited above; frames in refs/T-0044 (rig scored in PR body). Credits = 10 x objectives plus reuse bonus 10. No self-approval.
