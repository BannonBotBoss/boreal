# Handoff: T-0009 shared agent core, hare + sunlit clover (grok, 2026-10-21 11:20 PT)
Owner agent: grok. Branch `grok/rabbit-clover`, worktree `C:\dev\boreal-grok-rabbit`, off main 6226a02.
Preview: http://127.0.0.1:5204/?trees=v2&hour=12&at=-91.9,28.4,0 (add `&hare=debug` for hare state and patch biomass).

**Status: NOT submitted as complete.** The number table passes (one flagged exception), but the animation gate (RULES 6)
fails, and three acceptance criteria are not met (below). Left open, claimed by grok.

## Run 2 progress (keep current: board rule 9)
Plan (Matthew via Grok, 11:13 PT): 1 reference, 2 bound gait, 3 graze/alert poses + visible thinning, 4 registry + lazy
regrowth + state fields/rewind, 5 re-record and re-score; submit only if every question >= 95 %.
- [x] 1 Reference: 4 attempts logged in refs/hare/graze-alert-flight/attempts.md (3 stills, 1 5 s video). Accepted attempt 2
  (poses) + attempt 4 video (timing), ~85 % like nature (ears still a little long).
- [x] 2 Gait: shared gait code (src/animals/locomotion/gaits.ts GAIT_TABLE has a 'bound' row marked [verify]; core/gaitData.ts)
  is canid-only and drives the skeleton rig, which the hare is not on. Built instead: src/core/agent/bound.ts (pure half-bound:
  footfall phases, duty, Heglund & Taylor 1988 cadence allometry for 1.5 kg, ballistic airborne lift) + HARE_AGENT.gait data,
  and four procedural legs (big hind feet), ears and a hip-pivot body in the hare model (HARE_BODY from ADW measurements).
  Shared pose code: poseHare() in src/animals/hare.ts, used by the game and tools/hare-strip.ts (side-on lab recording that
  runs the real pipeline at the reference's 6 fps).
- [~] 3 Poses done (hunched graze with ears back, half sit-up scan, full sit-up alert, tucked rest); clover thinning next.
- [ ] 4 core/transactions.ts registry (hare|clover graze, sun|clover regrow) run from CONTACTS; lazy regrowth from sun-seconds;
  STATE_FIELDS hareAgent + clover; save + rewind
- [ ] 5 Re-record and re-score
Exact next step: step 3 clover thinning (render/clover.ts: clump height x leaf share, grass cover suppressed on patches), then step 4.

## Needs from another agent
- Gait Builder (grok-gait): a lagomorph rig on the shared locomotion controller so the hare's legs are real limbs, not
  rotating blobs. Exact needs: (a) skeleton for Lepus americanus from HARE_BODY (hip .13 m, fore leg .12, hind leg .125 +
  hind foot .132 m plantigrade-at-rest, digitigrade in the bound); (b) GAIT_TABLE rows 'half-bound' and 'gallop-lagomorph'
  using HARE_AGENT.gait (touchdown [LF .00, RF .08, LH .42, RH .45], duty .50 -> .17, cadence 3.94 Hz @ 1.68 m/s -> 4.40 Hz @
  11.6 m/s) replacing the [verify] 'bound' row; (c) stance feet planted (no slide: today the stance sweep needs ~.34 m at
  8.5 m/s, more than the blob legs can reach, so feet slide); (d) spine flexion between the gathered and extended
  suspensions (Bramble 1989 four-stage jackrabbit gallop); (e) accept a pose request (sit-up, graze crouch) from the
  pipeline's poseOf. Until then the host's procedural legs stand in.
- Art/model owner (any agent): a hare mesh with fur shading at ~45 cm; the low-poly blob body caps resemblance to the photo
  reference well under 95 % even with correct timing and poses.

## What was built
- Shared animal pipeline `src/core/agent/pipeline.ts` (senses: sight/hearing/scent -> energy, stamina, relaxation -> goal ->
  action; feed contact on the CONTACTS bus; no Math.random, every state change names its cause) and species records
  `src/core/agent/species.ts` (HARE_AGENT). `src/animals/hare.ts` is now only the host (spawn, model, poses, debug labels).
- Clover in sunlit clearings `src/core/clover.ts` + `src/render/clover.ts`; clearings thin trees (population, far trees, site).
- Nature-checked numbers (this commit): clover units = 15 mg DM of leaf (10 000/m^2 = 150 g/m^2), ungrazable stolon residual,
  regrowth 6 g/m^2/day from the stolons scaled by daylight, site light and temperature (climate normals), 25 days bare ->
  full; hare intake 167 g DM/day, cropping 20.5 mg/s, energy 100 = a day's food. Table and sources: notes/grok.md
  "Clover and hare numbers, nature-checked".
- tools/rabbit-record.mjs: headless Edge recording, ~10 fps JPEG frames + per-frame hare/patch/wolf state.

## Nature table (summary; full table with sources in notes/grok.md)
| value | game | real | resembles? |
| --- | --- | --- | --- |
| patch leaf biomass | 150 g DM/m^2 | 160 g/m^2 Kopu spring stand | yes |
| residual stolon | 50 g/m^2, uneaten | 50-55 g/m^2 above ground | yes |
| regrowth | 6 g/m^2/day, 25 d to full | 50-70 kg/ha/d summer; 21-28 d recovery | yes (Matthew's 15 min failed, replaced) |
| night / shade / cold | 0 / x light / 0 below 5 C | photosynthesis; shade-intolerant; base < 4-10 C | yes |
| hare intake | 167 g DM/day | 167 +- 47 g/day summer | yes |
| cropping rate | 4.1 units per 3 s (20.5 mg/s) | 167 g / (8.7 h x 26 %) | yes (Matthew's 100 per 3 s failed, replaced) |
| units per energy | 111 | from intake | yes (Matthew's 100 within 10 %) |
| energy drain | 100 / real day | a day's food per day | yes (Matthew's 1/8 s failed, replaced) |
| flight cost | x8 | aerobic max ~10x resting, sprint partly anaerobic | flagged: plausible, unsourced for hares, tiny effect |
| graze 3 s / scan 1 s | kept | cropping 26 % of active time | plausible, not checked |

Emergent: one hare grazes a 1 m patch out in 6.5 h of nonstop cropping (3.2 days at a real hare's cropping budget); a
grazed-out patch recovers in 25 summer days. In a 10 min session one hare takes ~2.6 % of a patch: not visible.

## Animation gate (RULES 6): recording `Boreal inbox\rabbit\recording-T-0009\` (frames/f000-f108.jpg, rabbit-record.json, contact-sheet.jpg, hare-reference-sequence.jpg)
Recording: 109 frames over 10.9 s, ?hare=debug, noon, wolf 7.6 m from the patch. STAGED: the patch was set to 45 % first
(at real rates a hare cannot visibly thin it in 10 s), and one hare was placed on it. W held 5.0-7.5 s.
1. **What do I see?** f000-f031: a small brown low-poly hare, head down, body stretched, on a clover patch (blue-flowered
   clumps), standing still while its label counts clover down (12 382 -> 12 378 units); a second hare to the right also
   grazes. f032-f045: head up for 1.4 s ("lifting head between bites"), then head down again. f051 (5.1 s, wolf starts
   moving, 7 m): head up, "alert: seen wolf"; 0.17 s later flight. f052-f085: it bounds away from the wolf, 22.8 m in 2.8 s
   (~8.1 m/s), body rising and falling in a hop arc, legs not visibly cycling; it shrinks to a few pixels. f086-f091: stops
   0.6 s ("pausing to check behind"), then sits scanning ("still uneasy") to the end. The patch's clumps look the same as at
   100 % at this distance; the thinning is visible only in the label.
2. **Does that look natural as described, how do I know?** Compared with a generated reference using the same description
   (below) and with what is known of snowshoe hares: summer coat brown (correct), crepuscular grazers that lift the head
   between bites, flee in bounds then stop and look back (Maine IFW 2001 assessment; Belovsky 1984). Sequence and timing are
   natural; the body is not.
3. **Reference:** generated, `hare-reference-sequence.jpg` (6 panels: graze, graze-step, alert, push-off, mid-bound, stopped
   looking back). **Does it show nature?** Mostly: real-looking hare, posture and gait phases plausible. Faults: ears long
   like a European hare/jackrabbit (snowshoe ears are shorter), hind feet not white, the last panel is not 20 m away.
   Score ~75 %. Not re-prompted yet (the next step per T-0020).
4. **Does the game resemble it to 95 % in timing and position?** No.
   - sequence order graze -> scan -> alert -> flight -> pause -> scan: ~90 %
   - timing (graze ~3 s, head up ~1.4 s, alert->flight 0.17 s, flight 2.8-3.3 s at ~8 m/s, pause 0.6 s): ~70 % (speed
     within the snowshoe range, up to ~13 m/s; no source for exact bout lengths)
   - grazing pose (head down, crouched, ears back): ~45 % (low-poly blob, no ear or jaw detail at this distance)
   - alert pose (sit up, ears up): ~50 %
   - flight gait (push-off, extended suspension, hind feet landing ahead): ~20 % (a vertical hop arc, no limb cycle)
   - clover thinning visible on screen: ~10 % (staged 45 % patch reads like a full one)
   Overall well below 95 %: **FAIL**.

## Acceptance criteria not met (T-0009 file)
- Transactions as data rows keyed kindA|kindB in a registry: graze and regrow are functions in core/clover, not registry rows.
- Clover units as a closed form of sun hours since the last grazed delta: regrowth is still per frame, and tiles reset to full
  when unloaded (beyond 2x the clover radius); nothing is saved.
- Hare levels tagged in stateFields; snapshot/rewind restores positions only.
Met: no Math.random or fixed behaviour timers in the hare path, causes named, debug readout, npm test passes.

## How to verify
`npx tsc --noEmit`; `npm test` (363 tests: 351 pass, 0 fail, 12 todo on this commit); `npx tsx --test tests/rabbit-clover.test.ts`
(14 pass: sourced rates, residual, recovery, depletion); open the preview with `&hare=debug`; `node tools/rabbit-record.mjs
http://127.0.0.1:5204 <outDir>` (kills its headless Edge).

## Leftovers / next steps
- Gate: a hare rig with a real bound gait (limb cycle) and readable graze/alert poses; render clover thinning (fewer or
  shorter leaves, bare stolon visible) so a 45 % patch looks grazed; re-prompt the reference (snowshoe ears, white feet).
- Registry rows, closed-form regrowth with persisted grazed deltas (with T-0015), stateFields tags.
- Drought (soil moisture from core/weather) and frost-kill of leaves are not modelled.

## For the next owners
- T-0010 wolf autonomous core / T-0011 deer core: add a record to core/agent/species.ts; diet rows use units of 15 mg DM of
  clover leaf (deer would need their own forage kinds; deer intake ~1.5-2.5 kg DM/day [verify]). Keep metabolism in world
  seconds (drain = 100 / 86 400 if energy 100 = a day's food). Depletion of clover emerges once several grazers share it.
- T-0015 forage regrowth field: regrowthRate(p, daylight, tC, day) is the instantaneous rate; integrate it in closed form
  over world seconds (daylight curve from lighting(sunPosition), temperature from climate) and keep stolon as the residual.
- Skill: notes/skills/agent-pipeline-species.md.
