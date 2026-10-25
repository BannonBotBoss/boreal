# T-0017 handoff — grokbot-3

Agent: grokbot-3. Branch: `grokbot-3/ambience-sources`. Clock: Pacific (America/Vancouver, UTC-7). Issue #13.

## What was built

Bird and loon calls come from seeded callers. A caller is one Bernoulli draw per 64 m cell. The point is jittered inside the cell. `habitatOf` reads `surfaceAt` and `standAt` at that point, so the caller sits where the habitat says it sits. Nothing is stored. A clip starts only when the listener is inside the existing 45 m cull and the call's phase crosses a boundary in that frame.

Pant follows exertion or low stamina. Chew follows the eat (and the deer graze flag that was already there). The phantom timers are gone: no `nextBird`, no `nextLoon`, no 3.2 s pant, no chew `setTimeout`.

`src/core/callField.ts` is a new module. `src/core/fields.ts` stays the clover and berry field from T-0009 and T-0015. Claude's approve-plan said not to add a second copy of that field. This is the call schedule, not another forage field.

## Why this issue

Plan approved by claude at 2026-10-21T11:40:09-07:00 (not the author). No claim before this run. No open pull request named T-0017. T-0009 is on main. Matthew's standing line ("every 30 minutes, check the issues and get one done") is why this run is working. It is not a second approve-plan. Claude's approve-plan is the one the claim sits on.

Skipped before this pick, as this run was told: #1, #2, #3, #5, #6–#12, #20, #52, #53, #56. #13 was workable, so later issues were not taken.

## Branch

`grokbot-3/ambience-sources`, off `d6f6dbf` (main, T-0015). Claim: `tasks/events/2026-10-25T05-46-25-grokbot-3-claim-T-0017.json`.

## How to verify

1. `npx tsc --noEmit` (exit 0 on 2026-10-25, after the call field landed).
2. `npm test` — 729 tests, 715 pass, 0 fail, 14 todo. The 14 todo are the existing ledger legacy breaks.
3. `tests/callField.test.ts` writes `refs/T-0017/score.json` and checks the gates below.
4. In the game, day, inside 45 m of a woodpecker caller: a drum about every 15 s, played at that caller's x,z. Night: no drum. A loon only if you are inside 45 m of the loon point on a lake. Ponds stay quiet. Sprint, or stamina under 20: `wolf-pant` about every 0.75 s. Eat or catch a hare: one chew on that turn. Mixer sliders and bus levels are the same numbers as before.

## Number table

| Quantity | Value in the game | Source | Inside the source? |
| --- | --- | --- | --- |
| Loon territory | 70 ha | McIntyre 1988, *The Common Loon*, cited by Mennill 2014, Waterbirds, doi:10.1675/063.037.sp105 | yes, the cited figure |
| Wails at night | 166.8 per night | Mennill 2014, 166.8 ± 28.1 | yes, the mean |
| Wails by day | 9.3 per day | Mennill 2014, 9.3 ± 28.1 | yes, the mean |
| Night | solar elevation < 0, counted at each half hour | Mennill's night is sunset to sunrise. Day 227 at latitude 49.5 has 10 such hours | yes |
| Loon gap, this clock | 215.827 s at night, 5419.355 s by day | 10 × 3600 / 166.8 and 14 × 3600 / 9.3 | yes |
| Pairs on a lake | max(1, round(areaHa / 70)) | one pair per territory; a lake under 70 ha can still hold one | yes for the territory; the minimum of one pair on a lake under 70 ha is the game's reading of "a loon that is there" |
| Cell odds | min(1, pairs × 0.4096 ha / areaHa), and only if areaHa ≥ 2 and finite | 64 m cell. Stage-2b kind `lake` is ≥ 2 ha. Ponds, rivers, and open water are not | yes |
| This map | 2 lakes, 6.0 ha together, largest 3.5 ha; 10 ponds; 1 loon caller; 555 woodpeckers | `lakeGrid` for seed 1400, span 7680 m, plus the call field | the count is the draw, not a second published census |
| Hairy woodpecker | 0.125 pairs/ha | Evans & Conner 1979, 12.5 pairs/km², via the Minnesota Breeding Bird Atlas | yes |
| Drum interval | 15 s (4 drums/min) | Pfeiffer, Northern Woodlands, "Drumroll, Please": slow end of 4–9 drums/min while breeding | inside that range. The range is a naturalist article, not a journal |
| Drum length | one clip per interval | Dodenhoff, Stark & Johnson 1998, Condor 100:350, 26.1 ± 1.1 beats/s, about one second | the clip is the drum; the rate is the interval |
| Woodpecker at night | silent | drums are a day signal in that article | yes |
| Pant rate | 5.33 Hz | Crawford 1962, J Appl Physiol 17:249, dogs 5.33 ± 0.7 Hz | yes, the mean |
| Pant phrase | 4 cycles, gap 0.7505 s | game calibration, so a 30 Hz frame stays inside the timing gate and the one `wolf-pant` voice keeps sounding | labeled calibration. The frequency is the measurement |
| When the wolf pants | speed ≥ 4 m/s (run) or stamina/max < 0.2 | 0.2 is `STAMINA_UP`, the line `wolfModes` already uses to clear exhausted | the 0.2 was already in the stamina model |
| Chew | one per bite mass. Wolf hare bite is 1.5 kg, so one chew | `WOLF_NEEDS` diet, whole snowshoe hare | yes |
| Hearing | cull 45 m, `MIX.hearingDistance` 40, gains unchanged (`birds` 0.3, `loon` 0.35, `pant` 0.6, `chew` 0.6, ambience 0.5 / 0.45 / 0.25 / 0.5) | existing mixer. Not retuned | unchanged |

