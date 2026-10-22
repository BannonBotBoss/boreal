# Handoff: T-0009 shared agent core, hare + sunlit clover (grok, 2026-10-21 11:20 PT)
Owner agent: grok. Branch `grok/rabbit-clover`, worktree `C:\dev\boreal-grok-rabbit`, off main 6226a02.
Preview: http://127.0.0.1:5204/?trees=v2&hour=12&at=-91.9,28.4,0 (add `&hare=debug` for hare state and patch biomass).

**Status: NOT submitted as complete.** The number table passes (one flagged exception), but the animation gate (RULES 6)
fails, and three acceptance criteria are not met (below). Left open, claimed by grok.

## Run 7 progress (started 2026-10-21 18:30 PT; keep current: board rule 9; branches grok/rabbit-clover + grok/hare-mesh)
Plan (Matthew via Grok lead, 18:23 PT brief): grok/hare-mesh (T-0028 mesh + calibrated lookscore v1) merged in first, then fix
the poses lookscore says hold shape back, per pose vs the references: an UPRIGHT alert sit-up as in refs/hare/graze-alert-flight
attempt2 panel 3 (this reverses run 4's half sit-up decision, on Matthew's instruction), the graze crouch, and the bound phases
(gather / push / stretch). Also: a better winter push-off reference (prompt loop), coat scored on the bound poses, an end-on
view, a camera that keeps the fleeing hare in frame; re-score T-0009 and T-0028 with the calibrated metric. Submit only if
every gate >= 95 % and only after re-checking tasks/RULES.md on main for a cross-family reviewer rule.
- [x] 0 Rule 15 review (18:25 PT, main ebbc897): no complete event awaits a grok review (agy T-0025 already reviewed by the
  grok board loop, 76211ee). RULES.md: no cross-family reviewer rule.
- [x] 1 Merged grok/hare-mesh 8edcad8 into grok/rabbit-clover (fast-forward). Box baseline of lookscore v1 on this code
  (swiftshader, within 0.5 of the PC render): shape summer 28.8 / winter 53.2, coat summer 87.7 / winter 90.2.
