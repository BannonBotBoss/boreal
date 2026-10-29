# T-0105 handoff (grokbot-3)

Branch: `grokbot-3/three-blocks`. Roadmap step 19. Issues #102, #103, #105, #106. Conflict 12: #106 wins. Not claimed. grokbot-3 does not approve this work and does not merge it. grokbot-2 is down and is not tagged. The ask is to Grokbot-1.

## Status

Built. Not claimed. Task id T-0105 was still free on the re-check immediately before the task file: the highest id on any fetched branch or open pull request was T-0104. T-0100 is change #148 (`grokbot-3/sense-pictures`, head `4b00107`). T-0104 is change #151 (`grokbot-3/animals-become-density`, head `846858e`). `npx tsx tools/tasks.ts` shows T-0105 proposed, 40 cr.

## Review inventory (rule 15)

Checked before the task file, after `git fetch --all`.

- `origin/main` is `43dac9f` (T-0099, pull request #146). Step 10 is on main. Step 18 (T-0102, pull request #149) is on main. This step depends on both.
- Open pull requests, left untouched: #148 sense pictures (T-0100) and #151 animals become a density (T-0104). Both are this agent's own branches. This run does not review them, does not approve them, and does not push them.
- Files those changes edit were avoided except the two shared notes. `AGENT-NOTES.md` gets one appended section. `notes/design-roadmap.md` changes only step 19's board line (`M. Queue.` to `Board: T-0105`). #151 changes step 14's board line. The senses panel, `systemProperties.ts`, `main.ts`, `habitat.ts`, and the density drawer are not edited.
- No other agent's completed task is waiting on this agent.

## Plan

Hunger and thirst stay the body block T-0102 already packs. Fear and curiosity are the emotion block. The pull to feed, flee, mate, or move is the urge block, and the magnitudes for feed, drink, flee, and move are `urgeScores` with `urgeWeights`. Mating is the fifth urge float and is not a feeling. The three slices are copied to perception offsets 64, 96, and 128. Nothing is drawn.

## What was built

- `src/core/threeBlocks.ts`. `threeBlocks` calls `urgeWeights` and `urgeScores`. `feelingsOf` writes the emotion block. `frameWithBlocks` copies physiology to byte 64, emotions to byte 96, and urges to byte 128. No `Mind` struct and no `Instincts` struct.
- Fear is the sensed cue. Curiosity is a feeling argument and stays 0 when omitted (calibration: no curiosity rate on the species row). Emotion stress stays 0 and is not the body's temperature stress. Mating, migration, territorial, and social stay 0 (calibration: step 10 has no weight for them). The rest score still decides `strongestUrge` and is not packed into mating.
- `tests/three-blocks.test.ts`. Skill `notes/skills/three-blocks.md`. One line each in `notes/skills/body-feelings.md` and `notes/skills/strongest-urge.md`. Roadmap step 19 now says `Board: T-0105`.
- No edit to `perceptionBuffer.ts`, `agent.ts`, `bodyFeelings.ts`, `main.ts`, the senses panel, or the wasm binary.

## Number table

The hare and wolf rows are the weights. The test asserts the scores equal `urgeScores(urgeWeights(row))`. No new coefficient.

| Value | Game number | Real figure and source | Match |
| --- | --- | --- | --- |
| Body hunger | 20 when energy is 80 | Unfilled share of the needs reserve. `createNeeds` starts at 100. T-0102 calibration, not a second pool | yes. Carried from `physiologyOf` |
| Body thirst | 40 when water is 60 | Same percent scale | yes |
| Hare feed weight | 0.5 | `HARE_AGENT.utility.feedHere`. T-0009, Matthew's spec, pinned by `tests/agent.test.ts` | yes. `urgeWeights`, not a copy of the digit |
| Hare drink weight | 0.4 | `utility.approach`. The hare row has no `investigate` | yes |
| Flee weight | 1 | Multiplicative identity. `perceive` already multiplied the cue by `species.fear` | yes. Not a second weight |
| Hare rest weight and floor | 1 and 0.05 | `utility.rest` and `utility.restBase` | yes |
| Hare move weight | 0.7 | `utility.seek` | yes |
| Hare scores, hunger severity 1, food 1, fear 0.75 | feed 0.5, drink 0, flee 0.75, rest 0.05, move 0. Winner flee | severity × weight × opportunity | yes. Same return as `urgeScores` |
| Wolf feed and drink | feed 0.8, drink 0.5 | Wolf `feedHere` 0.8 and `investigate` 0.5 | yes. The hare feed score is 0.5, so the row was read |
| Tired hare | rest 1.05, winner rest | `fatigue × rest + restBase` | yes. 1.05 is not one of the eight packed urge floats |
| Fear | 0.75 | The sensed cue. Flee's weight is 1, so the safety drive equals the feeling | yes |
| Curiosity | 0.25 when passed, 0 when omitted | No curiosity rate on the species row | calibration |
| Emotion stress | 0 while body temperature stress is `heatFactor(WOLF_NEEDS, 30) - 1` (the row's 0.04 per degree above 20 °C) | Conflict 11. The body keeps that stress | yes. Not copied into the emotion block |
| Mating | 0, at urge byte 144 | No mating weight in step 10. #101's cutoff ladder lost | calibration. Not an emotion field |
| Migration, territorial, social | 0 | No step 10 weight | calibration |

## Frames

Frame gate: N/A. Nothing is drawn. The player meter, the senses panel, and the world picture are unchanged. No recording and no in-game screenshot.

Numeric check, in place of the frame: `tests/three-blocks.test.ts` asserts `readPerception` sees hunger at byte 64, fear at byte 96, curiosity at byte 108, the feed pull at byte 128, and mating at byte 144. The 32 emotion bytes do not contain the body hunger float 20 or the body thirst float 40.

## How to verify

- `npx tsx --test tests/three-blocks.test.ts` — 2 passed.
- `npx tsc --noEmit` — exit 0.
- `npm test` — 893 tests, 879 pass, 0 fail, 14 todo. The 14 todos are the legacy rule breaks. T-0105 adds none.
- `npx tsx tools/tasks.ts` shows T-0105 proposed, 40 cr. It is not claimed.

## Evidence a reviewer can spot-check

1. Three offsets. `PERCEPTION.physiologyOffset` is 64, `emotionOffset` is 96, `urgeOffset` is 128. `frameWithBlocks` copies to those three. `readPerception` agrees. Hunger is the first body float. Fear is the first emotion float. Mating is the fifth urge float.
2. Hunger is not an emotion. With energy 80, body hunger is 20. The eight emotion floats do not include 20, and the emotion object has no `hunger` key. Thirst 40 is also absent from that block. Emotion stress stays 0 when the body temperature stress is not 0.
3. The weights are step 10. Hare and wolf scores deep-equal `urgeScores(urgeWeights(that row))`. `src/core/threeBlocks.ts` contains `urgeWeights` and `urgeScores` and does not contain `choose_action`, `interface Mind`, `Instincts`, `feedHere`, or the cutoffs 90, 80, 25, or 85. `matingDrive` is assigned `0` only.

## Needs from another agent

Grokbot-1: approve-plan, then review the pull request. grokbot-3 will not approve it and will not merge it.
