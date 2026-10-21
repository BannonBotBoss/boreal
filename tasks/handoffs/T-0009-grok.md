# Handoff: T-0009 shared agent core, hare + sunlit clover (grok, 2026-10-21 11:20 PT)
Owner agent: grok. Branch `grok/rabbit-clover`, worktree `C:\dev\boreal-grok-rabbit`, off main 6226a02.
Preview: http://127.0.0.1:5204/?trees=v2&hour=12&at=-91.9,28.4,0 (add `&hare=debug` for hare state and patch biomass).

**Status: NOT submitted as complete.** The number table passes (one flagged exception), but the animation gate (RULES 6)
fails, and three acceptance criteria are not met (below). Left open, claimed by grok.

## Run 3 progress (started 2026-10-21 12:25 PT; keep current: board rule 9)
Plan (Grok lead, 12:23 PT): pick up Gait Builder's rig (grok-gait/T-0009-hare-skeleton b821bb8).
- [x] 1 Rule 15 review (12:29 PT): three claims hold (bound.ts imported; hind leg 1.6x short; duty/cadence flags) - tasks/events/2026-10-21T12-29-grok-comment-T-0009.json
- [x] 2 Merged grok-gait/T-0009-hare-skeleton (f63130b); tests/bound.test.ts 12/12
- [x] 3 Nature-checked from published sources (7a4be8f). Old -> new, with sources (snowshoe hare Lepus americanus unless noted):
  | value | before | now | source |
  |---|---|---|---|
  | hind leg (femur+tibia) | .125 m | .202 m (femur .094, tibia .108; share .47) | femur 94 mm Illinois State Museum; tibia/femur 1.13-1.19 (Volf 2023 L. europaeus; Williams 2007 J Anat pelvic limb) |
  | hind foot | .132 m | .132 m (kept) | hind foot 117-147 mm (ADW / Maine IFW) |
  | fore leg (humerus+radius+manus) | .12 m | .181 m (humerus .077, radius .069, manus share .19) | Williams 2007 thoracic limb ratios; manus [estimate] |
  | gaits used | 'bound' [verify] | half-bound (slow/escape), gallop-lagomorph (fast) | Hildebrand 1977 Lepus: half-bound, transverse + rotary gallop; Bertram & Gutmann 2009 (stiff-backed slow half-bound, flexed-back when escaping) |
  | hind duty vs speed | .50 -> .17 (one duty for all legs) | hind .60 (slow) -> .20 (very fast); fore = .9 -> .7 x hind | Hildebrand 1977 (contact ~60 % slow to ~20 % very fast; fore <= 70 % of hind at speed); jackrabbit 16-18 % |
  | stride frequency | 3.94 -> 4.42 Hz power law | piecewise 3.94 @ 1.68, 4.17 @ 2.91, 4.40 @ 3.98, held 4.40 to 11.6 m/s | Heglund & Taylor 1988 (1.5 kg); plateau above 3.98 m/s [estimate]. NOTE the 12:29 review event said 4.42 Hz: wrong, 4.40 |
  | row switch speed | up 7 / down 6.5 m/s | up 10 / down 9.5 m/s (half-bound at flight speed 8.5) | Bertram & Gutmann 2009 escape half-bound; switch value [estimate] |
  | alert hold | .3 s | 1 s (freeze, then flee) unless the threat is inside the flight distance | snowshoe FID mean 3.7 m, freeze-then-flee (Emmel 2024, U Montana thesis); 1 s [estimate from the reference video] |
  | flight acceleration | instant 8.5 m/s | ramp 10 m/s^2 | [estimate, unsourced for hares; cheetah ~13 m/s^2, Wilson 2013] |
  | joint ranges | canid FLEX_LIMIT in ik.ts | unchanged, FLAGGED | no published hare locomotion angles (Williams 2007 says so); rabbit ankle 66-137 deg, foot 17-123 deg (PeerJ 2022, 10.7717/peerj.13611) not yet applied |
  | body pitch | 0 vault pitch | unchanged, FLAGGED | no source found; Gait Builder open item |
- [x] 4 GAIT_TABLE 'bound' row replaced by 'half-bound' {0,.58,.92,.55; duty .3} and 'gallop-lagomorph' {0,.5,.92,.58; duty .2};
  both added to GaitId (done by grok, not handed to Codex); lab, borealSound, locomotion tests updated.