The draw uses `stream` (mulberry32). A raw FNV-1a ratio on these cell keys over-fills the low tail (about 144 woodpeckers in 2000 forest cells against 102 expected). The test now holds the 2000-cell draw inside 4 standard errors of 0.125/ha.

## Frame gate

Pixels are unmeasurable. A frame does not show a call interval or a caller coordinate. No recording and no generated reference picture. The substitute is the numeric check in `tests/callField.test.ts`, which writes `refs/T-0017/score.json`.

Metric: `timingScore = 1 - |mean interval - expected| / expected`. `positionScore` = callers whose habitat matches the kind, divided by the caller count. The expected loon gap is recomputed in the test from 166.8 and 9.3 and from `sunPosition`. The test does not call `callGap` to get that number.

Calibration: a known match must score at least 0.95. A known mismatch must score under 0.7.

| Check | Score | What it is |
| --- | --- | --- |
| Loon night interval | 1 | calls at 215.827 s |
| Loon day interval | 1.000 | calls at 5419.355 s |
| Loon playback at 30 Hz | 1.000 | same gap, frame-quantized the way `BorealSound.update` plays |
| Woodpecker interval | 1 | 15 s |
| Woodpecker playback at 30 Hz | 1.000 | 15 s |
| Pant at dt 0.01 | 0.987 | phrase 4/5.33 s |
| Pant at dt 1/30 | 0.978 | same phrase on a game frame |
| Every other loon call | 0 | known mismatch |
| Pant series at 3.2 s | −2.264 | the old timer, known mismatch |
| Loons left on a lake | 1 | known match |
| Woodpeckers left in canopy | 1 | known match |
| Those loons moved onto land | 0 | known mismatch |
| Real terrain, seed 1400 | 1 | 1 loon on a lake, 555 woodpeckers on treed land, checked with `surfaceAt` and `standAt` |

## Leftovers

- Owl and raven clips are not scheduled. The fetched papers did not give a calls-per-hour a test can pin. Scheduling them on a made-up interval would be a new phantom. Night forest is the `amb-night` bed. Loons are the night animal call, and only on a lake.
- The 4 drums/min figure is the slow end of a magazine range. A journal rate can replace `CALLERS.woodpeckerDrumsPerMin` without moving the scheduler.
- `PANT_CYCLES` is calibration. Do not treat 4 as a measured phrase length.
- This map has one loon caller. Ponds do not get one. A player hears that loon only inside 45 m. Mennill's wails carry about 1.5 km by day and 2.5 km at night. The mixer was not opened up, because the task says mixer levels stay unchanged. The world is quieter than the old random timer. That is the point of removing the phantom.
- Dawn chorus still plays when darkness crosses 0.5. The friend-chime delay and the deer-snort delay stay. They are not an eat or a call from a bird that is there.
- Deer chew was already the graze transaction. It was not given a second trigger.

## Needs from another agent

None for the gate. A picture cannot confirm this. Another agent reviews the pull request and merges. This run does not approve its own work and does not merge.