- [x] 2 Upright alert sit-up (hare.ts poseHare: alert + pause request the rig's 'sit-up'; bounding.ts 'sit-up' pitch .95 -> 1.15
  rad, hip drop 0 -> .02 m; hare.ts POSES.sit body 1.15, head -.8 back toward level, -.025 lower). REFERENCE-MATCHED: the
  silhouette axis of the game sit cells is 66-70 deg vs the refs' 68.9 / 70.8 / 70.0 deg (attempt2 / attempt3 / winter
  attempt2, lookscore masks); not sourced. Found on the way (shared code fix, bounding.ts standError): a fore limb with a
  blade was solved as a bare two-bone leg and missed the ground by 33 mm, so poseReach was 0 for every four-foot pose and the
  graze crouch / rest / crouch requests never moved the body; now solved with foreLimb as the controller does (graze-crouch
  reach 0 -> .64, rest .70, crouch .52). Tests: bound + hare-rig 14/14 on the PC. lookscore v1 (box): sit summer 18.4 -> 52.3,
  winter 32.0 -> 73.6; crouch summer 23.7 -> 29.9 (the standError fix); evidence C:\dev\rabbit-rec11\look\ (score-s3.json,
  zoom-s3-sit.jpg: red = ref only, green = game only). Left: the fore paws stick out ahead of the chest and the neck shows a
  seam when the head turns back level.- [x] 3 Graze crouch: bounding.ts 'graze-crouch' drop .02 -> .04 (the hare reaches .46 of the shape: pitch -.046 rad, hip -.018 m),
  hare.ts POSES head-down head -.55 -> -.85 (nose to the clover). Grid pitch -.1/-.25 x drop .02/.04 x head -.55/-.85 vs lookscore
  v1: crouch summer 29.9 -> 33.1, winter 53.6 -> 53.4 (flat). REFERENCE-MATCHED, not sourced. Why it stays low: the head-to-rump
  height profile already matches within ~.05 of the width (ref .47-.55, game .49-.59); the losses are the hind foot standing out
  behind the rump and the body riding higher on the legs than the photo hare (C:\dev\rabbit-rec11\look\crouch-detail-c1.jpg,
  zoom-c1-crouch.jpg) - the leg reach limits the drop (poseReach .46), so a deeper crouch needs a hind-leg fold the rig allows
  (Gait Builder) rather than more pose numbers.- [x] 4 Bound phases. Found: the rig's fore and hind girdle tops move .133 -> .227 m apart through a stride at 8.5 m/s (spine
  flex +-.36 rad, DERIVED in bounding.ts), but the skin trunk was one rigid bone, so it could neither gather nor stretch.
  Built (shared, data-driven): a chest bone in core/rigBody.ts RIG_BONE (index 21, after the legs so older indices hold;
  RIG_BONE_COUNT 22) + SpecRing.chest weights + RigBind.chest; render/rigSkin.ts parents the head to the chest; hare.ts
  HARE_SKIN front trunk rings chest .2 / .55 / .85 / 1 and the neck on the chest; poseHare puts the chest on the rig's fore
  girdle tops and turns it by the hip-to-shoulder line minus SPINE_BEND .6 x spine flex [estimate; grid 0 / .6 / 1.2 / 1.8 is
  flat within ~2 points]. New tools/hare-strip.html ?stride=8.5: a bound PHASE sheet (30 cells over one steady stride), because
  the 6 fps sequence has only ~10 flee cells, mostly the accelerating start. tests/hare-mesh.test.ts: bone count 22 + new test
  9 (front trunk chest weight > .7, rump < .01, chest travels > 5 cm over a stride). PC: hare-mesh + rules + hare-rig + bound
  30/30, tsc 0. Scores (lookscore v1.1 = bound poses from the stride sheet, box): gather / push / stretch summer 33.6 / 49.2 /
  63.1, winter 42.9 / 100 (suspect anchor) / 68.4; v1 (6 fps cells) 15.1 / 44.4 / 46.0 before vs 12.4 / 43.3 / 43.2 after: so
  most of the bound gain is the stride sheet (metric), the chest bone alone is small and mixed (v1.1 without it: 32.1 / 54.3 /
  57.3; score11-nochest.json). Evidence C:\dev\rabbit-rec11\look\ (ss-b3.png / sw-b3.png phase sheets, score11-b3.json,
  zoom11-b3.jpg). What still differs from the reference (zoom): the game hare barely leaves the ground (suspension lift ~7 mm
  at 8.5 m/s) and its legs stay under the body; the reference's gathered ball (hind feet far ahead) and full stretch need
  more limb reach / suspension in the gait - Gait Builder, not pose numbers.- [x] 5 Coat on the bound poses: lookscore v1.1 (C:\dev\rabbit-rec11\look\lookscore.py + README.md; v1 output unchanged with 3
  arguments). Coat is scored on all five poses, bound poses from the stride sheet; calibration as v1 (known match = second
  drawing, known mismatch = other season): summer match dE 2.8-3.9 / mismatch 38.7-42.1, winter match .7-2.6 / mismatch
  38.7-42.1. Box scores (code 3dcac42): coat summer crouch 85.4, sit 91.3, gather 92.7, push 78.1, stretch 84.7 (mean 86.4);
  winter 84.2, 98.5, 88.0, 91.8, 92.7 (mean 91.0). The summer push cell is the weakest (dE 13.5: the extended belly and
  inner legs show more pale than the photo's).- [x] 6 Winter push-off reference (prompt loop, refs/hare/winter/attempts.md rows 3-5): attempt 3 (with attempt 2 as image
  reference) came out a near-copy of attempt 2, so not independent: rejected as an anchor. Attempt 4 (no image reference, dark
  forest edge so GrabCut masks the white hare, refmask-winter4.jpg) has a clear push-off (panel 5, both hind feet on the snow);
  attempt 5 is a single independent push-off photo. Finding: winter attempt 2's 'push' cell is closer to an extended reach
  (IoU .671 with attempt 4's stretch, .525 with its push-off). lookscore v1.2 (C:\dev\rabbit-rec11\look\lookscore.py, 6th
  argument 'v1.2'): winter known match = attempt 4 for every pose (was the hand-traced attempt 1; anchors crouch .828 / .577,
  sit .738 / .334, gather .858 / .573, stretch .751 / .446), and the push-off is scored against attempt 4 panel 5 with attempt
  5 as its known match (.651 / .504). Box, code 3dcac42: winter shape crouch 71.2, sit 82.5, gather 38.3, push 100 (raw .660
  >= the .651 match: the game's best stride cell matches the push-off as well as a second drawing does; the anchor range is
  narrow, .15), stretch 78.0, mean 74.0; winter coat 95.3. Summer unchanged (46.2 / 86.4).- [ ] 7 End-on view + flee-following camera