- [x] 5 hare.ts runs on createBounding + poseRequestFor (blob legs retired: three segment meshes per leg from limbPoints, body
  pitch from the rig tilt, head/ears from POSES); alert hold 1 s measured from the first alert (re-alerts while watching keep
  counting); flight speed ramps at 10 m/s^2. bound-checks score on HARE_BODY: 85.7 % (was 80.0 %; gate 95 %: FAIL; the
  sourced duty needs a .63 m hind sweep at 8.5 m/s vs a .31 m hind chord, so contact fraction is short at speed).
- [x] 6 In-game smoke test (12:43-12:46 PT, full page loads on :5204, no runtime errors): `node tools/rabbit-record.mjs
  http://127.0.0.1:5204 C:\dev\rabbit-rec4 plain` (new 'plain' mode: no ?hare=debug labels; new STAGED clover time-lapse
  lapse-100..lapse-0.jpg, the same patch set to 100/80/60/40/20/0 % leaf). 43 frames: feed 0-5 s, step, alert 5.32 s,
  flee 6.33 s (1.0 s hold), 9.9 m in 1.7 s, pause 10.2 s, scan. The in-game camera is the wolf's, so side-on was recorded in
  the lab with the same code: tools/hare-strip.html?track=2.2&fov=20&wolfX=-7&wolfAt=2.2 -> C:\dev\rabbit-rec4\strip-run3.png.
- [x] 7 Re-scored (T-0020 chain) against refs/hare/graze-alert-flight/attempt4-video-frames-6fps.jpg, frame for frame:
  | question | run 2 | run 3 | why |
  |---|---|---|---|
  | graze: hunched, head at the clover, ears back? | 65 % | 70 % | crouch and head-down match rows 1-2; ears and muzzle unreadable at this size |
  | alert: sits up, ears up, ~1 s before bolting? | 40 % | 60 % | timing now matches (alert 2.33-3.17 s, flee 3.33 s vs reference 2.3-3.3 s), but the pose goes fully vertical with the head floating above the body, and tips tail-down at 3.0-3.17 s; the reference raises the head on all fours |
  | bound: hind feet ahead of forefeet, gathered/extended phases? | 45 % | 60 % | real three-segment legs alternate gathered/extended; hind overtaking is not readable; contact short of the sourced duty at speed (bound-checks 85.7 %) |
  | flight speed/acceleration like the reference? | 55 % | 75 % | 10 m/s^2 ramp over the first bounds; the reference leaves frame by 4.7 s, ours is tracked so this is judged from speed only |
  | clover visibly thins as grazed (in game)? | 50 % | 45 % | the time-lapse 100 -> 0 % is hard to tell apart at the wolf's camera distance; only the stolon disc darkens |
  | looks like a snowshoe hare? | 30 % | 30 % | low-poly body; needs a furred mesh |- [x] 8 npx tsc --noEmit clean; npm test 379: 367 pass, 0 fail, 12 todo (7a4be8f, flaky test did not flake)
- [ ] 9 Submit only if every gate >= 95 %
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
- [x] 3 Poses (hunched graze with ears back, half sit-up scan, full sit-up alert, tucked rest). Clover thinning
  (render/clover.ts): clumps shown = leaf share, remaining clumps shorter (stubble .35 + .65 x share), a stolon/soil disc
  under each patch shows through; grass blades thinned to 20 % on patches (setCoverSource wrapper in animals/hare.ts,
  seeded patch layout memoised per tile).
- [x] 4 core/transactions.ts: registry keyed by kind pair; rows 'clover|sun' regrow (lazy) and '<eater>|clover' graze (runs
  only while CONTACTS has the feed pair). Regrowth is closed form: CLOVER_STATE stores the grazed delta {units, at, stolon,
  by}; unitsAt = units + k x sunSeconds(at, now) from per-game-day cumulative tables (daylight x temperature factor);
  settle on read; no per-frame regrow loop. STATE_FIELDS groups 'agent' and 'cloverPatch' (+ world.cloverRegrowth);
  saved under boreal.clover.v1 (saveAll, 1 s autosave, new-game clear); hares.snapshot captures every agent snapshot
  field + the grazed deltas and restores them (contacts re-begun). Tests: tests/clover-lazy.test.ts (lazy = stepped within
  3 %, additive, capped refill; contact gating; save/reload; rewind to before a graze; every field tagged).
