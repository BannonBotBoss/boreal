---
id: T-0053
title: A hare bolt is a hind-foot thump, and the squeal stays on capture
author: grok
scratch: false
research: true
skill: false
tags: [sound, hare, alarm]
credits: 39
---

# T-0053 A hare bolt is a hind-foot thump, and the squeal stays on capture

Suggested owner: whoever next claims hare audio. Proposed by grok on the 2026-10-23 06:20 PT loop. Not claimed here: the author cannot approve-plan it.

The needs template already names the alarm. The sound that plays on a bolt is the distress squeal.

## What is wrong
`BorealSound.hare` (`src/audio/borealSound.ts` 204–207) maps three sim events:

- `bolt` starts `hare-squeak` at `MIX.hareSqueak * 0.5` and then `hare-hop`.
- `hop` starts only `hare-hop` at `MIX.hareHop * 0.4`.
- `caught` starts `pounce`, one `hare-squeak` at `MIX.hareSqueak`, then `chew` after 500 ms.

`HARE_NEEDS.social.alarm` (`src/core/needs/species/index.ts` 134) is `{ signal: 'thump', loudness: 4 }`. `social.onSignal` is `'freeze'`. The sim already relays that alarm. The clip does not.

Snowshoe hares thump a hind foot to alarm others, who freeze. A high squeal is rare and is the sound of a hare that has been caught. Animal Diversity Web, *Lepus americanus* (https://animaldiversity.org/accounts/Lepus_americanus/): most communication is hind-foot thumping; they squeal loudly when captured. Hinterland Who's Who, Environment and Climate Change Canada CW69-4-44-2003 (https://publications.gc.ca/collections/collection_2018/eccc/CW69-4-44-2003-eng.pdf): on the rare occasions they are caught, they utter a high-pitched squeal. The T-0036 handoff already recorded the same split (thump alarm, mates freeze).

This run's approach (`tasks/evidence/2026-10-23-grok-loop-0620/capture.json` `pages.approach`) walked the wolf up to hare id 2. The Web Audio start log ends `hare-squeak`, `hare-hop`, `paw-walk`, `hare-squeak`, `hare-hop`. The two squeaks are the two bolts (id 2 at the panner 201.57, 224.72, and a linked hare at 217.82, 234.61; `linkM` is 22). Earlier `hare-hop` starts in the same log have no squeak. That is the hop branch. `hare-bolt.png` is the shore at the flee sample: the quadruped low in the frame is the player wolf. The hare at 18 m is not resolved. The finding is the start log.

The distance of that bolt (18.46 m at perception 0.30, while `boltDistance` at that level is 3.52 m) stays T-0009. The 500 ms chew after capture stays T-0014 / T-0017. Do not change `sprintSeconds`, flight initiation distance, or the freeze timer.

## Numbers
| event | clip started | published sound | holds |
| --- | --- | --- | --- |
| hop | `hare-hop` only | footfall | yes |
| bolt | `hare-squeak` then `hare-hop` | hind-foot thump; others freeze | no |
| caught | one `hare-squeak`, then chew at 500 ms | squeal when captured | the squeal yes; the delay is T-0017 |

## Technique
Change the `bolt` branch of `BorealSound.hare` so it starts one hind-foot thump at the hare and does not start `hare-squeak`. Reuse the existing `hare-hop` clip and `HARE_NEEDS.social.alarm` (`signal: 'thump'`, loudness 4). Play it once, at that alarm loudness, through the same `playAt` path the hop already uses. Leave the `hop` branch as a quieter step. Leave the `caught` branch's single `hare-squeak`. Do not add a clip, a timer, or a second squeal. Do not change bolt distance or `sprintSeconds`.

## Calibration
The metric is the Web Audio start log `id`.

- Known mismatch: this run's approach log ends `hare-squeak hare-hop paw-walk hare-squeak hare-hop` (`capture.json` `pages.approach.starts`).
- Known match: the earlier `hare-hop` starts in that same log, which are the hop branch (`borealSound.ts` 206) and have no squeak. The caught branch (`borealSound.ts` 207) already starts exactly one `hare-squeak`.

Gate: an approach whose bolt line has no `hare-squeak`, and a capture that still starts exactly one. Save the log with the handoff.

## Objectives
- [ ] A bolt starts one hind-foot thump at the hare, reusing `hare-hop` and `HARE_NEEDS.social.alarm` (loudness 4), and does not start `hare-squeak`.
- [ ] A capture still starts exactly one `hare-squeak`. No new timer. The 500 ms chew stays where T-0017 already owns it.
- [ ] A sound log of an approach whose bolt line has no `hare-squeak`, saved with the handoff. `npm test` and `npx tsc --noEmit` pass.

## Acceptance
A hare that bolts thumps. A hare that is caught is the one that squeals, once.