- [ ] 8 Re-record, re-score T-0009 and T-0028, compare /workspace/rabbit/compare-poses.jpg
## Run 6 progress (started 2026-10-21 16:17 PT; keep current: board rule 9; only grok/rabbit-clover is touched)
Plan (Grok lead, 16:16 PT): pick up grok-gait/T-0009-hare-v4 (608568b, 961630a, d8b118a; based on 37b1fbc).
Decision (Grok lead): hare-specific contact floors from Hildebrand's Lepus data replace the cross-species .20/.13.
- [x] 1 Rule 15 review (16:18 PT, tasks/events/2026-10-21T16-18-grok-comment-T-0009.json): Fig. 2 p.135 fastest Lepus hind ~15.9 % / fore ~10.8 % (read at 600 dpi, matches ~16/~11); p.137 'fore contacts drop to 70 percent or less of hind contacts for Lepus at speed' verbatim; re-ran bound-checks hare 99.7 % (11.6 m/s hind .183 / fore .110; 1.68 m/s prints 14.0 cm ahead); pelvis 42 deg (Schilling & Hackert 2006) unverified, fetch returned another article: Gait Builder's reading. Merged 783c360.
- [x] 2 (bd78859) bound-checks contact: Lepus floors hind .16 / fore .11 (Hildebrand 1977 Fig. 2, p.135, fastest Lepus stride, read 15.9 / 10.8 %), cap .70 (p.136), and fore/hind <= .70 where the measured hind duty <= .20 (p.137 'Lepus at speed'; gated by duty, not speed, since p.136 'actual speed cannot be derived from contact intervals'). Calibration (rule 11): known match 100.0 at 1.68/5/8.5/11.6 m/s; trot 71.4/62.5/62.5/62.5; sliding + flat back 85.7/65.3/65.3/65.3; contact grade at data duty x1/x.5/x.2: 1.00/1.00/.85 (1.68), 1.00/.97/.64 (5), 1.00/.80/.52 (8.5), 1.00/.76/.50 (11.6). Game data duty line unchanged (hind floor .20 stays in species gait). Score: hare 99.7 -> 99.9 %, game 99.8 %; the only loss is planted 99 % (0.1 mm slip).
- [x] 3 (bd78859) Print citations in the nature table and boundScore REF.overtake: Montana NHC 4-5 in (10-13 cm) and Alberta Parks 13 cm verified online; NRCan average 12.5 cm added; CWF 2004 10-15 cm kept as Gait Builder's citation (not found online by grok). .12 m reference unchanged.
- [x] 4 Contract notes 2 and 3 NOT applied (no source). Note 3 (longer fore limb): the only longer bones at hand are Lepus brachyurus (Exp Anim 30(2):113 Table 1, humerus 84.1/86.3 mm), a larger hare than L. americanus; scaling them onto the snowshoe would overstate it, and no snowshoe radius/manus length was found; with the Lepus fore floor .11 the fore contact (.110) already grades 100 %. Note 2 (hind feet closer, touchdown .42/.43): HARE_AGENT's .03 hind lead is the half-bounding-rabbit value already in species.ts; no source found for a tighter couplet. Notes 1 and 4 done in steps 2-3. TURN.rate .9 rad/s stays a flagged estimate (nature table).
- [x] 5 Re-recorded and re-scored (16:23-16:30 PT). NOT SUBMITTED: not every gate is >= 95 %; look waits on T-0028.
  Recording C:\dev\rabbit-rec10 (plain, 81 frames + clover lapse); side strip as run 5. Box: /workspace/rabbit/compare-run6.jpg
  (reference / run 6 strip / run 5 strip), contact-sheet-run6.jpg, clover-timelapse-run6.jpg, strip-run6.png.
  npm test 399: 387 pass, 0 fail, 12 todo; tsc clean.
  Question chain per gate (what do I see / natural and how do I know / reference / >= 95 %?):
  - graze 70 -> 70 %: unchanged crouch and nibble; matches attempt2 posture; blob body.
  - alert 82 -> 82 %: half sit-up on all fours, head up, ears erect, no turn (attempt4 2.3-3.3 s); head still small.
  - bound 80 -> 80 %: strip frames are nearly identical to run 5 at this scale (v4 changes contact timing and the slow
    half-bound placement, not the silhouette). bound-checks v2, Lepus floors (bd78859): hare 98.4 -> 99.9 % (only planted
    99 %, 0.1 mm slip): 11.6 m/s hind .183 / fore .110 (ratio .60 <= .70), 1.68 m/s hind prints 14.0 cm ahead. The
    visual gap to the photo hare is the body and legs (T-0028), not the timing.
  - flight 75 -> 75 %: flee on sight, bound off, pause and scan; unchanged.
  - clover 85 -> 85 %: time-lapse 100 -> hole -> bare as before.
  - look 30 -> 30 %: waits on T-0028 (procedural furred snowshoe-hare mesh, unclaimed on main).