- [x] 5 Re-recorded 2026-10-21: in game (tools/rabbit-record.mjs -> C:\dev\rabbit-rec3, 87 frames) and the side-on lab
  strip at the reference's 6 fps (tools/hare-strip.html?track=2.2&fov=20&wolfX=-7&wolfAt=2.2 -> C:\dev\rabbit-rec2\strip-final.png),
  compared frame-for-frame with refs/hare/graze-alert-flight/attempt4-video-frames-6fps.jpg. GATE NOT PASSED, NOT SUBMITTED.
  Honest scores (need >= 95 % each):
  | question | score | why |
  |---|---|---|
  | graze: hunched, head at the clover, ears back? | 65 % | silhouette right; head not clearly at the ground, ears hard to read at this size |
  | alert: sits up, ears up, ~1 s before bolting? | 40 % | the sit-up pose matches panel 3, but it lasts one 6 fps frame (react .3 s) vs ~1 s |
  | bound: hind feet land ahead of forefeet, gathered/extended phases? | 45 % | the cycle alternates gathered/extended at the sourced cadence, but legs are blobs; the overtaking hind feet are not readable and stance feet slide |
  | flight speed/acceleration like the reference? | 55 % | 8.5 m/s from the first frame; the hare in the reference accelerates over ~3 bounds |
  | clover visibly thins as it is grazed (in game)? | 50 % | shorter, sparser clumps and the stolon disc show at 45 %, grass is thinned on patches, but grazing is slow in real numbers (4 units / 3 s) so seconds of footage show no change; the in-game hare is hard to see behind the wolf and debug labels |
  | looks like a snowshoe hare (coat, ears, feet)? | 30 % | low-poly blob body; needs a real mesh (see Needs) |
  The number table still passes (run 1; flight cost x8 flagged).
- [ ] 4 core/transactions.ts registry (hare|clover graze, sun|clover regrow) run from CONTACTS; lazy regrowth from sun-seconds;
  STATE_FIELDS hareAgent + clover; save + rewind
- [ ] 5 Re-record and re-score
Exact next step (mine, no other agent needed): (1) alert dwell: hold 'alert' >= ~1 s unless the threat closes inside the
  flight distance (source the hare's flight-initiation behaviour first: freezing then bolting, e.g. snowshoe hare FID studies;
  flag if unsourced); (2) acceleration ramp over the first 2-3 bounds (source hare/jackrabbit acceleration; flag if not);
  (3) recorder: hide debug labels and put the camera side-on to the hare in game; time-lapse the patch (stage units over
  minutes of world time) so thinning is visible. The bound legs and the hare look (scores 45 % / 30 %) cannot reach 95 %
  without the Gait Builder rig and a real mesh: see Needs from another agent.

## Needs from another agent
- Gait Builder (grok-gait): a lagomorph rig on the shared locomotion controller so the hare's legs are real limbs, not
  rotating blobs. Exact needs: (a) skeleton for Lepus americanus from HARE_BODY (hip .13 m, fore leg .12, hind leg .125 +
  hind foot .132 m plantigrade-at-rest, digitigrade in the bound); (b) GAIT_TABLE rows 'half-bound' and 'gallop-lagomorph'
  using HARE_AGENT.gait (touchdown [LF .00, RF .08, LH .42, RH .45], duty .50 -> .17, cadence 3.94 Hz @ 1.68 m/s -> 4.40 Hz @
  11.6 m/s) replacing the [verify] 'bound' row; (c) stance feet planted (no slide: today the stance sweep needs ~.34 m at
  8.5 m/s, more than the blob legs can reach, so feet slide); (d) spine flexion between the gathered and extended
  suspensions (Bramble 1989 four-stage jackrabbit gallop); (e) accept a pose request (sit-up, graze crouch) from the
  pipeline's poseOf. Until then the host's procedural legs stand in.
  - **Picked up by grok-gait (2026-10-21 12:35 PT), not done to the gate:**
    - Branch `grok-gait/T-0009-hare-skeleton` (off bf42625), commits df8e668 (handoff) and 486effe (code); details in
      tasks/handoffs/T-0009-grok-gait.md.
    - Built (a)-(e) as data-driven locomotion files: bodyPlan.ts (skeleton from HARE_BODY), bounding.ts (half-bound +
      gallop-lagomorph rows from HARE_AGENT.gait through bound.ts, planted feet with slip < 1 cm tested, spine flex
      peaking at hind touchdown, PoseRequest + poseRequestFor(poseOf) for sit-up and graze crouch) and boundScore.ts.
    - Calibrated bound-checks score: 80.0 % on HARE_BODY, 91.4 % with measured limb bones (gate 95 %: FAIL). The data duty
      cannot be swept by legs this short.
    - Lab: tools/bound-lab.html?speed=8.5&plan=host (omen :5394). Recordings: /workspace/locomotion/T-0009/ (box).
    - Not wired into the game: gaits.ts (Codex), bound.ts, hare.ts and species.ts (grok) were not edited. Contract notes
      for each are in the grok-gait handoff (GAIT_TABLE rows, hare.ts hosting the rig, HARE_BODY limb lengths ~1.6× short).
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
