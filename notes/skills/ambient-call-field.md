# Skill: ambient call field

Use this when a bird or loon call, a pant, or a chew should come from an animal that is there or from a level that changed (T-0017).

## Steps

1. Do not add the callers to `src/core/fields.ts`. That module is clover and berries. Do not add them to `stateFields.ts`. That module is time tags. Callers live in `src/core/callField.ts`.
2. Do not name a file under `src/` with bird, owl, wolf, hare, deer, or the other words in the species-file rule. `callField.ts` is the name that stays legal.
3. Place one Bernoulli draw per 64 m cell. The draw is `stream` (mulberry32), not a raw FNV ratio: FNV-1a on these cell keys over-fills the low tail and places too many callers. The point is jittered inside the cell, then `habitatOf` reads `surfaceAt` and `standAt` at that point. A loon is only on a stage-2b body of kind `lake` (this game's lakes are at least 2 ha). A woodpecker is only on land with canopy above 0. Ponds, rivers, and open water (`areaHa` not finite) get neither.
4. Schedule with `callTimes`. The phase is `hash` of the caller id. Do not store a `nextBird` or `nextLoon` timer, and do not call `Math.random`. A clip starts only when the listener is inside `CULL_DISTANCE` (45 m) and the phase crosses a boundary in that frame. `RENDER.birdRate` divides the gap. Zero means no calls.
5. Do not change `MIX` gains, bus levels, or `CULL_DISTANCE`. The panner still dies at `MIX.hearingDistance` (40 m). A real loon is audible for kilometres. This game is not. Say so in the handoff.
6. Do not invent an owl or raven interval. The clips stay in the mixer. They do not play until a published calls-per-hour exists. Night forest is the `amb-night` bed. Dawn chorus still fires when darkness crosses 0.5. The friend-chime delay and the deer-snort delay are not this task.
7. Pant when speed is at least `modeSpeed.run` (4 m/s) or stamina / max is under `STAMINA_UP` (0.2, the same line that clears `exhausted`). The gap is `PANT_CYCLES / PANT_HZ`. 5.33 Hz is Crawford 1962. Four cycles is game calibration so a 30 Hz frame stays inside the timing gate and the one `wolf-pant` voice keeps sounding. Do not bring back 3.2 s.
8. Chew with `mealChews(biteKg, eatenKg)` at the eat, in the same turn as the transaction. One wolf hare bite is the whole hare (1.5 kg), so one chew. Deer already set `chew` from `socialGraze` when a bite crosses `biteG`. Do not add a second deer chew, and do not `setTimeout` a chew.
9. The night voice line `night-1` ("The loons are loud tonight.") plays only when `loonNear` finds a loon caller inside the cull. Otherwise the night line is `night-2`.
10. Regenerate `docs/system-map.md` after editing `SYSTEM_MAP` (`npm run system-map`). The audio system lists `src/core/callField.ts` and the `CALLERS` table.
11. Score before trusting the schedule. `timingScore` is `1 - |mean interval - expected| / expected`. `positionScore` is the fraction of callers whose habitat matches the kind. A known match (the published gap, a loon left on the lake) must be at least 0.95. A known mismatch (every other call, or those loons moved onto land) must be under 0.7. Recompute the loon gap from 166.8 and 9.3 and from `sunPosition`. Do not call `callGap` to get the expected number. A picture of the forest does not show a call interval. Write the scores to `refs/T-0017/score.json` and say that pixels are unmeasurable.

## Files

- `src/core/callField.ts` — habitat, callers, gaps, pant, chew count.
- `src/audio/borealSound.ts` — plays a caller inside the cull, pants from the level, chews from `chewAt`.
- `src/audio/wolfVoice.ts` — `night-1` only with a loon inside hearing.
- `src/main.ts` — passes hour, day, stamina, and chews on the eat and on the catch.
- `src/core/wolfModes.ts` — `STAMINA_UP`.

## Numbers

Loon territory 70 ha (McIntyre 1988, cited by Mennill 2014, Waterbirds, doi:10.1675/063.037.sp105). Wails 166.8 ± 28.1 per night and 9.3 ± 28.1 per day (Mennill 2014). Night is sunset to sunrise: solar elevation < 0. The gap is local night-hours × 3600 / 166.8, or day-hours × 3600 / 9.3. Pairs on a lake are `max(1, round(areaHa / 70))`. The cell probability is `min(1, pairs * cellHa / areaHa)`.

Hairy woodpecker 12.5 pairs/km² (Evans & Conner 1979, via the Minnesota Breeding Bird Atlas). Drums at the slow end of 4–9 per minute while breeding (Pfeiffer, Northern Woodlands, "Drumroll, Please"), so 15 s. That 4–9 range is a naturalist article, not a journal. The drum itself is about one second (Dodenhoff, Stark & Johnson 1998, Condor 100:350, 26.1 ± 1.1 beats/s). The clip is one drum. Night drums are silent.

## Metric

`tests/callField.test.ts` writes `refs/T-0017/score.json`. Known match: published intervals and callers left where they were placed. Known mismatch: a 3.2 s pant series, every other loon call, and loons moved onto land.