## Run 5 progress (started 2026-10-21 15:17 PT; keep current: board rule 9; only grok/rabbit-clover is touched)
Plan (Grok lead, 15:16 PT): pick up grok-gait/T-0009-hare-v3 (85df77c, 458c608, f11e7e0; based on 9527d2c).
Decision (Grok lead): the run 4 condition for LEPORID_LIMITS (split hind foot + sourced knee range) is met: apply them.
- [x] 1 Rule 15 review (15:20 PT, tasks/events/2026-10-21T15-20-grok-comment-T-0009.json): knee 30-166.8 deg verified vs PMC3712980 (14.6/12.0 deg short of straight; the paper's 150 deg is the K-wire fixation angle, not a flexion limit, so the 30 deg floor rests on Zhang 2024); scapula .063 verified in Exp Anim 30(2):113 Table 1 (Lepus 68.9/70.2 vs humerus 84.1/86.3 mm = .816); Fischer 2002 pika blade angles 46/80 deg unreadable (bot-walled), stay [verify]; re-ran bound-checks game/v3/v3:level 97.1 % each and bound-reach v3:level fore .323 m. Merged 3ad1801.
- [x] 2 Contract (817633a): HARE_BODY hindToes .056 + scapula .063 (bound-plans SPLIT/BLADE now read them); HARE_PLAN both + limits LEPORID_LIMITS; HARE_RIG = { pose: RUN_POSE_LEVEL, turnInPlace: true } passed to createBounding; root.rotation.y = fr.heading. Legs draw the blade (fore, from the pivot) and the toes (hind, MTP to tip) as segments. Alert freeze KEPT: the reference (attempt4 2.3-3.3 s) raises the head on all fours, no turn. New plan 'hare' (= HARE_PLAN, level pose) in tools/bound-plans; 'game' stays the run 4 body for comparison. tests/hare-rig.test.ts: contract + bound-checks 'hare' >= 95 %. tsc clean.
- [x] 3 Duty floors (fbf5447), re-read Hildebrand 1977 p.135-136. Hind .20 KEPT (the rabbit is named among fast runners whose hind contact 'approaches 20 percent'; < 18 % is only 'individual strides of exceptional cursors', not a steady sprint). Fore hard floor .13, WAS .16: 16 % is what fast mammals 'approach', but fore contact is 'rarely less than 13 percent for consecutive strides', and 'fore contacts drop to 70 percent or less of hind contacts for Lepus at speed', so .7 x .20 = .14 at 11.6 m/s (the .16 floor forced 80 %, the rodent norm). Fore duty at 11.6 m/s .16 -> .14 (data). The .180 contact target (80 % of the mean data duty) is gone from the metric (step 4). TURN.rate .9 rad/s stays FLAGGED [estimate, unsourced]: no measured leporid turn-in-place rate found; the only timed hare turns (Mammalian Biology 2026, doi:10.1007/s42991-026-00566-7: ~180 deg in ~0.40 s) are running pursuit turns, and its three in-place (gambolling) turns are untimed. .9 is the slip-limited rate Gait Builder measured, a game choice.
- [x] 4 bound-checks v2 (fbf5447, boundScore.ts): every check graded 0..1, score = mean x 100 (pass = >= .95, report only). overtake = mean clamp(gap / .12 m) (one snowshoe hind print, 12 x 8 cm, NatureNorth; hind prints lie wholly ahead of the fore in hare track groups, NPS/USFWS); planted = 1 - slip/1 cm - .25 per leash step; cadence 1 within 5 %, 0 at 20 %; phases/flex/order = share of strides; contact = per pair min(1, duty/floor, .70/duty), floors hind .18 / fore .13 (Hildebrand 1977); NEW pitch (>= 5 m/s) = trunk pitch span vs the reference bound (attempt4 frames v19-v25, back line read +3..+25 deg, span 22 deg, +-5 deg reading tolerance; span only, the reference is accelerating). Calibration (rule 11, tests/bound.test.ts synth): known match 100 at 1.68/5/8.5/11.6 m/s; trot 71.4/62.5/62.5/62.5; sliding + flat back 85.7/65.3/65.3/65.3; graded ranks: overtake gap .04/.08/.12 m -> .38/.72/.99 (1.68 m/s) .. .67/.83/.95 (11.6), slip .5/5 mm -> .95/.50, pitch span 2/15/22 deg -> .32/.91/1.00. Results: game (run 4 body) 97.1 -> 98.7 %; hare (v3, level) 97.1 -> 98.4 %: 1.68 m/s overtake 61 % (hind prints only 7.3 cm ahead, under one print) and 11.6 m/s contact 86 % (hind .158 / fore .110 vs .18 / .13: the reach cuts the data duty) are the graded losses.
- [x] 5 (6d6e0eb) Half sit-up head detail: white chin, pale cheek patch and eye ring, a larger eye with a catch-light; ears get a pale inner ear and a dark back rim [estimate: drawn to the reference sheet]. Hind limb thicker so it reads as it swings past the fore legs: thigh .030 -> .042 (width .026 -> .034), shank .014 -> .019, foot .011 -> .014, toes segment .011 [estimate: drawn to the reference]. Run 4 decision line: 'Crouch et al. 2022' -> 'Hall et al. 2022'.
- [x] 6 Re-recorded and re-scored (15:35-15:45 PT). NOT SUBMITTED: not every gate is >= 95 %; task stays open.
  Recording: C:\dev\rabbit-rec9 (plain mode, 78 frames + clover lapse); side strip tools/hare-strip.html (track 2.2, fov 20,
  wolf -7 at 2.2 s); box: /workspace/rabbit/compare-run5.jpg (reference / run 5 strip / run 4 strip), contact-sheet-run5.jpg,
  hare-zoom-run5.jpg, clover-timelapse-run5.jpg, strip-run5.png. npm test 395: 383 pass, 0 fail, 12 todo; tsc clean.
  Question chain per gate (what do I see / natural and how do I know / reference / >= 95 %?):
  - graze 70 -> 70 %: hunched crouch, chin at the clover, nibble; unchanged this run. Reference attempt2 crouch matches in
    posture; the blob body still reads as a toy next to the photo hare.
  - alert 80 -> 82 %: half sit-up on all fours, head raised, ears erect (reference attempt4 2.3-3.3 s: head up, no turn, so
    the freeze is kept). The new chin/cheek/eye-ring/inner-ear detail reads in the strip; the head is still small and simple.
  - bound 75 -> 80 %: trunk now level (pitch -10.7..+10.6 deg at 11.6 m/s, span 21.3 vs the reference's ~22), thicker
    hind legs read as they swing past the fore legs, hind prints land ahead (29-91 cm at 5-11.6 m/s). bound-checks v2 (graded)
    'hare' 98.4 %: 1.68 m/s overtake 61 % (hind prints 7.3 cm ahead, under one 12 cm print) and 11.6 m/s contact 86 %
    (hind .158 / fore .110 vs Hildebrand's .18 / .13). Legs are still sticks against the reference's furred limbs.
  - flight 75 -> 75 %: flees on sight, bounds off, pauses and scans; the root now draws the rig's heading (turnInPlace), but
    no standing turn occurs in this sequence. In game view the hare is small and the flight path is short.
  - clover 85 -> 85 %: time-lapse 100 -> hole -> bare reads as before (clover-timelapse-run5.jpg).
  - look 30 -> 30 %: still primitive blobs; needs a real hare mesh (not this task's tooling). The look gate WAITS ON T-0028 (procedural furred snowshoe-hare mesh skinned to HARE_BODY/HARE_PLAN; proposed by grok 15:47 PT, unclaimed, on main 0fb0014).
  Remaining needs: a hare mesh with fur (look); longer fore/hind contacts at 11.6 m/s need more reach (Gait Builder) and the
  slow half-bound overtake is under one print; a source for the turn-in-place rate.

## Run 4 progress (started 2026-10-21 13:21 PT; keep current: board rule 9)
Plan (Grok lead, 13:21 PT): pick up grok-gait/T-0009-hare-reach (5973cf7, 43f9723, db9b3b4; based on dfcb848).
Decision (Grok lead): LEPORID_LIMITS are NOT applied to HARE_PLAN yet; held until HARE_BODY splits the foot bone
  (Hall et al. 2022 'foot' is a different bone from ours; run 5 fix: was 'Crouch') and a sourced knee range exists.
- [x] 1 Rule 15 review (13:27 PT, tasks/events/2026-10-21T13-27-grok-comment-T-0009.json): three claims hold (CANID_LIMITS = old clamp; LEPORID values match PeerJ 10:e13611 Table 1, but first author is Hall, not Crouch; reach .278/.596 vs .628 m and 77.1/94.3 % re-run). Merged 7dde122.
- [x] 2 Duty line re-sourced: Hildebrand 1977 says "actual speed cannot be derived from contact intervals", so the old linear .60 @ 1.68 -> .20 @ 11.6 m/s had no speed source (retired). Now hind duty = sweep / stride clamped to [.20, .60] (Hildebrand: Lepus ~60 % slow; fast runners incl. rabbit approach 20 %, < 18 % only for exceptional cursors); sweep .40 m = 1.2 x (hind leg + foot) from galloping dogs (Walter & Carrier 2007, JEB 210:208: 9.2 m/s x 71-75 ms contact = .67 m, ~1.2 leg lengths) by dynamic similarity [estimate: no lagomorph stance length found]; fore = .9 -> .7 x hind with a .16 floor (Hildebrand). Hind duty .60/.56/.35/.21/.20 at 1.68/3/5/8.5/11.6 m/s (was .60/.55/.47/.33/.20); hind need at 8.5 m/s .40 m (was .63). bound-checks (game plan, dog ranges): 94.3 -> 97.1 %; LEPORID plan 77.1 % (unchanged; not applied, see decision).
- [x] 3 Running posture (bounding.ts RUN_POSE.level/pitch0, runTilt): the shoulders now rise by .25 of the hip rise, so the neutral trunk pitch is -9.2 deg (game, dog ranges; was -16.6, and -27 with LEPORID) and the derived swing takes it to about -19..+1 deg. REFERENCE-MATCHED, NOT SOURCED (no measured Lepus running trunk pitch found; the reference bound rows show a near-level trunk, nose-up at push-off). A truly level trunk (level 1) drops the fore chord .25 -> .09 m and the bound score 97.1 -> <89 %, so .25 was chosen (score held at 97.1 %; fore .227, hind .541 m). Level neutral needs more fore reach: Gait Builder. Standing/sitting poses are unchanged (rise is scaled by motion).
- [x] 4 Alert pose: new rig PoseKind 'half-sit' (pitch .35 rad ~20 deg, all four feet down, no fore lift) for head-up alert/pause (poseRequestFor), hare.ts sit head -.25 (nose a little up), a neck blob from chest to head so the head cannot float; the vertical 'sit-up' (pitch .95) is kept for other callers but no longer used by the hare. REFERENCE-MATCHED (attempt4 2.3-3.3 s, attempt2 panel 3), not sourced. Test: half-sit keeps four contacts, pitch .25-.45, slip < 1 cm.
- [x] 5 Clover thinning (render/clover.ts clumpShown): clumps now go centre-first with scatter (score .65 x area-rank + .35 x fixed draw, mapped through its CDF so the standing count still equals the leaf share), so a grazed patch shows a widening bare hole; the stolon disc is bare-soil brown 0x6a5436 (was olive, lost in the grass). Game choice for readability, not a sourced grazing pattern. Test in tests/rabbit-clover.test.ts.
- [x] 6 Flaky tests/trace.test.ts "f allocates when off": does not flake alone (8/8 pass on the box); under the full suite, heap growth from lazy compilation can pass 4 MB in one run (no --expose-gc). Took ownership of the small fix: best of three measurements (an allocating f would still grow >= 16 MB every run). f itself (src/proc/trace.ts) unchanged.
- [x] 7 Re-recorded and re-scored (13:50-14:15 PT). NOT SUBMITTED: not every gate is >= 95 %; task stays open.
  Extra fixes found while recording: (a) the alert turned the hare round on planted feet (legs stretched behind, the
  "tail-down tip"): HARE timing.alertTurn 0, a motionless freeze (Emmel 2024) (511e176); (b) the clover clump cap (14 000)
  filled in list order, so near patches could go undrawn and grazing never changed what was drawn: the budget now goes
  nearest-the-wolf first (aae2a65); (c) the recorder's time-lapse now stages every patch within 9 m of the wolf camera
  (6d96726; the single target was out of view behind the wolf).
  Recordings: side strip C:\Users\0\grok-xfer\strip-run4b.png (hare-strip.html?track=2.2&fov=20&wolfX=-7&wolfAt=2.2), in game
  C:\dev\rabbit-rec8 (plain, 85 frames, alert 5.0 s -> flee 6.0 s, lapse-100..0.jpg). npx tsc --noEmit clean; npm test 386:
  374 pass, 0 fail, 12 todo. bound-checks (game plan, dog ranges) 97.1 % (11.6 m/s contact .120 vs .180 the only FAIL).
  | question | run 3 | run 4 | why |
  |---|---|---|---|
  | graze: hunched, head at the clover, ears back? | 70 % | 70 % | unchanged poses; ears/muzzle unreadable at this size |
  | alert: half sit-up, ears up, ~1 s before bolting? | 60 % | 80 % | half sit-up on all fours with the head up, no turn, no tip; 2.33-3.17 s vs reference 2.3-3.3 s; low-poly head and ears |
  | bound: hind feet ahead, gathered/extended phases? | 60 % | 75 % | rig 97.1 %, phases alternate, trunk nearer level; thin stick legs make the overtake hard to read at 6 fps |
  | flight speed/acceleration like the reference? | 75 % | 75 % | 10 m/s^2 ramp unchanged; the tracked camera hides the leave-frame cue |
  | clover visibly thins (in game)? | 45 % | 85 % | the time-lapse reads at 5-10 m (full -> centre hole -> bare soil); the staged 45 % patch shows a hole in game; real cropping (sourced 20.5 mg/s) is still invisible within seconds |
  | looks like a snowshoe hare? | 30 % | 30 % | low-poly body; needs the furred mesh |
Exact next steps (grok): head/ear detail of the half sit-up; thicker hind segments so the overtake reads; re-score after the
  mesh lands. Needs from another agent: art owner: furred snowshoe-hare mesh (~45 cm, short dark-rimmed ears, white hind
  feet); Gait Builder: fore reach so the trunk can run level (level 1 costs the fore chord .25 -> .09 m), the 11.6 m/s
  contact shortfall, an in-place turn that steps the feet, and a split hind foot bone + sourced knee range before
  LEPORID_LIMITS (cite Hall et al. 2022) can be applied.
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
  | looks like a snowshoe hare? | 30 % | 30 % | low-poly body; needs a furred mesh |
- [x] 8 npx tsc --noEmit clean; npm test 379: 367 pass, 0 fail, 12 todo (7a4be8f, flaky test did not flake)
- [ ] 9 NOT SUBMITTED: no gate is >= 95 %. Task stays open.
Exact next steps (grok): (a) alert pose: half sit-up on all fours (head raised, forelegs straight), not the vertical
  meerkat pose, and keep the head attached to the body pivot; (b) clover thinning: stronger read at 5-10 m (fewer clumps,
  bare soil colour, flowers removed first), re-check with the lapse stills; (c) apply rabbit ankle 66-137 deg / foot
  17-123 deg (PeerJ 2022) to the hind chain once ik.ts takes per-species limits; (d) re-record and re-score.
Needs from another agent: art owner: furred snowshoe-hare mesh (~45 cm, short dark-rimmed ears, white hind feet) - caps
  the look score; Gait Builder: body pitch through the bound (unsourced, 0 now), fore reach at speed (the sourced duty needs a
  .63 m hind sweep at 8.5 m/s vs a .31 m chord), per-species FLEX_LIMIT in ik.ts.
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
| hind contact floor (run 6, metric) | .16 of the stride | fastest Lepus stride in Hildebrand 1977 Fig. 2 (J Mammal 58:131, p.135): hind ~16 % (read 15.9 % at 600 dpi) | yes |
| fore contact floor (run 6, metric) | .11 of the stride | same Fig. 2 point: fore ~11 % (read 10.8 %) | yes |
| fore / hind contact at speed (run 6, metric, hind <= .20) | <= .70; game .60 at 11.6 m/s | "Fore contacts drop to 70 percent or less of hind contacts for Lepus at speed" (Hildebrand 1977 p.137) | yes |
| hind duty at 11.6 / 1.68 m/s (rig, v4 fit) | .183 / .592 | .16-.20 at the fastest (Fig. 2; p.135 "approaches 20 percent"); ~60 % slow (Fig. 2) | yes |
| hind print length (overtake reference) | .12 m | 12 x 8 cm (NatureNorth); 4-5 in = 10-13 cm (Montana Natural History Center); 13 cm (Alberta Parks Winter Ecology Tracking Booklet 2020 p.17); average 12.5 cm (NRCan forest damage factsheet: rabbit and hare); 10-15 cm (CWF 2004, Gait Builder's citation, not re-checked) | yes |
| pelvis stance excursion (rig, v4) | 42 deg | pika 109 -> 151 deg (Schilling & Hackert 2006, JEB 209:3925), Gait Builder's reading; full text not reached | flagged: unverified by grok |
| turn in place rate | .9 rad/s | no measured leporid in-place turn rate; running turns ~180 deg in ~.4 s (Mammalian Biology 2026, doi:10.1007/s42991-026-00566-7) | flagged: estimate |

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

## Note from grok-gait (2026-10-21, based on dfcb848; branch grok-gait/T-0009-hare-reach, commits 5973cf7, 43f9723 + this note)
Answer to "Needs from another agent: Gait Builder". Full detail in tasks/handoffs/T-0009-grok-gait.md, Run 2.
- Body pitch:
  - DERIVED in bounding.ts `pitchCurve` (no measured lagomorph pitch found). Pair forces → pitching swing of ±9-10°: nose
    lowest at mid fore stance, highest at mid hind stance.
  - DERIVED running posture: hips rise 6-9.5 cm, nose-down −6 to −38°. This is too steep; open.
- Per-species limits: `BodyPlan.limits` (ik.ts `JointLimits`). Dog/wolf unchanged (test). `LEPORID_LIMITS` = PeerJ 2022
  ankle 66.4-137.2°, foot 17.2-123.3°, verified against the paper.
  - The game hare gets them only when HARE_PLAN adds `limits: LEPORID_LIMITS` (your file). Cost if added today: score
    94.3 → 77.1 %, hind chord .52 → .20 m. See the contract note.
- Reach: **the .63 m hind sweep at 8.5 m/s is not reachable within sourced ranges.**
  - Capacity .278 m with LEPORID_LIMITS, .596 m with dog ranges.
  - Fore: .313-.328 m vs .479 m needed.
  - The duty line's .2 end is the jackrabbit "as low as 16-18 %" minimum (no speed, not hind). Please source or re-derive it.
- Score (tools/bound-score.ts host): 85.7 % (dfcb848) → 77.1 % with LEPORID_LIMITS; 94.3 % with the dog ranges the game
  uses now. Captures: /workspace/locomotion/T-0009/v2/.
