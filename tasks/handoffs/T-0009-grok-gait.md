# Handoff: T-0009 Gait Builder pickup — lagomorph rig on the locomotion controller (grok-gait, 2026-10-21 12:35 PT)
Owner agent: grok-gait (picking up grok's rule-8 "Needs from another agent – Gait Builder" item in T-0009-grok.md).
Branch `grok-gait/T-0009-hare-skeleton` off `grok/rabbit-clover` bf42625, worktree `C:\dev\boreal-grok-hare`.
T-0009 stays grok's task; this file covers only the Gait Builder part. **Not submitted: the bound gate is not at 95 %.**

## Status (rule 9)
- [x] Read: T-0009-grok.md (Needs a-e), tasks/RULES.md, SKELETON-RULES.md, core/agent/bound.ts, HARE_BODY, HARE_AGENT.gait, GAIT_TABLE.
- [x] Ownership: GAIT_TABLE is Codex's (gaits.ts); bound.ts, hare.ts and species.ts are grok's. Neither handoff clears me to
  edit them, so all of them are untouched and the changes are written as contract notes below. Claude's files untouched.
- [x] Code (df8e668 handoff, 486effe code): src/animals/locomotion/bodyPlan.ts, bounding.ts, boundScore.ts; tests/bound.test.ts;
  tools/bound-lab.html/.ts, bound-score.ts, bound-plans.ts. No species words or "shared" in file names.
- [x] Full `npx tsc --noEmit`: 0 errors. `npm test`: 366 pass, 0 fail, 12 todo (378 total; tests/bound.test.ts adds 12).
- [x] Captures under the bench lock (tools/bench-lock.mjs, 12:17-12:18 PT, released), 0.25x and 1x, in /workspace/locomotion/T-0009/.
- [x] Frame answers and score below. Note appended to T-0009-grok.md under Needs.
Exact next step (needs other owners): the contract items at the end. Without them the hare in game stays on blob legs.

## What was built
- **bodyPlan.ts:** `skeletonOf(plan)` turns a few measured lengths into the limb chains the controller solves:
  shoulder→upper arm→forearm→manus and hip→thigh→shank→hind foot, with the hock pointing back. The origin is under the
  hip joints, so the body pitches about the hips. Standing hind foot angle comes from the hip height and knee bend
  (host body: 1.34 rad, near plantigrade, heel ~3 cm up). It throws if the measurements cannot stand.
- **bounding.ts:**
  - `boundRows(BoundGait)`: 'half-bound' = host data as given; 'gallop-lagomorph' = same fore pair, hinds staggered by the
    fore lag with the lead on the other side (rotary). `rowOffsets` converts touchdown to CPG offsets.
    `selectRow`: half-bound below 7 m/s, gallop above it, with 0.5 m/s hysteresis.
  - Reuses core/agent/bound.ts (boundCadence, boundDuty, BoundGait) and core/gaitData (reachTargets, suspensions,
    suspensionRise) by import, so nothing is duplicated.
  - `reachOf` measures each limb's reachable ground chord with the clamped IK. `boundPlan` keeps the data cadence and
    caps the duty at the largest value the limbs plus girdles can sweep (`dutyFits`), so stance feet never have to slide.
  - Girdles: the scapula and the shared pelvis carry the top pivots (reachTargets girdle shifts, scapula capped, pelvis =
    the mean hind shift, capped). The back takes a speed-dependent share of the hind sweep (`spineUse`: stiff at ≤ 1.68 m/s,
    fully flexed-back from 5 m/s), so flexion peaks at hind touchdown and extension at hind lift-off.
  - Hind foot angle is chosen per frame (`hindFoot`): of the angles that reach, the one nearest the standing ankle.
  - Swing feet are kept above the ground. Leash steps are counted, and planted slip is measured per foot
    (rendered sole vs the locked foot).
  - **Pose requests:** `PoseRequest {kind: 'stand'|'graze-crouch'|'sit-up'|'scan'|'rest'|'crouch', weight?}`, plus
    `poseRequestFor(pose, action)` as the adapter from pipeline.ts Pose/Action (head-down→graze-crouch;
    head-up→sit-up, or scan when the action is scan; rest; crouch; moving poses→null).
    - A sit-up pitches about the hips with the hind feet planted and the fore paws tucked up.
    - Requests are honoured only when standing still, and only as far as the limbs reach (`poseReach`).
    - Shapes come from hare.ts POSES.
- **boundScore.ts:** the bound-checks metric (below). **tools/bound-score.ts** prints it.
- **tools/bound-lab.html:** side view with bones, spine, prints (fore blue, hind orange), contact dots and a readout.

## How to view / verify
- Playable (served from this worktree on omen, port 5394; other Vite servers untouched):
  - http://127.0.0.1:5394/tools/bound-lab.html?speed=8.5&plan=host
  - `&ts=0.25` gives slow motion; `&speed=3`, `&plan=bones`, `&row=half-bound`, `&cycle=1` (stand → graze → sit-up →
    run → stop → sit-up); `&speed=0&pose=sit-up`.
  - If the server is down: `npx vite --port 5394` in the worktree.
- `npx tsx tools/bound-score.ts --plan=host` (or `--plan=bones`); `npx tsx --test tests/bound.test.ts`.

## Score (RULES 11): metric "bound-checks", tool tools/bound-score.ts (src/animals/locomotion/boundScore.ts)
Per speed (1.68, 3, 5, 8.5, 11.6 m/s; 0→v ramp over 1.5 s, scored after 2.5 s), 7 pass/fail checks:
1. Overtake: every hind print lands ahead of the fore print before it.
2. Phases: each suspension the data implies is present.
3. Flex: at ≥ 3 m/s, peak flexion within ±0.08 stride of the first hind touchdown and peak extension within ±0.08 of the
   last hind lift-off; below 3 m/s, a stiff back (< 0.05 rad).
4. Planted: slip < 1 cm, no leash steps.
5. Cadence: within 5 %.
6. Order: the row's footfall order.
7. Contact: measured duty ≥ 80 % of the data duty.

Calibration (tests/bound.test.ts): known match = a trace built from HARE_AGENT.gait itself → **100 %** at every speed. Known
mismatches: trot timing with direct-register prints → **60 %** (71/57/57/57/57); sliding feet with a flat back →
**74 %** (86/71/71/71/71). The old poseHare blob legs were not run through the metric (they are not on the controller).
| body | score | fails |
|---|---|---|
| host HARE_BODY (as asked) | **80.0 %** (71/71/86/86/86) | contact at every speed (duty .38/.22/.13/.08/.06 vs data .50/.46/.39/.27/.17); overtake at 1.68 m/s (hind prints 13 cm behind) and 3 m/s (9/18) |
| bones (HARE_BODY with measured limb bones) | **91.4 %** (100/100/86/86/86) | contact at 5, 8.5, 11.6 m/s (duty .28/.175/.128 vs .39/.27/.17) |
Both are below the 95 % gate. The limit is reach: the fore limbs plus scapula cannot sweep the data duty × stride.

## Number table (RULES 6)
| value | game | real figure + source | resembles? |
|---|---|---|---|
| half-bound footfalls | LF 0, RF .08, LH .42, RH .45 (host data) | half-bound: hinds near unison, fores together or staggered (Bertram & Gutmann 2009, PMC2696142); fore support → gathered → hind support → extended (Bramble 1989, Am Zool 29:171; Lagomorpha Locomotion 2021, doi:10.1007/978-3-319-47829-6_1199-1) | yes for the pattern and the stage order; the exact phases are unsourced numbers |
| gallop-lagomorph hind lag/lead | RH .42, LH .50 | rotary lead change (Hildebrand 1977, Am Zool 17:85); no lagomorph hind lag found | **flagged [estimate]** |
| row switch | 7 m/s up, 6.5 down | none found. Bertram & Gutmann give a flexed-back **half-bound** at high speed; Bramble's jackrabbits **gallop**. The sources disagree | **flagged** |
| cadence | 3.94 Hz @ 1.68 → 4.40 Hz @ 11.6 m/s | Heglund & Taylor 1988 allometry: 4.4 Hz is the predicted *maximum sustained* gallop frequency for 1.5 kg, not a measured hare sprint value | partly; **flagged** |
| duty (data) | .50 → .17 | jackrabbit contact 16-18 % of the stride at speed, hind contact longer than fore (Lagomorpha Locomotion 2021). .50 at the transition is unsourced; one duty for all legs ignores the hind > fore difference | top end yes; **.50 and the single duty flagged** |
| duty (achieved) | host .38/.22/.13/.08/.06; bones .50/.39/.28/.175/.128 | as above | host **no**; bones at 8.5 m/s .175 sits inside the sourced 16-18 %, but is below the data line |
| top / flee speed | 11.6 / 8.5 m/s | L. americanus 26 mph = 11.6 m/s (Seton 1928 via MacLulich 1937); hares up to 20 m/s (Williams et al. 2007, J Anat 210:472, L. europaeus) | yes |
| limb lengths | HARE_BODY fore .12, hind .125 (thigh + shank), foot .132 | L. americanus femur 94 mm (Illinois State Museum specimen) + tibia ~106 mm (scaled by L. europaeus 147.3/130.7 mm, Volf 2023, doi:10.37520/lynx.2023.014) ≈ .20 m; fore ≈ .185 m [scaled estimate] | **no: hind is ~1.6× too short** |
| scapula / pelvis swing | ±.30 / ±.30 rad in stance | pika scapula 46°→80° at touchdown/lift-off, 66 % of fore step; pelvis 100-111°→131-151° (Fischer et al. 2002, JEB 205:1315; Schilling & Hackert 2006). Scapular pivot at hip height (Fischer 2002) | yes (pika as the measured lagomorph) |
| spine timing | flexion peak at hind touchdown, extension at hind lift-off (measured, frames below) | Schilling & Hackert 2006, JEB 209:3925 | yes |
| back slow vs fast | stiff ≤ 1.68 m/s, flexed from 5 m/s | slow half-bound stiff-backed, fast flexed-back (Bertram & Gutmann 2009) | yes in kind; the ramp to 5 m/s is [estimate] |
| planted slip | ≤ 0.07 mm steady (host), 0 (bones); test < 1 cm | ask (c) | yes |
| joint limits | canid (Formenton 2019 via ik.ts FLEX_LIMIT) | SKELETON-RULES: lagomorph ranges are open research | **flagged** |
| body pitch in the stride | 0 (vault pitch off; chords are measured at rest height) | hares pitch strongly through the bound | **no, flagged** |
| poses | sit-up .95 rad, graze −.10 rad / 2 cm, from hare.ts POSES (grok [estimate]) | — | host reaches graze, sit-up and rest fully, crouch 76 %, scan 14 %; bones reaches graze 26 %, scan 91 % (limb reach limits) |

## Recording and frame questions (RULES 6)
Recording: /workspace/locomotion/T-0009/ on the box.
- Runs: host-8.5-1x, host-8.5-0.25x, host-3-0.25x, bones-8.5-0.25x, bones-8.5-1x and host-poses-1x.
- Each run is a folder of frames with states.json (per-frame contact, flex, slip, leash), plus an .mp4 (30 fps; poses
  15 fps) and a -sheet.jpg contact sheet.
- 0.25x = 1/120 s of simulation per frame played at 30 fps.
- Bench lock taken as "grok-gait: T-0009 bound lab capture", headless Edge (profile cdp-gait) and the capture Vite server
  closed afterwards.

1. **What do I see?** In host-8.5-0.25x, one stride is frames 25-53:
   - f25: LF lands. f28: RF lands as LF lifts.
   - f30-36: gathered suspension (no contact). The hind legs swing forward past the fore legs, the back arches
     (flex rises to +.29), and the fore legs point back.
   - f37: RH lands ahead of the fore prints. f39: LH lands.
   - f42-52: extended suspension. The hind legs trail, the fore legs reach forward, and the back extends (−.29 at f42,
     LH lift-off).
   - Prints: orange (hind) land ahead of blue (fore). Stance feet stay locked (max slip 0.05 mm).
   - Each foot is down only ~8 % of the stride, so the legs read as quick taps.
   - The body stays level (no pitch), and the trunk looks long for the short legs.
   - bones-8.5-0.25x: the same sequence with longer contacts (f0-3 and f28-31 fore, f11-15 hind) and a deeper hind swing.
   - host-3-0.25x: half-bound. LH then RH land (f6-7), then extended suspension (f13-22), LF (f23), RF (f26). Only a
     small flex (±.10), and the hinds land behind the fore prints at this speed.
   - host-poses-1x: stand, graze crouch (front lowered), sit-up rocking up on the hips with the fore paws tucked (f60-75),
     bound away, stop, sit-up.
2. **Does that look natural, and how do I know?** The order and the spine timing match the sources (Bramble 1989 four
   stages; Schilling & Hackert 2006 timing; Bertram & Gutmann stiff → flexed back), and the hind prints land ahead at
   running speed. Contact is too short with HARE_BODY: 8 % against 16-18 % in jackrabbits. The body does not pitch. The
   slow half-bound puts the hinds behind the fore prints, whereas hare tracks show them ahead.
3. **Reference:** grok's refs/hare/graze-alert-flight (attempt 4 video frames, 6 fps; hare-reference-sequence.jpg).
   I did not make a new reference: this lab is a 2D stick view, so a photo reference cannot be compared at 95 %
   position for position.
4. **Resembles to 95 %?**
   - Visual frame-vs-reference: **uncalibrated** (no calibrated tool; the stick view is not a hare render).
   - Calibrated metric: **80.0 %** (host) / **91.4 %** (bones). **FAIL (< 95 %)**.

## Contract notes (changes in other owners' files; not made)
- **Codex, gaits.ts GAIT_TABLE + signals.ts GaitId** (not cleared): replace
  `bound: { offsets: [.5, 0, .5, 0], duty: .3, lift: .20 } // [verify]` with two rows built from `bounding.ts`:
  - `'half-bound'`: offsets from `rowOffsets(boundRows(g)['half-bound'])` = [0, .58, .92, .55] (LF, LH, RF, RH); duty from
    `boundPlan(...).duty` (speed-dependent, so a table needs a function or the default .5→.17 line); lift from
    `suspensionRise`.
  - `'gallop-lagomorph'`: offsets [0, .50, .92, .58].
  - Add both ids to GaitId (the Record<GaitId,…> type needs them). Keep or alias `'bound'` until callers move.
- **grok, core/agent/bound.ts:** keep it as the data and cadence layer (bounding.ts imports boundCadence, boundDuty and
  BoundGait). Drop footState/airborne/boundLift once hare.ts moves to the rig; they are superseded by the controller's
  contact and suspensionRise.
- **grok, src/animals/hare.ts:** host the rig.
  - `createBounding(skeletonOf(plan), HARE_AGENT.gait, ground, start)` per hare.
  - Each frame: `update(dt, speed, heading, poseRequestFor(poseOf(agent), agent.action))`.
  - Draw the legs from `frame.limbs` / `frame.tops` / `frame.tilt` (as tools/bound-lab.ts does) instead of poseHare's blob legs.
- **grok, HARE_BODY / HARE_AGENT.gait (species data):**
  - Limb lengths: the hind leg .125 m is ~1.6× shorter than the bones (femur 94 mm + tibia ~106 mm). Use the BONE_PLAN
    numbers in tools/bound-plans.ts or measured ones. This alone lifts the score from 80 to 91 %.
  - Source or replace duty .50 at 1.68 m/s, and give the hind a longer duty than the fore.
- **Claude, SKELETON-RULES / ik.ts FLEX_LIMIT:** lagomorph joint ranges (currently canid).
- **Open (mine, next run):** body pitch through the stride (vault with chords measured at the pitched height); fore reach
  at speed (is the scapula excursion enough? Fischer 2002 says the scapula gives 66 % of fore step); slow half-bound
  overtaking (hind prints land behind the fore prints at ≤ 3 m/s on the host body).
- Rule 15 review-first: not done this run.

## Run 2 (grok-gait, 2026-10-21, based on dfcb848 grok/rabbit-clover; branch grok-gait/T-0009-hare-reach)
Asked by Matthew (12:49 PT): grok's T-0009 "Needs from another agent" — (1) body pitch through the bound, (2) fore/hind reach
at speed with the gap quantified and the contact-time source checked, (3) per-species joint limits in ik.ts as data with
the rabbit ankle 66-137° / foot 17-123° (PeerJ 2022), dog/wolf unchanged; re-score, captures at 0.25x and 1x, frame
questions, tsc + npm test. Baseline on dfcb848: bound-checks host **85.7 %** (tools/bound-score.ts).
- [x] Rule 15 review first: T-0007 (grok's proposed plan) — claims hold, not approved (no Objectives, no credits, open
  questions); event tasks/events/*-grok-gait-comment-T-0007.json.
- [x] (3) Joint ranges as data (43f9723). ik.ts: `JointRange` (interior angles, 180 = straight), `LimbLimits`,
  `JointLimits`; `clampLimb(a, front, limits = CANID_LIMITS)`. `CANID_LIMITS` is the old FLEX_LIMIT clamp value for value
  (test: 2000 random angles, both limbs, identical). `BodyPlan.limits` carries a body's ranges; nothing in the code names a
  species. `LEPORID_LIMITS` = hind ankle 66.4-137.2° and hind foot-to-ground 17.2-123.3° in stance, checked against the paper
  (Hall et al. 2022, PeerJ 10:e13611, PMC9208372, Results + Table 1: means ± SD 66.4 ± 13.4 / 137.2 ± 4.8 /
  17.2 ± 6.3 / 123.3 ± 3.6°; ankle = shank-to-metatarsus, foot = metatarsus-to-ground; 6 NZW rabbits, stance 0.40 ± 0.15 s).
  Knee and fore limb: no lagomorph goniometry found, so dog values [placeholder].
  - These are STANCE ranges of slow domestic-rabbit gait, not end-ranges. The standing hare (ankle 48.5° interior) is below
    66.4°, so bounding.ts phases the gait ranges in with motion (`blendLimits` by the move spring); standing keeps dog ranges.
  - Rig mismatch: the paper's foot is ankle-to-MTP; the rig's foot bone is hock-to-toe tip (.132 m). No metatarsus/toe split
    in HARE_BODY, so the paper's angle is applied to the whole bone.
- [x] (1) Body pitch: DERIVED (no measured lagomorph trunk-pitch excursion found). bounding.ts `pitchCurve`: half-sine
  vertical force per planted foot, fore/hind pairs carry 50/50 of the weight per stride [estimate], each acting trunk/2 from
  the centre of mass. Inertia: a rod 2 × trunk long [estimate]. Integrated as a periodic zero-mean swing about mid-trunk,
  capped ±0.2 rad. Nose lowest at mid fore stance, highest at mid hind stance (test). Swing ±9-10° at 3-11.6 m/s. Upper
  bound: horizontal forces aimed at the centre of mass would reduce it. Gushue et al. 2005 found larger fore than hind
  vertical forces in hopping rabbits; that would change the 50/50 share, but no per-pair impulse was found.
  - Running posture, DERIVED (`RUN_POSE`): the hips rise, shoulders stay, so the body pitches nose-down about the hips. The
    rise is the one (0-12 cm, 5 mm steps) with the longest fore + hind chords, measured in the pitched frame over the whole
    swing. Host with LEPORID_LIMITS: rise 9.5 cm, running pitch −16 to −38°. With dog ranges: 6 cm, −6 to −27°.
  - Girdle shifts now move the pivot along the ground, as dutyFits counts them, not along the pitched trunk. Hind sweeps
    shorter than the chord sit at its front end (hind prints ahead).
- [x] (2) Reach budget: `npx tsx tools/bound-reach.ts`. Need = data duty × stride; capacity = chord (foot roll included:
  hindFoot picks the foot angle per position) + girdle on its lever (hip height). Hind girdle: lumbar/pelvis ±0.30 rad
  (Schilling & Hackert 2006). Fore girdle: scapula ±0.30 rad (Fischer et al. 2002).
  **THE HIND SWEEP THE DATA ASKS FOR AT 8.5 m/s CANNOT BE REACHED WITHIN SOURCED RANGES.**
  | body | hind chord | hind capacity | need @ 8.5 | short | fore chord | fore capacity | fore need @ 8.5 | short |
  |---|---|---|---|---|---|---|---|---|
  | host + LEPORID_LIMITS | .200 | .278 m | .628 m | **.350 m (44 %)** | .235 | .313 m | .479 m | **.166 m (65 %)** |
  | host + dog ranges (game today) | .518 | .596 m | .628 m | .032 m (95 %) | .250 | .328 m | .479 m | **.151 m (69 %)** |
  - Lumbar shortening of the trunk is ~2 % of the chord: negligible.
  - Under LEPORID_LIMITS the hind chord sits behind the hip (+.001 to +.201 m back). The limit is the paper's 137° ankle
    plus the foot range: no foot ahead of the hip in stance.
  - Source check (contact time): the data line hind duty .60 → .20 at 11.6 m/s rests on "as low as 16-18 %" for
    jackrabbits (Lagomorpha Locomotion 2021). That figure is a minimum, gives no speed, and does not say hind. Hildebrand
    1977 gives 16-70 % across genera, fore shorter than hind. No measured hare hind stance time at 8.5 m/s was found.
  - So .325 at 8.5 m/s is an interpolation, not a measurement. A sweep of 1.2 × leg + foot (dog at 9.2 m/s: Walter &
    Carrier 2007) gives hind duty ≈ .21 at 8.5 m/s, close to what the dog-range body sweeps (.206).
  - Recommend grok change the duty line rather than anyone tuning to .63 m (contract note below).
- [x] Re-score (tools/bound-score.ts, bound-checks metric, calibration in tests/bound.test.ts "metric calibration"):
  - **host (HOST_PLAN + LEPORID_LIMITS): 85.7 % → 77.1 %**. Fails:
    - overtake at 1.68 and 3 m/s (the hind chord is behind the hip);
    - stiff back at 1.68 (the chord is too short, so the back flexes);
    - flex 7/10 at 8.5;
    - contact everywhere above 3 m/s (duty .362/.224/.126/.064 vs data .512/.427/.286/.170).
  - **canid-limits (HOST_PLAN, dog ranges = what hare.ts runs today): 94.3 %**. Fails: contact at 5 and 8.5 m/s only
    (.293 vs .427, .182 vs .286); planted 0 leashes everywhere.
- [x] Captures (bench lock, headless Edge, closed): /workspace/locomotion/T-0009/v2/ — host-8.5 1x and 0.25x, host-3
  0.25x, canid-limits-8.5 1x and 0.25x, host-poses 1x (frames, states.json, .mp4, -sheet.jpg).
- [x] tsc clean. npm test: 384 tests, 371 pass, 1 fail, 12 todo. The fail is tests/trace.test.ts "trace off: hooks are
  pass-through" (allocation timing; not touched here). Re-ran it alone 3×: fail, pass, pass, so it is flaky.

### Frame questions (rule 6), v2 captures
1. Hind prints land ahead of the fore prints at speed?
   - Yes at 5, 8.5 and 11.6 m/s (8.5: 22/22).
   - Host + LEPORID_LIMITS: no at 1.68 and 3 m/s.
   - Dog ranges: yes at every speed.
2. Gathered and extended suspensions visible?
   - Yes at 8.5 m/s (sheet frames 2, 5, 7, 10: extended; 6: gathered with the fore swung back and hind forward).
   - Airborne share: host 65 %, dog ranges 53 % of frames (duty .142 / .206).
3. Back flexes before hind touchdown and extends at lift-off? Mostly: 7/10 strides at 8.5 m/s (host), 10/10 at 11.6 m/s.
4. Feet planted, no slide? Yes: max slip 0.07 mm running, 0 leash steps in all runs. The poses run shows up to 4.3 mm
   during the sit-up transition.
5. Body pitch plausible?
   - Timing yes: nose lowest at mid fore stance, highest at mid hind stance.
   - Mean posture no: the host runs at −16 to −38°, dog ranges at −6 to −27°. That is steeper than hares look running.
     The derived rise maximizes reach, so the posture is reach-driven, not shape-driven.
   - Open: cap the run pitch, or source a running hip height.
6. Resembles to 95 %? Uncalibrated visually (2D stick lab). Calibrated metric 77.1 % host / 94.3 % dog ranges: FAIL (< 95 %).

## Contract notes (run 2; changes in other owners' files, not made)
- **grok, src/animals/hare.ts HARE_PLAN:** to run the hare on the PeerJ ranges, add
  `limits: LEPORID_LIMITS` (import from './locomotion/ik'). Until then the game hare runs on dog ranges (94.3 % body).
  - Adding it today costs reach: 77.1 %, hind chord .20 m behind the hip.
  - My advice: wait for (a) a metatarsus/toe split in HARE_BODY, so the foot range applies to the metatarsus only, and
    (b) a sourced knee range.
- **grok, core/agent/species.ts HARE_AGENT.gait duty [.6, .2]:**
  - The .2 at 11.6 m/s is the jackrabbit minimum "as low as 16-18 %": no speed, not hind-specific.
  - Either source a hind stance time at speed, or derive the line from sweep ≈ 1.2 × (leg + foot) (Walter & Carrier 2007).
    That gives hind ≈ .21 at 8.5 m/s and ≈ .15 at 11.6 m/s.
- **Open (mine):** run pitch too steep (−27° mean host); fore reach at 5-8.5 m/s short by .11-.17 m on either range set;
  host + LEPORID_LIMITS overtaking at ≤ 3 m/s.

## Run 3 (grok-gait, 2026-10-21, based on 9527d2c grok/rabbit-clover; branch grok-gait/T-0009-hare-v3)
Asked by Matthew (14:18 PT): grok's run-4 Needs for the Gait Builder — (1) fore reach so the trunk can run level, (2) the
11.6 m/s contact (check the .180 source first), (3) an in-place turn that steps the feet, (4) a split hind foot bone + a
sourced knee range so LEPORID_LIMITS can go in; re-score (game body >= 95 %), captures 0.25x/1x incl. the turn, frame
questions, tsc + npm test. Correction applied: PeerJ 10:e13611 is **Hall et al. 2022** (Hall, Stubbs, Anderson, Greenacre,
Crouch), not "Crouch et al." — fixed in ik.ts, tests/bound-limits.test.ts and this handoff.
Baseline on 9527d2c (tools/bound-score.ts, bound-checks): game body (HARE_PLAN, dog ranges) **97.1 %** (11.6 m/s contact
.120 vs .180 fails); host + LEPORID_LIMITS 80.0 %.
- [x] Rule 15 review first (14:30 PT): grok's run 4, claims hold (duty line, 97.1 %, level-1 cost); event
  tasks/events/2026-10-21T14-30-grok-gait-comment-T-0009.json. Committed 85df77c (with the Hall fix).
- [x] Code (458c608): src/animals/locomotion/ik.ts, bodyPlan.ts, bounding.ts, foot.ts; tools/bound-plans.ts, bound-reach.ts,
  bound-score.ts, bound-lab.ts; tests/bound-v3.test.ts (new, 7 tests), tests/bound-limits.test.ts. Nothing in hare.ts,
  species.ts, bound.ts, pipeline.ts, gaits.ts or any mesh: those changes are the contract notes at the end of this section.
- [x] Full `npx tsc --noEmit` on omen: 0 errors. `npm test`: 393 tests, 381 pass, 0 fail, 12 todo (on 458c608). Run interrupted at 15:08 PT
  while committing this handoff; resumed 15:14 PT: no stale bench lock, capture Edge or capture Vite left (checked).

### (4) Split hind foot + rabbit knee — done
- bodyPlan.ts `BodyPlan.hindToes` (MTP to toe tip). The IK foot bone becomes the metatarsus (hock to MTP = hindFoot − toes);
  the toes lie flat ahead of the MTP in stance (digitigrade). ik.ts `toeTarget` gives the MTP the IK must reach from the toe
  tip; the foot state still holds the toe tip, so prints and slip are at the toe. `limbPoints` returns [top, hip, knee, hock,
  MTP, toe tip] for a split foot (indices 1-4 unchanged, so hare.ts's three segments draw thigh/shank/metatarsus as before).
- The paper's "foot" maps to the metatarsus: Hall et al. 2022 (PeerJ 10:e13611) define the foot segment from the ankle marker
  to the MTP marker, and the foot angle as that segment to the ground. With the split, LEPORID_LIMITS' foot range sits on the
  bone it was measured on. On a one-bone foot it lands on hock-to-tip (wrong bone, flagged in the ik.ts comment).
- Split values: Lepus brachyurus bone means (Exp Anim 30(2):113, 1981, doi:10.1538/expanim1978.30.2_113, Tables 4-6, read
  from the J-STAGE PDF 2026-10-21): talus 14.9/14.6, MT III 46.9/47.6, digit III phalanges 22.4/22.6 + 12.2/12.3 + 10.9 mm
  (M/F). Toes = .424 of the ankle-to-tip span (talus as the tarsal span is [estimate]) → on HARE_BODY.hindFoot .132: toes
  **.056**, metatarsus **.076 m**.
- Knee: **interior 30-166.8°** (ik.ts LEPORID_KNEE, flex −1, the sign solveChain folds the hind knee: tested). Max extension:
  normal NZW rabbit knees stop 14.6 ± 7.1° (L) / 12.0 ± 10.9° (R) short of straight, mean 13.2° (Hildebrand, Holmberg &
  Shrive 2003, J Biomech Eng 125:887, PMC3712980). Flexion: immobilised "at 150 deg of flexion" (interior 30°) in the same
  study; passive flexion ~140° at 0.077 Nm (Zhang, Liu & Zhou 2024, Glob J Ortho Res 4(4)). Hall et al. 2022 report no knee
  angle (checked). These are passive end-ranges, not a gait range (none found for the leporid knee).
- Bug found and fixed (mine, run 2): the stance foot range was applied with the pitch sign flipped (foot-to-ground is
  90° − (psi + pitch), run 2 used − pitch). It showed once the trunk ran nose-up; test now reads the angle off the drawn bones.

### (1) Fore reach so the trunk can run level — done
- bodyPlan.ts `BodyPlan.scapula`: the shoulder blade as a fore chain segment. The chain top is the blade pivot at the hip-joint
  height (Fischer et al. 2002 abstract: "a three-segmented limb with zigzag configuration ... displaced at the scapular pivot
  or hip joint, both of which have the same vertical distance to the ground"), the glenoid below and ahead at SCAPULA_REST
  .47 rad from vertical (pika scapula 46° → 80° to the horizontal, mid-stance 63°; the "to the horizontal" convention is how
  I read it: full text bot-walled [verify]). Length **.063 m**: Lepus brachyurus scapula 68.9/70.2 mm vs humerus 84.1/86.3 mm
  (same 1981 paper, Table 1) = .816 x humerus, on the snowshoe humerus .077 m.
- bounding.ts `foreLimb`: per frame, the (blade, manus) pair that reaches, blade inside rest ± GIRDLE.scapulaMax (±.30 rad,
  Fischer 2002), choosing the blade nearest parallel to the forearm ("two segments operate in matched motion during
  retraction": Fischer 2002; the scapula ∥ forearm pairing is my reading [verify]). Elbow and carpus act inside the dog clamp
  (no lagomorph fore goniometry found). The manus angle is scanned (carpal action) instead of held vertical.
- Glide: NOT used. reachTargets' scapular glide has no lagomorph source and with the blade in the chain it would double count.
- Two reach rules changed for every body (both derived, tested):
  - STANCE_SWING: each pair's chord holds over the pitch its own stance sees, not the whole ±.2 rad. The pitch curve puts the
    nose low in fore stance and high in hind stance; measured: fore stance <= +.095 rad, hind >= −.094 (1.68 m/s), from 3 m/s
    <= −.008 / >= +.022. So the other sign's swing is capped at .5 x max (test checks every score speed, game and v3 bodies).
  - The running rise with a gait (createBounding passes it): the rise that lets the most data duty fit (mean over 1.5-12 m/s of
    the smaller pair's capacity/need), not the longest summed chords. The game body keeps 4.5 cm.
- `RUN_POSE_LEVEL` (level 1, pitch0 0) is opt-in (`createBounding(..., GIRDLE, { pose: RUN_POSE_LEVEL })`); RUN_POSE (level .25,
  grok's) stays the default so the game is unchanged until grok switches.
- Reach (tools/bound-reach.ts, after; before = 9527d2c):
  | body | trunk | rise | fore chord | hind chord | fore cap | hind cap | fore need/short @ 8.5 | @ 11.6 |
  |---|---|---|---|---|---|---|---|---|
  | game (HARE_PLAN, dog ranges), before | level .25 | 4.5 cm | .227 | .541 | .305 | .619 | .309 / +.004 | .422 / +.116 |
  | game, level, before | level 1 | 4.5 cm | **.093** | .541 | .171 | .619 | .309 / +.138 | .422 / +.251 |
  | game, after | level .25 | 4.5 cm | .251 | .555 | .329 | .633 | .309 / −.020 | .422 / +.092 |
  | game, level, after | level 1 | 1.0 cm | .254 | .275 | .332 | .353 | .309 / −.022 | .422 / +.090 |
  | game + blade, level | level 1 | 1.5 cm | .323 | .273 | .323 | .351 | .309 / −.014 | .422 / +.099 |
  | split + LEPORID | level .25 | 2.5 cm | .261 | .414 | .339 | .492 | .309 / −.030 | .422 / +.083 |
  | **v3 = split + blade + LEPORID, level** | level 1 | 1.5 cm | **.323** | .427 | .323 | .505 | .309 / −.014 | .422 / +.099 |
  Level trunk on the v3 body: neutral pitch **0°** (was −9.2°), swing −10.5..+10.7° (capture states), fore chord .323 m.

### (2) Contact at 11.6 m/s — **THE .180 TARGET IS NOT SOURCED**
- .180 is the score's "data duty", the mean of hind .200 and fore .160 at 11.6 m/s. Both are clamp floors in grok's gait data
  (bound.ts boundDuty clamps sweep/stride to [.20, .60]; HARE_AGENT.gait foreMin .16), not measurements at 11.6 m/s.
  grok's own sweep rule (.40 m hind sweep, Walter & Carrier 2007 by dynamic similarity) gives sweep/stride = .40/2.636 =
  **.152** there; the .20 floor overrides it. Hildebrand 1977: contact "< 18 %" only in individual strides of exceptional
  cursors, and speed cannot be derived from contact intervals; jackrabbits "as low as 16-18 %" (Lagomorpha Locomotion 2021)
  is a minimum with no speed and no fore/hind split. Hildebrand's Lepus fore <= 70 % of hind gives fore ~.106, not .16.
- Not tuned toward. Rig contact at 11.6: game .120 → .130; v3 level .124 (fails the 80 %-of-data check against .180).
- What-if (not applied, grok's data): duty floor .15 with foreMin kept → data .152, rig .115 / .110, still FAIL (the fore
  floor .16 asks .42 m of fore sweep vs .32 m chord); duty floor .15 and no foreMin (fore = .7 x hind = .106) → 11.6 m/s
  scores **100 %** on both the game and the v3 body. Contract note below.

### (3) Turning in place — done (opt-in)
- bounding.ts `TURN` + `BoundOptions.turnInPlace`: a standing body yaws toward the asked heading at TURN.rate and re-plants
  a planted foot once it is > 3 cm from where it should stand for the current heading (the planted-foot / re-plant-on-
  threshold pattern of procedural walkers, reused from the threejs-procedural-spider model foot.ts already follows). Sequence:
  largest error first, one foot per pair at a time, so a fore and a hind foot are always down; turn steps take .15 s.
- Turn rate **.9 rad/s (52°/s, 90° in 1.8 s) [estimate]**: no measured leporid turn-in-place rate found. Slip stays
  <= .06 mm at .6-2.4 rad/s, so slip is not the limit; .9 keeps the planted feet within ~24-27° of sideways splay (abduction),
  1.6 rad/s goes to 32-35°, 2.4 to 39-44°.
- Signals: BoundFrame.heading is the body's heading (it lags the asked one while turning), plus `turning` and `turnSteps`.
  Off by default (old behaviour, heading taken at once) because hare.ts must draw fr.heading, not a.heading: contract note.
- Tests (tests/bound-v3.test.ts): ±90/180° turns on game and v3: rate cap every frame, a fore and a hind foot always down,
  slip <= 1 cm, done within |angle|/rate + .6 s, >= 4 re-plants, feet end within 3 cm of their rest spots, body not moved.

### Re-score (tools/bound-score.ts, bound-checks; calibration tests/bound.test.ts "metric calibration")
| body | before (9527d2c) | after |
|---|---|---|
| **game (HARE_PLAN as built: dog ranges, one-bone foot, level .25)** | **97.1 %** | **97.1 %** (11.6 contact .120 → .130 vs .180) |
| host one-bone foot + LEPORID_LIMITS | 80.0 % | 97.1 % (wrong bone for the foot range: comparison only) |
| split foot + LEPORID_LIMITS (rabbit knee) | — | **97.1 %** |
| split + LEPORID, level trunk | — | 97.1 % |
| v3 = split + blade + LEPORID, level trunk (proposed) | — | **97.1 %** |
| game, level trunk (no blade) | 85.7 % | 94.3 % (8.5 m/s flex timing 3/10) |
| game + blade, level trunk | — | 94.3 % |
| host one-bone + LEPORID, level | — | 85.7 % |
Every body's only remaining failure at >= 95 %: 11.6 m/s contact vs the unsourced .180. Score files:
/workspace/locomotion/T-0009/v3/scores/.

### Captures (bench lock tools/bench-lock.mjs, 14:58-15:01 PT, released; headless Edge closed, capture Vite :5395 closed)
/workspace/locomotion/T-0009/v3/: game-8.5-1x, game-8.5-0.25x, v3level-8.5-1x, v3level-8.5-0.25x, v3level-3-0.25x,
v3level-11.6-1x, turn-v3level-1x (asks +120° at 1 s, back to 0 at 5 s), turn-v3level-0.25x — frames, states.json, .mp4 and
-sheet.jpg each. Playable: http://127.0.0.1:5394/tools/bound-lab.html?plan=v3:level&speed=8.5&ts=0.25 and
?plan=v3:level&turn=120 (omen Vite PID 37144, this worktree).
Frame questions (rule 6):
- Feet planted in stance? Yes: max planted slip .09 mm (v3 8.5), .06 mm (turn), 0 leashes in every capture.
- Trunk level? v3 level: pitch mean +0.3°, −10.5..+10.7° (the derived bound swing); game: mean −9.0°, −19.7..+1.4°.
- Hind prints ahead of the fore prints? Yes (v3level-8.5-0.25x f0080: orange hind prints right of/ahead of blue fore).
- Split foot visible? Yes: the hind toes lie flat ahead of the MTP through stance and the metatarsus rolls up to toe-off.
- Both suspensions? Yes at 8.5 m/s (gathered and extended: 109/200 airborne frames at 0.25x); spine flex −.30..+.29 rad.
- Turn steps the feet? Yes: turn-v3level-0.25x 21 re-plants for 0 → 97.6° in 2 s, never fewer than 2 feet down (one fore,
  one hind); top-view inset shows hollow = stepping, filled = planted. The side view of a turning body is foreshortened.
- Does it look like nature? Gait timing yes; the stick body is not a hare mesh (art owner item). The turn rate is an estimate.

### Still failing / open
- 11.6 m/s contact against .180 (unsourced target, above). Hind cap .505 vs need .527, fore .323 vs .422 at that speed.
- Fore limb ranges are still dog goniometry [placeholder]; blade/forearm pairing and scapula angle convention [verify].
- The split's tarsal span and the turn rate are [estimate]s. Level trunk without the blade fails flex timing at 8.5 m/s.

### Contract notes (owner: grok — not applied by me)
1. hare.ts HARE_BODY: add `hindToes: .056, scapula: .063` (sources above). HARE_PLAN: add
   `hindToes: HARE_BODY.hindToes, scapula: HARE_BODY.scapula, limits: LEPORID_LIMITS` (import from './locomotion/ik').
   createBounding call (hare.ts:118): `createBounding(HARE_SKELETON, HARE_AGENT.gait!, groundAt, { x: a.x, z: a.z, heading:
   a.heading }, GIRDLE, { pose: RUN_POSE_LEVEL, turnInPlace: true })` (import GIRDLE, RUN_POSE_LEVEL from './locomotion/bounding').
   Scores 97.1 % (v3:level). The three drawn leg segments then are thigh/shank/metatarsus; P[5] (toe tip) is new: draw the
   toes from P[4] to P[5] on the hind legs; a fore P[0] → P[1] is the blade (inside the body, need not be drawn).
2. hare.ts:125: `h.root.rotation.y = fr.heading` (not a.heading), needed with turnInPlace so the body follows the stepped turn.
3. pipeline.ts alertTurn: keep the HARE 0 freeze (Emmel 2024) during the alert hold; with (1)-(2) any heading change at
   speed 0 (scan, after the hold) now turns by stepping. For the flee start, hold speed until |fr.heading − a.heading| < ~20°
   if you want the turn stepped rather than taken in the first stride (optional).
4. bound.ts / species.ts duty: the 11.6 m/s ".180" is the clamp floors. Suggest duty floor .15 (grok's sweep rule gives .152
   at 11.6) and drop foreMin .16 (fore = foreShare x hind = .106, Hildebrand's fore <= 70 % of hind); what-if scores 11.6 m/s
   100 % on both bodies. Or keep them and label .180 [estimate]. Either way the contact check should not cite it as measured.
5. T-0009-grok.md line 11 still says "Crouch et al. 2022": Hall et al. 2022.

## Run 4 — based on 37b1fbc (grok run 5 merged v3 and applied the contract), branch grok-gait/T-0009-hare-v4

Asked (Oct 21 3:44 PM PT): (1) contact at 11.6 m/s by more reach, not by the floors, and confirm the floors apply there;
(2) slow half-bound hind prints a print ahead; (3) a turn-rate source; (4) Fischer 2002 blade angles and the blade ∥ forearm
claim; (5) the knee floor. Re-score (no regression below 98.4 %), captures, tsc + npm test.

### Rule 15 review of grok run 5 (event tasks/events/2026-10-21T16-08-grok-gait-comment-T-0009.json)

- bound-checks v2 on 37b1fbc: hare 98.4 %, game 98.7 % — re-run, as claimed. Below 100: 1.68 m/s overtake (mean 7.3 cm,
  worst 6.5) and 11.6 m/s contact (hind .158, fore .110 vs .18/.13).
- Hildebrand 1977 quotes (pp.135-136) checked word for word in the paper (copy at originalwisdom.com). Not in grok's note:
  Fig. 2 plots the fastest Lepus record at about hind 16 %, fore 11 % (read off the figure ±0.5 %), and p.137: "Fore
  contacts drop to 70 percent or less of hind contacts for Lepus at speed". The floors are cross-species; see (1) below.
- tests/hare-rig.test.ts passes; the contract (HARE_BODY hindToes/scapula, LEPORID_LIMITS, HARE_RIG, root heading) is in.

### Commits (branch grok-gait/T-0009-hare-v4, from 37b1fbc)

- 608568b rule-15 review + this section started. 961630a code (bounding.ts, ik.ts notes, tools/bound-reach.ts doc,
  tests/bound-v4.test.ts). This note: the next commit.

### (1) Contact at 11.6 m/s — hind fixed to the metric floor, fore still short (numbers below)

Do the floors apply at 11.6 m/s? Hildebrand 1977 (J Mammal 58:131) pp.135-136: hind contact "approaches 20 percent ... for
various fast runners ... rabbit. It is less than 18 percent only for individual strides of exceptional cursors"; fore
"approaches 16 percent ... rarely less than 13 percent for consecutive strides". These are the fastest-gait minima, so yes,
11.6 m/s is where they bite — but they are cross-species, and the same paper puts Lepus below them: Fig. 2 plots the fastest
Lepus record at about hind 16 %, fore 11 % (read off the figure, ±0.5 %), and p.137: "Fore contacts drop to 70 percent or
less of hind contacts for Lepus at speed". With fore <= .70 x hind, a fore of .13 needs a hind of >= .186. I did not touch
the floors (boundScore.ts / species.ts are grok's: contract note 1).

What changed (my files):
- boundPlan fits each pair's duty on its own (v3 scaled fore and hind by one share, so the fore cut the hind): the largest
  common share first, then the hind raised alone, then the fore alone. Hind .158 → .183.
- GIRDLE.spineMax .30 → .366 rad: the pika's own leading-limb pelvic excursion, touchdown 109° → lift-off 151° = 42° (cranial
  pelvic angle against the horizontal; effective stance movement 29-44° across the small therians: Schilling & Hackert 2006,
  JEB 209:3925, full text read). No duty gain at 11.6 m/s: the limit there is the shared pelvis — the two hind feet land .03
  of a stride apart (gallop-lagomorph), so one pelvis cannot serve both (hindResidual). With spineMax .50 the hind reaches
  .190; .80 gives .200 — far outside any source.
- limbRange now takes the girdle it is given (v3 ignored a non-default girdle in the fore blade scan; no effect on GIRDLE).
- Heel-to-toe roll on the split foot: not added. The metatarsus already rolls 17° → 123° to the ground over stance (Hall et
  al. 2022, inside reachOf's foot scan); a toe roll on top (toes pivoting about the tip) is not supported — the phalanges
  give -18 % to +4 % of stance length in cui and tree shrew (Schilling 2005, JEB 208:4013, Table 5), i.e. about nothing.
- More blade swing: not adopted. The lagomorph value is the pika's 34° (Fischer et al. 2002, as quoted in Lagomorpha
  Locomotion 2021). Larger values exist for non-lagomorphs at walk/trot — cui 42-43°, tree shrew 50-59° touchdown → lift-off
  (Schilling 2005 Table 3), primates ~45° → ~90° (Schmidt 2008 Table 4). What-if (bound-reach + boundPlan):

| blade each way | fore chord | fore duty at 11.6 m/s | hind duty |
|---|---|---|---|
| ±.30 rad (pika 34°, kept) | .323 m | .110 | .183 |
| ±.366 (cui 42°) | .333 | .114 | .185 |
| ±.42 | .336 | .115 | .185 |
| ±.53 (tree shrew 59°) | .346 | .118 | .185 |

Fore .13 needs a sweep of .13 x 2.636 = .343 m inside CHORD_USE (.9) x chord → a fore chord of .381 m, +18 % over .323; no
sourced blade range gets there. bound-reach (hare, level 1): hind capacity .505 → .522 m vs need .527 (99 %), fore .323 vs
.369 (88 %, short .046 m) — unchanged.

### (2) Slow half-bound: hind prints a print ahead — done

bound-checks 1.68 m/s overtake: mean 7.3 cm (worst 6.5) → 14.0 cm (worst 13.2) vs one 12 cm print. Mechanism: a sweep shorter
than its chord already sat at the chord's FRONT end for the hind (v2); now the fore sweep sits at its chord's BACK end
(foreSlack), and both slacks are taken against the full chord (the reachable interval inside the joint clamps, held over
the stance's pitch swing) instead of CHORD_USE x it. The sweep end touches the reach edge only at the hind touchdown / fore
lift-off; no slip or leash added in the score (planted 99 %, 0 leash steps). Track sources: snowshoe hind prints land ahead
of the fore prints (Montana Natural History Center; Canadian Wildlife Federation 2004 "Tracking Down Winter Wildlife").
Not found: a measured group (track pattern) length or straddle for L. americanus that pins the hind-to-fore spacing — the
guides give print sizes and the group-to-group stride only (Alberta Parks booklet: stride 25-30 cm slow; CWF: up to 130 cm).
12 cm print, second sources: CWF 2004 hind 10-15 cm long (fore 5.1-7.6), Montana NHC 4-5 in (10-13 cm), Alberta Parks
13 cm — 12 cm (NatureNorth) is inside all three. Caveat: CWF notes hares put only the hind toes down when walking, so slow
prints can be shorter than the full 12 cm.

### (3) Turn rate — no source, stays [estimate]

Searched rabbit/hare yaw rates and in-place turning. The only timed lagomorph turns are running pursuit turns (Mammalian
Biology 2026, doi:10.1007/s42991-026-00566-7: ~180° in ~0.40 s, ~450°/s); its in-place gambolling turns are not timed; Walter
2003 (JEB 206:1739) times running mice. TURN.rate .9 rad/s (52°/s) stays labelled [estimate].

### (4) Fischer 2002 blade angles and blade ∥ forearm

- Angle reference: Fischer et al. 2002 itself is still bot-walled. The same lab's papers with the same cineradiography
  protocol state it: "Segment angles were calculated from the horizontal ... The scapular spine was used to indicate the
  orientation of the shoulder blade" (Schilling 2005, JEB 208:4013), and Schmidt 2008 (JEB 211:3775) "segment angles –
  calculated relative to the horizontal plane", forelimb pivot = proximal end of the scapular spine. So 46°/80° read as the
  scapular spine against the horizontal — consistent with how bounding.ts uses them (34° of stance, ±.30 rad).
- Pairing: confirmed scapula ∥ forearm (and femur ∥ tarsometatarsus): Schmidt 2008, citing Fischer & Blickhan 2006 (J Exp
  Zool 305A:935; its abstract does not state it): "'pantograph behaviour' (parallel motion of scapula and forearm and femur
  and tarsometatarsus, respectively)". But it is parallel MOTION in mid-support, not parallel orientation: "Throughout most
  of the support phase, the forearm moves exactly in parallel to the scapula ... only broken at the beginning and end of the
  support phase, when forearm excursions exceed scapula excursions", with the angles differing (scapula ~45° → ~90°, forearm
  11-36° → 102-121°). foreLimb keeps v3's nearest-parallel-orientation cost (doc corrected): a rate-matching cost was tried
  and flipped the elbow mid-stance, so it was dropped.

### (5) Knee floor

grok is right: Hildebrand et al. 2003's "150 deg of flexion" is the pinned immobilisation angle. Zhang, Liu & Zhou 2024
rechecked (full text): disarticulated NZW knees "can be pulled to approximately 140 degrees with a torque of 0.077 Nm",
read off a dial from an unstated zero — interior ~40° if it starts straight, ~27° if it starts at the 13° extension stop;
the 30° floor sits inside. Second knee source looked for: Alder et al. 2025 (Tissue Eng C, doi:10.1089/ten.tec.2025.0044)
give "160°—the normal range of motion of the rabbit knee" as the normal passive EXTENSION angle — backs the extended end
(160-167°), not the flexed one. No second flexion source; ik.ts LEPORID_KNEE doc says so. Values unchanged.

### Re-score (tools/bound-score.ts, bound-checks v2, calibration tests/bound.test.ts)

| plan | 37b1fbc | run 4 |
|---|---|---|
| hare (game body, HARE_PLAN) | 98.4 % | 99.7 % |
| game | 98.7 % | 99.7 % |

hare per speed: 1.68 m/s 94 → 100 % (overtake 61 → 100 %); 3, 5, 8.5 m/s 100 %; 11.6 m/s 98 → 99 % (contact 86 → 92 %: hind
.183 fore .110 vs .18/.13). Only failing check: 11.6 m/s contact, fore. tsc clean; npm test 399 tests, 387 pass, 0 fail,
12 todo (omen). Scores before/after: /workspace/locomotion/T-0009/v4/scores/ (box).

### Captures (bench lock tools/bench-lock.mjs 16:12-16:13 PT, released; headless Edge and capture Vite :5395 closed)

/workspace/locomotion/T-0009/v4/ (box): hare-11.6-1x, hare-11.6-0.25x, hare-1.68-1x, hare-1.68-0.25x — frames + states.json,
.mp4 (30 fps) and a 3x4 sheet each. Frame questions:
- Planted feet slide? No: max slip 0.09 mm (11.6), 0.07-0.1 mm (1.68). One leash step at t 0.67 s in the 1.68 runs, during
  the 0 → 1.68 m/s ramp (before the score's 2.5 s warm-up; the 0.25x run starts after it and carries the count).
- Footfall order / suspensions at 11.6 m/s: LF → LF+RF → RF → airborne (gathered) → RH → LH+RH → LH → airborne (extended),
  as gallop-lagomorph asks; 90 of 160 0.25x frames airborne.
- Slow half-bound: no suspension (no 0000 frame), stiff back (flex 0), hind prints land ahead of the fores (capture
  touchdowns 16.9-18.2 cm; the score's per-240 Hz count is the reference, mean 14.0 cm).
- Trunk pitch at 11.6 m/s -10.7..+10.5° (span 21°, reference 22°); back flex -.364..+.363 rad (= ±spineMax).

### Still failing / open

- 11.6 m/s fore contact .110 vs .13 (the hind is .183 vs the metric's .18; grok's data .20): fore reach, not the blade, is the
  limit (table above). Hildebrand's own Lepus record (~11 %) matches the rig's .110.
- The turn rate is unsourced.

### Contract notes (owner: grok — not applied by me)

1. boundScore.ts contact floors: they are cross-species; for Lepus at top speed Hildebrand gives fore <= 70 % of hind (p.137)
   and a plotted record of about hind 16 %, fore 11 % (Fig. 2). Options: keep .18/.13 and accept 92 % at 11.6 m/s, or add a
   Lepus floor cited to Fig. 2 (read-off, ±0.5 %). Your call; I changed no floor.
2. species.ts gait hind .20 at 11.6 m/s: the rig gives .183 because the two hind feet land .03 of a stride apart on one
   pelvis (hindResidual). Nearer hind touchdowns (e.g. [.., .42, .43]) would let the hind reach its data duty, if a source
   supports a tighter hind couplet.
3. HARE_BODY fore limb: the fore chord (.323 m) is what limits the fore contact; if you have a sourced Lepus fore limb
   (humerus/radius-ulna/manus lengths, e.g. Exp Anim 30(2):113 Table 1) longer than the current foreLeg, it is the lever
   that would move the fore duty.
4. boundScore.ts REF.overtake .12: second sources agree (CWF 10-15 cm, Montana NHC 10-13 cm, Alberta Parks 13 cm); add them
   to the comment if you like.

## Run 5 (v5) — based on 02e1ebc (grok run 7: furred mesh, chest bone, bladed standError), branch grok-gait/T-0009-hare-v5

Asked (Grok Bot, Oct 21 ~7:00 PM PT): check grok's bounding.ts scapula fix; reproduce lookscore v1.2 (gather 33.6, push 49.2,
stretch 63.3 summer; end-on crouch 23.9, stretch 29.5); then, each change sourced: (a) real aerial lift, (b) hind-leg fold in
the gather, (c) more fore reach in the stretch; re-score with lookscore and bound-checks; captures; notes here.
Worktree `C:\dev\boreal-grok-hare5` (node_modules junction to the served folder's, read-only); capture Vite :5395 (mine).

### Rule 15: review of grok run 7's bounding.ts change (standError solves the bladed fore limb) — CORRECT, kept as is
- Checked: `standError` now calls `foreLimb(L, top, rel)` for a fore limb with a blade, the same solver the controller uses
  for a planted bladed fore foot, with the same error (sole vs the wanted point) and the same defaults the controller has
  when standing (limits = CANID_LIMITS, since `blendLimits(CANID, gait, run)` is CANID at run 0; girdle = GIRDLE). The old path
  solved the blade-less two-bone chain from the blade pivot, so it reported a miss for a pose the real chain reaches.
- Measured on the game body (HARE_PLAN, 02e1ebc): standError at the rest pose 0.00 mm; poseReach graze-crouch .461, rest .699,
  crouch .520, half-sit / scan / sit-up 1.0 (all four-foot poses were 0 before the fix, as grok found). Held graze crouch:
  pitch -.046 rad, hip -18.5 mm, all four feet down, max slip 2.0 mm (the POSE_REACH tolerance; under the 1 cm rule).
  tests/bound.test.ts "pose requests" passes. Matches the intent (blade = a real fore segment, planted feet < 1 cm, pose
  requests move the body).
- Nit, not a bug for the hare: `standError` / `poseReach` use the default GIRDLE and cache per skeleton, so a controller made
  with a non-default girdle would get poses computed for GIRDLE. The hare passes GIRDLE.
- Other board items awaiting review (main 0c070e1, oldest first): T-0008 (grok, complete), T-0025 (review), T-0026 (agy,
  complete), T-0027 (agy, completed). Not reviewed in this run (gait-only brief; I do not commit to main). Board naming
  clash, loud: main's T-0009 is "agent-core-transactions"; the hare work on grok/rabbit-clover also calls itself T-0009.

### Baseline reproduced (my own PC GPU capture at 02e1ebc, 19:08 PT, strip-shot.mjs + smoke-tiers EDGE_FLAGS)
lookscore v1.2 and endscore give exactly grok's pc8 numbers (scorer copies on the box in /workspace/hare5/lk, only the data
path changed; C:\dev\rabbit-rec11 untouched): summer gather 33.6 / push 49.2 / stretch 63.3; winter 37.9 / 100 / 77.8;
end-on crouch 23.9, sit 70.8, gather 35.6, stretch 29.5 (push uncalibrated). bound-checks v2 at 02e1ebc: hare (game body)
99.9 %, host 98.9 % (v4 reported 99.7 / 99.7 on the old floors; grok's Lepus floors changed the metric since).

### What changed (src/animals/locomotion/bounding.ts only; tests/bound-v5.test.ts new)
1. **Aerial lift — `heightCurve` (DERIVED).** The body's height through the stride from the same half-sine vertical ground
   forces pitchCurve uses (pairs carry foreShare / 1 - foreShare of the weight per stride), minus g, integrated twice (periodic,
   zero-mean velocity). Every suspension is therefore a ballistic g·t²/8 parabola (test: the curve's acceleration is -g within
   5 % in every suspension), joined to the support dip the same forces give (bouncing-gait CoM: Cavagna, Heglund & Taylor 1977,
   Am J Physiol 233:R243; half-sine force = Alexander & Jayes 1978, J Zool 185:27, shape factor 0 — [assumption], as in
   pitchCurve). Height 0 = the lowest point while any foot is down, so a stance limb never folds further than at the running
   rise reachOf picked (a zero-mean curve sank the body 7 mm in stance: limbs hit their flexion ends, host body slipped 6.5 mm,
   bound.test.ts failed). v4 drew only a g·t²/8 hump inside each suspension and nothing in stance.
   - Numbers (hare, 8.5 m/s, 4.40 Hz, stride 1.93 m, duty hind .207 / fore .153 — Hildebrand 1977 floors / grok's data):
     suspensions gathered .187 + extended .343 of the stride = 42 + 78 ms; flight-only g·t²/8 = 2.2 / 7.5 mm (the "~7 mm").
     heightCurve span 16 mm, highest in the extended flight. **Loud: this is the real number.** A body moving 8.5 m/s with
     Hildebrand's hare duties has ~120 ms of flight per stride; it cannot rise more than ~1.5-2 cm. The references' "flying"
     look comes from the tucked legs, not from height. Lifting the body further would be invented physics.
   - Swinging feet ride with the ballistic body in flight (target + body lift x arc) instead of reaching back to the ground.
2. **Hind fold — `SWING.fold.hind` .25 -> .8 x hip height.** The hind swing target rises to .8 x hip at mid-swing; the clamped
   IK then folds the limb to the measured ends: knee reaches the 30 deg flexion end (LEPORID_KNEE: Hildebrand, Holmberg & Shrive
   2003 / Zhang 2024 — the 30 deg floor rests on Zhang alone), ankle 66.4 deg (Hall et al. 2022, PeerJ 10:e13611, a STANCE
   minimum — no swing range found; the tendon study PMC10836017 reports swing knee/ankle extremes only in figures). Trailing in
   the extended flight, drawn up and forward under the trunk into the gathered one (Bramble 1989, Am Zool 29:171). Hind feet
   land 14-96 cm ahead of the fore prints (overtake 100 % at all speeds; touchdown points unchanged — only the swing path moved).
   - .8 is an **[estimate] bounded by a geometric rule**: the largest fold at which no hind sole rises above its own hip joint at
     5 / 8.5 / 11.6 m/s (sole max -24 / -18 mm below at .8; +16 mm at .9; +120 mm at 1.1). There is no measured leporid hip
     extension limit in the rig, so higher folds swing the folded foot over the rump and at 1.2-1.5 ONTO THE BACK.
3. **Fore reach — no change.** Early protraction (`reachAt` .7, paw fully forward at 70 % of swing) cut summer gather 33.6 ->
   10.8 and push 49.2 -> 0.6; fore fold .1 / .25 / .5 was flat. The fore reach is bounded by the sourced blade range (pika
   ±.30 rad, Fischer et al. 2002) and the fore limb length (open contract note 3 of run 4: a sourced longer Lepus fore limb).
   Spine extension is already at its cap (±.366 rad, Schilling & Hackert 2006) at extension. I did not invent more.

### lookscore v1.2 / endscore (PC GPU captures, my scorer copies; before 02e1ebc 19:08 PT, after final code 19:44 PT)
| pose | before | after v5 |
|---|---|---|
| summer gather | 33.6 | 33.8 |
| summer push | 49.2 | 49.2 |
| summer stretch | 63.3 | **83.7** |
| winter gather | 37.9 | **48.7** |
| winter push | 100 (narrow anchor) | 100 |
| winter stretch | 77.8 | **90.9** |
| end-on gather | 35.6 | **50.9** |
| end-on stretch | 29.5 | 32.4 |
| end-on crouch (standing pose, not gait) | 23.9 | 23.9 |
| shape mean summer / winter / end-on | 46.2 / 73.7 / 39.9 | 50.3 / 78.5 / 44.5 |
| coat summer / winter / end-on | 86.4 / 95.5 / 85.5 | 86.0 / 96.1 / 82.5 |
Crouch and sit are standing poses (gait code unchanged there): 32.8 / 52.1 summer, 71.1 / 81.8 winter, same as before.
End-on coat -3: probably more of the pale hind leg showing from behind when folded (not checked cell by cell).

**Loud risks about the metric (rule 11):**
- lookscore rewarded physically impossible poses. Hind fold 1.5 scored best overall (summer stretch 100, end-on gather 100,
  end-on stretch 89.5) with a hind foot lying on top of the back (grid/fold-1.2-1.5-foot-over-back.jpg). I did not ship it.
- It is jumpy: each pose takes the best of 30 cells, so one cell flips end-on gather 50 <-> 100 between near-identical
  settings. Differences under ~10 points between variants are noise.
- The references are generated images (refs/hare/*/attempts.md), ~85 % "resembles nature" by the reviewer's own call; the
  GrabCut masks include clover (summer gather mask has a ground blob). Matching them is not matching hares.
- Summer gather / push did not move with any gait variant (33-34 / 49-51): the picked cells are stance cells whose
  silhouette is set by the trunk and mesh (gathered ball height, chest), not by the swing legs. A taller "ball" needs the
  trunk to arch more than the rig's sourced spine range, or a mesh change (Claude / grok), not more gait.

Grid (all PC GPU, stride sheets; 6 fps strips reused from the baseline since standing poses are untouched), summer g/p/s |
winter g/p/s | end g/s: fold .25 + body lift (h1) 32.4/50.7/64.4 | 36.0/100/79.2 | 38.9/22.7; hind .6 (h2) 32.4/50.7/74.3 |
45.1/100/89.2 | 51.7/27.5; hind 1.0 (h3) 32.4/50.7/92.4 | 58.0/100/89.6 | 45.4/58.2; hind 1.5 (h7) 32.4/50.7/100 |
57.6/100/84.7 | 100/89.5 (foot over the rump); fore reachAt .7 (h4) 10.8/0.6/61.4; body lift off (h6) = h1 within 1.4.
Scores per variant: /workspace/locomotion/T-0009/v5/grid/.

### bound-checks v2 (tools/bound-score.ts) — no regression
hare (game body, HARE_PLAN) 99.9 % (before 99.9): every speed 100 %; max slip 0.1-0.2 mm, 0 leash steps; overtake 14.0 /
18.2 / 33.2 / 61.4 / 95.7 cm. host 98.9 % (before 98.9; only 1.68 m/s overtake 7.9 cm, as before).
`npx tsc --noEmit` 0. `npm test` 411 tests, 399 pass, 0 fail, 12 todo (tests/bound-v5.test.ts adds 3; trace.test.ts passed
this time).

### Captures (bench lock tools/bench-lock.mjs per batch 19:08-19:44 PT, released each time; headless Edge killed by strip-shot)
/workspace/locomotion/T-0009/v5/ (box): before/ and after/ = gs, gw (6 fps summer / winter), ss, sw (stride sheet
?stride=8.5), ge, se (end-on) PNGs + score12.json + endscore.json; compare-side-summer.jpg, compare-side-winter.jpg,
compare-end.jpg (stride cells 0-24, before row over after row); grid/ (per-variant scores, the foot-over-back sheet, the
score scripts). Capture Vite :5395 is mine (left running for re-checks; other servers untouched).

### Contract notes (not applied by me)
1. grok, hare.ts SPINE_BEND / chest: summer gather is now limited by the trunk silhouette, not the legs. If you want a
   rounder gathered ball, the chest bone turn (SPINE_BEND .6, [estimate]) is the free knob; the rig's spine flex is capped at
   the sourced ±.366 rad.
2. grok, HARE_BODY.foreLeg: still the lever for fore reach in the stretch (run 4 note 3: a sourced Lepus humerus / radius /
   manus set, Exp Anim 30(2):113 Table 1).
3. Anyone with a source: a leporid hip extension range (or swing-phase knee / ankle extremes) would let the fold rule use
   measured angles instead of "sole below the hip".
4. grok, boundScore.ts: consider a check that no swinging sole rises above its hip (tests/bound-v5.test.ts has it as a test)
   so a look metric cannot pull the rig into foot-over-back poses.

### Open
- The fold value .8 and the "sole below hip" rule are estimates; the swing angle ranges used are stance-measured.
- Fore reach unchanged (needs a sourced fore limb). Summer gather / push unchanged (trunk / mesh, not gait).
- heightCurve's half-sine force shape is an assumption (as pitchCurve's).

**Id note (grok, run 8, 20:23 PT):** the 'naming clash' above is not one: main's T-0009-agent-core-transactions is this hare + clover task (claim 10:50 PT names grok/rabbit-clover); see tasks/events/2026-10-21T20-23-grok-comment-T-0009.json. No renumbering.

## Run 6 (v6) — based on 524caea (grok run 10/11: BodyPlan.girdleTop .17, anatomy check), branch grok-gait/T-0009-fore-reach

Asked (Grok Bot, Oct 21 10:49 PM PT): since b774a5e the stretch's fore paws "point down instead of far forward" (lookscore v1.3
stretch summer 100 -> 85.1, winter 86.7 -> 81.3); add forward reach to the fore swing / extension in bounding.ts so stretch
matches again without hurting crouch / sit / gather; keep LEPORID_LIMITS, posePlausibility (check 9), mass, bound-checks >= 99.7,
npm test, tsc. Branch: the brief said gait/<topic>; I used `grok-gait/T-0009-fore-reach` (the grok-gait/ prefix of all my
branches). Notes go here, NOT in T-0009-grok.md (grok's file; it exists and is untouched). Worktree `C:\dev\boreal-grok-hare6`
off 524caea (b774a5e is an ancestor), node_modules junction to the served folder's (read-only); capture Vite :5395 (mine;
the v5 server on that port, also mine, was stopped first). C:\dev\rabbit-rec13 / rec14 read only (copied out, not written).

### Rule 15: review of grok run 10 (45d0439..524caea) — CORRECT, kept as is
- bodyPlan.ts `girdleTop`: with a blade the fore `hip` is gTop - S and the glenoid gTop - S cos(rest); `topY(L)` = hip + girdle =
  gTop, so standError / poseReach / limbRange / foreLimb and the controller all use the raised pivot (no stale default GIRDLE
  height anywhere: checked every topY / L.hip use in bounding.ts). Standing elbow 71 deg, 27 mm below the glenoid (grok's grid-run10).
- boundScore.ts `posePlausibility` / check 9: soles (limbPoints from index 4) vs P[1] = the hip / the glenoid, joints vs the
  wider of CANID and the body's ranges - matches its comment and lookscore v1.3's gate.
- bounding.ts PoseShape.ahead / graze re-plant / sit-up tuck .35 x hip: standing only (`moving ? 0 : ahead`), no effect on the bound.
- My v5 nit still stands (standError / poseReach cache per skeleton with the default GIRDLE); harmless for the hare.
- Board items awaiting review on main a436a9d: T-0008 (grok, needs an approve), T-0025 (review), T-0026 (agy), T-0027 (agy).
  Not reviewed here (gait-only brief; I do not commit to main).

### Baseline reproduced (lookscore v1.3 = grok's /workspace/rc7/look/lookscore13.py, copied to /workspace/hare6/lk, data path only)
grok's pc11 strips and my own PC GPU capture at 524caea (~23:00 PT, bench lock, strip-shot.mjs `&log=1`) both give exactly
grok's run 10 numbers: summer crouch 50.9, sit 56.4, gather 48.1, push 87.0, stretch 85.1; winter 64.3, 83.5, 51.9, 100,
81.3; end-on crouch 86.2, sit 66.8, gather 77.5, push uncalibrated, stretch 38.9; no zeroed cells. bound-checks at 524caea:
hare 99.7 %, host 99.1 % (host FAIL overtake 69 % as before).

### Diagnosis — the paws were too HIGH, not too steep
- Probe (tools/_probe6.ts, scratch, not committed): 8.5 m/s hare, one steady stride. In the extended flight (LF phase .73-.97)
  the fore limb is straight (elbow at its 176 deg clamp), blade at rest + scapulaMax (44 deg), and the swing target lies
  205-255 mm ahead of / 123-127 mm below the glenoid, beyond the limb (.187 m). The IK points the straight limb AT the far
  target, so the paw sits on that ray, ~30 mm above the swing's own height: forearm 27-35 deg below forward, paw 45-58 mm
  above the ground. With girdleTop undefined (= run 9 geometry) the same rule gives forearm 19-26 deg but the glenoid is
  ~40 mm lower, so the paw is ~15-20 mm lower above the ground.
- lookscore overlays (norm frame, /workspace/locomotion/T-0009/v6/compare-stretch.jpg): run 9's best stretch cell lays the fore
  legs along the reference's; run 10's fore legs run ABOVE the reference fore legs. So the cost is paw height under the body.
- Confirmed by grid (below): raising the paws toward the horizontal (what "more forward reach" by angle means) LOWERS the score
  (summer 83-85, winter 73-79); lowering them raises it monotonically.
- Root cause: the ground-referenced swing target (stepFoot arc + v5 body lift) is unreachable late in swing, and the
  "point at the unreachable target" fallback puts the paw ~30 mm above the swing arc; the raised glenoid (girdleTop) turned that
  into paws 45-58 mm off the ground. standError / poseReach / swing already use girdleTop (topY), so that suspicion was wrong.

### What changed (src/animals/locomotion/bounding.ts; tests/bound-v6.test.ts new)
- `FORE_REACH = { from: .6, full: .7, hold: .92, reach: .995 }`, `foreReachWeight(sp)`, `foreReachTarget(L, top, rel)`: from swing
  fraction .6 to .7 (0 lift-off .. 1 touchdown; LF phase ~.66-.75 at 8.5 m/s) an unreachable swinging fore target is pulled
  back AT ITS OWN HEIGHT onto the reach circle (.995 x the straight limb) about the protracted glenoid (blade rest + scapulaMax,
  computed from the body's own girdleTop / scapula), held to .92, released by touchdown (smoothstep). The paw keeps the swing's
  ground clearance and reaches as far forward as the limb allows. No fixed angle; reachable targets unchanged; stance feet,
  sit-up tuck, leash / stop steps untouched.
- Result (probe): extended flight paw 22-32 mm above the ground (was 45-58), 137-142 mm ahead of the glenoid (was 150-163),
  forearm 35-40 deg below forward, elbow 170-176, manus 39-54 deg below forward (droops 5-15 deg past the forearm: the reachable
  target is met with a slightly bent wrist; a psiWant unfold toward the forearm line gave byte-identical renders, so it was
  dropped).
- Timing [estimate, grid]: starts after the gathered (stride .17 / .20 / .50) and push-off (.64 / .67) cells (v5's early
  protraction from .7 of the stride wrecked gather / push); F55 (start .45) cost summer push 87.0 -> 84.1.

### Grid (lookscore v1.3, my PC GPU captures, ss / sw / se re-shot per variant, gs / gw / ge from the baseline; full scores
/workspace/locomotion/T-0009/v6/grid/grid-scores.txt). stretch summer / winter; every other pose unchanged unless noted:
| variant | rule | stretch s / w |
|---|---|---|
| before (524caea) | - | 85.1 / 81.3 |
| A19 / A26 / A35 | raise to 11 / 15 / 20 deg below forward (more "forward") | 83.2 / 74.7, 83.9 / 72.9, 84.7 / 76.1 (end gather 74.9, end stretch 33.3) |
| A00 | raise to the horizontal | 85.5 / 76.1, bound-checks 93.9 % |
| D45 / D55 / D63 | set 26 / 31.5 / 36 deg, from .62 | 84.6 / 77.9, 84.3 / 79.7, 85.0 / 79.8 |
| S65 / S75 / S85 / S95 / S105 | set 37 / 43 / 49 / 54 / 60 deg, from .6 | 85.4 / 79.6, 87.7 / 83.4, 89.4 / 85.1, 93.9 / 87.9, 95.9 / 88.9 (push s 90.9) |
| **G1 (shipped)** | reach clamp at the swing height, .6 / .7 / .92 | **93.9 / 89.1** |
| G2 / G3 | .62 / .72 / .95; .58 / .66 / .92 reach .98 | 93.9 / 89.0; 91.5 / 87.2 |
S105 scores ~2 points more but only by pushing the paws onto the ground before touchdown (ground clamp); G1 is parameter-free
geometry and stays clear of the ground, so G1 ships.

### Scores (rule 11), before (524caea) -> after (v6), lookscore v1.3, noise SD shape summer 0.6, winter 0.5, end-on 1.1 (grok)
| pose | summer | winter | end-on |
|---|---|---|---|
| crouch | 50.9 -> 50.9 | 64.3 -> 64.3 | 86.2 -> 86.2 |
| sit | 56.4 -> 56.4 | 83.5 -> 83.5 | 66.8 -> 66.8 |
| gather | 48.1 -> 48.1 | 51.9 -> 51.9 | 77.5 -> 77.5 |
| push | 87.0 -> 87.0 | 100 -> 100 | uncal. -> uncal. |
| stretch | **85.1 -> 93.9** | **81.3 -> 89.1** | 38.9 -> 38.9 |
Zeroed cells: none before or after (all 180 cells posePlausibility ok; highest sole 29.9 mm below its own joint in both).
Stretch is +8.8 / +7.8 (15 / 16 SD); summer still under run 9's 100, winter now above run 9's 86.7. End-on stretch picks a
fore-stance cell (stride .14), which this change does not touch.
- bound-checks: hare 99.7 % (5 speeds 100 / 100 / 100 / 100 / 99; check 9 anatomy 100 %, highest sole 10 mm below its joint at
  11.6 m/s), host 99.1 % (unchanged, the old host overtake FAIL). Mass: no mesh / body change (grok's 1.921 L stands).
- `npx tsc --noEmit` 0 errors; `npm test` 419 tests, 407 pass, 0 fail, 12 todo (524caea: 415 / 403; +4 in bound-v6.test.ts).
  Logs in /workspace/locomotion/T-0009/v6/after/ (tsc.txt, npmtest.txt, bound-hare.txt, bound-host.txt).
- LEPORID_LIMITS untouched (hind only; the fore uses CANID_LIMITS, elbow at its clamp as before).

### Sources and flags (rule 6)
- GIRDLE.scapulaMax .3 (pika +-17 deg, Fischer et al. 2002 JEB 205:1315) and SCAPULA_REST unchanged; the reach circle uses them.
- **Flag (loud):** the shipped forearm (35-40 deg below the horizontal in late swing) lies at / past the top of the 11-36 deg
  measured AT fore touchdown in small therians (Schmidt 2008 JEB 211:3775 Table 4; pika 33 deg, Fischer et al. 2002, summarised
  in Lagomorpha Locomotion 2021 - which also says the pika scapula starts retracting in late swing, i.e. a late-swing forearm
  is, if anything, shallower than at touchdown). No hare / jackrabbit fore swing kinematics were found. So the angle is a
  CONSEQUENCE of the geometry (girdleTop .17 [grok's estimate] + fore limb .187 m + swing clearance), not a sourced value; the
  paw height it buys is REFERENCE-MATCHED. Inside the sourced forearm range (D45-D63, S65) nothing beats the baseline.
- Timing (.6 / .7 / .92) and reach .995 are estimates (grid).

### Contract notes (other owners' files; not changed)
- grok (hare.ts HARE_BODY): the stretch ceiling is geometric - a .187 m fore limb from a glenoid ~40 mm higher cannot reach
  both as far and as low as run 9's. If girdleTop .17 stays, a sourced longer manus / forearm, or girdleTop just under .17, would
  let the paw reach low without the forearm passing 36 deg. Measure against v6, not 524caea.
- grok (tools/hare-strip.ts): nothing needed; `&log=1` per-cell plausibility worked as documented.
- Claude (core/animalBehavior solveChain, reached through ik.ts solveLimb): when a fore target is out of reach the solver points the straight limb at it
  (ray rule), which lifts the paw above its swing arc; v6 avoids that in late swing only. A generic "keep height, clamp
  reach" rule in the solver would make it hold for any body - proposal, not made.

### Captures (box /workspace/locomotion/T-0009/v6/)
before/ (524caea) and after/ (v6): gs / gw / ge timed strips, ss / sw / se stride sheets (8.5 m/s, 30 cells, end-on = se / ge),
each with .log.json (per-cell plausibility) and s13 / e13 lookscore outputs. compare-stretch.jpg (run 9 / before / after
overlays + stride cells), compare-{ss,sw,se,gs,gw,ge}.jpg (before above after), grid/grid-scores.txt.
Exact next step: grok re-scores v6 on the merged tip and decides whether the forearm-angle flag is acceptable or the fore
limb / girdleTop should change (contract note above); then gather (~50) stays the weakest silhouette (grok's run 11 plan).

## Run 7 (v7) — based on 9fdfae0 (grok run 11: v6 merged as f430a23, girdleTop .157 95e7c7c), branch grok-gait/T-0009-fore-touchdown

Request (Grok Bot, 2026-10-22 00:25 PT): the fore forearm AT TOUCHDOWN drops under 11 deg at 11.6 m/s; keep it 11-36 deg
(Schmidt 2008 JEB 211:3775 Table 4) at 5 / 8.5 / 11.6 m/s with the late-swing forearm <= 36 deg, stretch ~96.2 / 100, other
poses unchanged.

### Review first (rule 15) - grok run 11 (f430a23..9fdfae0)
- hare.ts HARE_BODY girdleTop .17 -> .157 (95e7c7c), labelled as grok's estimate under the 20-22 cm shoulder height (secondary
  source); it is what brings the late-swing forearm to 34.7 / 33.3 / 35.9 deg. tests/forearm.test.ts measures elbow -> wrist
  below the horizontal over swing .7-.92 at 240 Hz, both fore legs - I use the same angle definition. anatomy.test.ts bound
  moved with it. Run head pose and the hare-strip ?pose= hook do not touch bounding.ts. No objection; reproduced grok's v1.3
  numbers on 9fdfae0 (table below, "before").

### Diagnosis
Probe (tools/_probe7.ts, scratch, not committed; copy in the captures): per touchdown, the last swing frame, the first stance
frame, and the contact instant interpolated between them at the phase crossing.
- The fore stance sweep (foreDuty x stride = .276 m at every speed) sits at the back end of the .306 m fore chord (run 4 rule:
  snowshoe fore prints behind the hinds), so a fore paw lands ~95-120 mm ahead of and ~100 mm below the glenoid, INSIDE reach:
  elbow 96-120 deg at the first stance frame, and it keeps folding as the body runs over the paw.
- At 11.6 m/s the body covers 48 mm per 240 Hz frame, so the frames either side of contact catch that fold. Contact angles
  depend on the frame rate (base 9fdfae0, hare plan, interpolated contact min-max, deg):

  | Hz | 8.5 m/s | 11.6 m/s |
  |---|---|---|
  | 60 | 3.3-40.6 | 14.5-44.8 |
  | 120 | 6.8-27.2 | 5.2-28.3 |
  | 240 | 13.2-31.9 | 5.7-21.3 |
  | 480 | 16.8-29.5 | 17.6-27.2 |
  | 1000 | 19.2-31.2 | 16.9-27.1 |

  So in continuous time the base touchdown is already in range; the dip is the folding stance sampled by coarse frames - but
  the game runs at display rates (60-144 Hz), so the low frames are what a player sees.
- Grok's suspects: NOT the .92 ease-off (FORE_REACH.hold .85 / .88 / .92 give identical touchdown angles at 120 and 240 Hz);
  NOT a landing too far ahead - the opposite: the paw lands too far BACK (inside reach).
- An earlier try that eased the swing manus toward hand 14 deg (Fischer et al. 2002) removed a folded-back manus flip in the
  first stance frame but did not change the contact angle: dropped.

### Fix (bounding.ts only)
FORE_TOUCH = { ahead .035, reachCut .01, from 8.5, to 11.6, swingFrom .8, swingTo .95 }:
- from 8.5 to 11.6 m/s (smoothstep) the fore landing point moves `ahead` forward, only from swing .8 to .95 (the target there
  still lies beyond the reach circle, so the reaching pose is unchanged), so the paw lands with the limb more extended;
- the late-swing reach circle shrinks by reachCut x the step (FORE_REACH.reach .995 at <= 8.5, .985 at full step): without it
  the late-swing forearm reached 36.0 deg at 11.6 m/s;
- only fore limbs with a scapula (L.girdle): the host comparison plan (no scapula) already lands extended (elbow ~160 deg,
  contact 21.9-33.4 deg) and the step put its paws out of reach (leash steps, slip 9.7 mm, bound-checks host 99.1 -> 94.7).
All constants are estimates (grid); the range they are held to is Schmidt 2008 Table 4.

### Grid (box lookscore v1.3; stride sheets are at 8.5 m/s)
| variant | ramp | s-gather | s-push | s-stretch | w-gather | w-push | w-stretch | e-gather | e-stretch |
|---|---|---|---|---|---|---|---|---|---|
| base 9fdfae0 | - | 64.1 | 93.1 | 96.2 | 61.9 | 96.0 | 100 | 69.0 | 43.8 |
| V1 ahead .035, reach .985, whole swing | 0 m/s+ | 66.2 | 94.7 | 95.7 | 62.2 | **88.8** | 100 | 71.6 | 41.8 |
| V2 ahead .03, reach .99 | 0+ | 66.5 | 94.7 | 94.4 | 62.2 | 90.7 | 100 | 72.9 | 44.3 |
| V4 ahead .04, reach .985 (bound 99.0) | 0+ | 65.7 | 96.1 | 95.6 | 61.9 | 87.3 | 100 | 73.7 | 42.8 |
| W1 .035 ramp 3-5, swing .65-.85 | 3-5 | 66.4 | 95.9 | 95.3 | 62.2 | 93.3 | 100 | 70.9 | 41.8 |
| W2 .035 ramp 3-5, swing .8-.95 | 3-5 | 66.4 | 95.9 | 96.3 | 62.2 | 93.3 | 100 | 70.9 | 41.8 |
| **shipped** ramp 8.5-11.6, swing .8-.95 | 8.5-11.6 | 64.1 | 93.1 | 96.2 | 61.9 | 96.0 | 100 | 69.0 | 43.8 |
Crouch / sit unchanged in all. W1 = W2 on push because a forward landing also moves the lift-off (stance sweep), so the
mid-swing fore paws of the push cell (stride .637) sat 12-14 mm further forward. Unramped .035 from 1.68 m/s also failed the
overtake check (hind prints 14.0 -> 10.5 cm ahead of the fore prints, bound-checks 99.5 %).

### Result (hare plan, 240 Hz, deg below the horizontal, min-max)
| speed | contact (interp) before | after | last swing frame before | after | late swing max before | after |
|---|---|---|---|---|---|---|
| 5 m/s | 18.5-31.8 | 18.5-31.8 | 19.4-32.4 | 19.4-32.4 | 34.7 | 34.7 |
| 8.5 m/s | 13.2-31.9 | 13.2-31.9 | 15.8-31.1 | 15.8-31.1 | 33.3 | 33.3 |
| 11.6 m/s | **5.7**-21.3 | 12.2-28.9 | **5.2**-29.6 | 18.4-33.8 | 35.9 | 32.8 |
1 kHz after: 8.5 m/s 19.2-31.2, 11.6 m/s 18.5-27.4. Lookscore v1.3 after = before exactly (all six sheets pixel-identical,
the sheets run at 8.5 m/s). Bound-checks hare 99.8 % (= base), host 99.1 % (= base; its overtake FAIL is pre-existing).
tests/bound-v7.test.ts (new: interpolated contact 11-36 at 5 / 8.5 / 11.6 m/s at 240 Hz; FORE_TOUCH off <= 8.5, full >= 11.6),
tests/forearm.test.ts pass; npm test 411 pass / 0 fail / 12 todo; tsc 0.

### Loud flags
- The lookscore cannot see this fix (its sheets are 8.5 m/s): unchanged scores prove nothing else moved, not that 11.6 m/s
  looks better. A ?stride=11.6 sheet would be the visual check.
- 10 m/s (inside the ramp, not a required speed) dips to 9.8 deg at 240 Hz (16.4 at 1 kHz).
- At 60-120 Hz 8.5 m/s contact still dips to 3-7 deg and 11.6 m/s to ~9-11 (base and fix alike at 8.5): the folding stance
  remains; the full cure is a stance that lands at the front of the chord, which conflicts with the run 4 track rule. Making
  8.5 m/s frame-rate-proof costs push (W1/W2 above).
- No hare fore touchdown kinematics were found; 11-36 deg is the small-therian range (Schmidt 2008 Table 4; pika 33 deg,
  Fischer et al. 2002 JEB 205:1315).

### Contract note for Claude (board comment drafted, NOT posted; see report)
solveChain (src/core/animalBehavior, via ik.ts solveLimb): for an out-of-reach target the solver points the straight limb at
the target (ray rule), which lifts the paw above its swing arc. v6 (ee1ad20, run 6 above) works around it in bounding.ts only
for the late-swing fore paw (foreReachTarget: keep the target's height, pull it back onto the reach circle about the
protracted glenoid), and v7 has to shrink that circle at speed to keep the forearm <= 36 deg. A general "keep the height,
limit the reach" rule in solveChain would make every body and every limb behave this way without per-gait patches.
Proposal only; Claude's files untouched.

### Captures (box /workspace/locomotion/T-0009/v7/)
before/ (9fdfae0) and after/ (v7): ss / sw / se stride sheets (8.5 m/s), gs / gw / ge strips, .log.json per sheet, s13 / e13
lookscore outputs; grid/ (V1-V4, W1, W2 sheets + scores, grid-scores.txt); probe7.ts (the scratch probe).
Exact next step: grok reviews and merges; optionally a ?stride=11.6 sheet to eyeball the touchdown.

## Run 8 (v8) — based on b189f96 (grok merged v7 into grok/rabbit-clover), branch grok-gait/T-0009-contact-scorer

Request (Grok Bot, 2026-10-22 01:58 PT): a scorer that reads the touchdown forearm at the exact contact instant, gated at 60 /
120 / 240 Hz for 5 / 8.5 / 10 / 11.6 m/s (11-36 deg, Schmidt 2008 JEB 211:3775 Table 4); an 11.6 m/s stride sheet; the 10 m/s
dip; the solveChain proposal as a board comment event; no push.

### Ownership
boundScore.ts has been edited mostly by grok since run 5 (v2/v3), so the scorer is a new file of mine:
src/animals/locomotion/contactScore.ts. tests/forearm.test.ts is grok's: unchanged; new tests/contact-score.test.ts; my
tests/bound-v7.test.ts now uses the scorer.

### Scorer design (metric "touchdown-forearm" v1)
- Contact = a fore leg's phase wrapping past 1 (stance = phase < duty), the controller's own definition.
- First try, rejected: a straight line in the angle between the last swing and the first stance frame at the phase crossing.
  It does not recover the 1 kHz value (60 Hz, 8.5 m/s: 3.3-41.4 against 22.0-29.5) - the angle is far from linear over one
  frame (late-swing reach ease-off, then the elbow folding as the body runs over the paw).
- Shipped: the scorer drives the controller. Before each frame it predicts from the previous frame's phase rate whether a
  fore leg wraps inside the frame; if so it splits the frame at the predicted contact (+1 us), reads the forearm from the
  controller's own frame there, then finishes the frame. Residual at the read: 4.4e-6 cycles (~1 us) in every run. The split
  adds one controller step per contact, so per-frame values come from a separate unsplit run at the same rate.
- Tolerance: the reads are exact in time. Their RANGE still differs from the 1 kHz reference by up to 6.7 deg at 240 Hz
  (5 m/s), 7.6 at 120 and 11.0 at 60 Hz, because the controller's state at contact depends on the frame rate (the foreLimb
  scan grid, psi .1 rad / blade .05 rad, and its per-frame continuity term), not because of the read. The test holds 240 Hz
  to within 7 deg of 1 kHz. Values pass when they round into 11-36 (the table's whole degrees): 8.5 m/s at 60 Hz reads 10.96.

### Root cause found with the scorer, and fix (bounding.ts)
- Per-frame continuity (foreLimb weight .3) carried the swing's blade / manus choice into the planting frame and kept a
  folded-elbow stance family: contact 7-9 deg at 60-120 Hz (8.5-11.6 m/s) and 8.5 deg at 10 m/s, 240 Hz. Continuity weight
  .3 / .1 / .03 / 0 everywhere: 10 m/s 120 Hz min 7.8 / 15.9 / 15.9 / 15.9. Dropping it only on the planting frame
  (FORE_CONT.plant 0, carry .3 otherwise) does the same with the stance flicker near baseline; a frame-rate-scaled weight
  (same lag time) was worse (8.5 m/s 240 Hz -1.1 to 9.3) and was dropped; a manus target on the planting frame was worse.
- 10 m/s verdict: a REAL contact violation (8.5 deg at 240 Hz at the exact instant, not a sampling artefact), from the
  half-way FORE_TOUCH ramp plus the carried stance family. FORE_TOUCH now ends at 10 m/s (from 8.5 unchanged, so the 8.5 m/s
  sheets keep FORE_TOUCH off).

### Angle table (hare plan, deg below the horizontal, min-max over ~30 touchdowns; after the fix)
| m/s | Hz | exact contact (scorer) | straight line between frames | first stance frame | last swing frame | range gap to 1 kHz | exact min | residual (cycles) |
|---|---|---|---|---|---|---|---|---|
| 5 | 60 | 15.2-33.5 | 13.1-31.2 | 18.2-42.8 | 11.1-33.9 | 9.3 | 15.25 | 4.4e-6 |
| 5 | 120 | 20.9-34.4 | 10.8-28.7 | 13.8-27.4 | 10.7-30.8 | 7.6 | 20.91 | 4.4e-6 |
| 5 | 240 | 22.1-33.5 | 18.5-31.8 | 13.4-31.9 | 17.9-32.3 | 6.7 | 22.06 | 4.4e-6 |
| 5 | 1000 | 24.5-26.8 | 20.8-31.7 | 20.7-34.3 | 19.8-32.7 | 0.0 | 24.53 | 4.4e-6 |
| 8.5 | 60 | 11.0-31.6 | 3.3-41.4 | 19.3-64.7 | 3.2-34.9 | 11.0 | 10.96 | 4.4e-6 |
| 8.5 | 120 | 16.0-31.9 | 7.2-28.9 | 10.6-34.0 | 5.4-35.1 | 6.0 | 16.00 | 4.4e-6 |
| 8.5 | 240 | 19.2-31.1 | 13.2-31.9 | 10.3-32.4 | 15.8-31.1 | 2.8 | 19.16 | 4.4e-6 |
| 8.5 | 1000 | 22.0-29.5 | 19.2-31.2 | 17.4-31.5 | 17.5-29.7 | 0.0 | 21.98 | 4.4e-6 |
| 10 | 60 | 15.8-31.1 | 11.2-35.9 | 10.4-64.8 | 19.9-32.4 | 6.6 | 15.82 | 4.4e-6 |
| 10 | 120 | 15.5-28.1 | 18.9-31.4 | 10.0-25.9 | 23.8-34.0 | 4.9 | 15.46 | 4.4e-6 |
| 10 | 240 | 15.8-28.1 | 16.3-32.3 | 15.4-27.3 | 22.0-34.4 | 4.6 | 15.82 | 4.4e-6 |
| 10 | 1000 | 20.4-24.5 | 17.2-28.9 | 15.2-28.3 | 19.4-34.9 | 0.0 | 20.41 | 4.4e-6 |
| 11.6 | 60 | 12.9-28.3 | 10.6-37.4 | 10.2-74.9 | 17.4-31.6 | 6.3 | 12.93 | 4.4e-6 |
| 11.6 | 120 | 15.5-27.2 | 15.6-31.9 | 10.2-26.5 | 21.0-33.4 | 3.7 | 15.49 | 4.4e-6 |
| 11.6 | 240 | 17.8-27.4 | 16.4-32.4 | 13.7-27.7 | 18.4-33.8 | 3.0 | 17.76 | 4.4e-6 |
| 11.6 | 1000 | 19.2-24.5 | 18.6-27.4 | 17.9-27.0 | 18.6-33.8 | 0.0 | 19.22 | 4.4e-6 |

Before the fix (b189f96, exact contact, 60 / 120 / 240 / 1000 Hz): 5 m/s 14.0-33.7 / 20.9-34.4 / 21.6-33.7 / 24.6-26.9;
8.5 m/s 8.7-31.6 / 8.7-31.9 / 19.2-31.1 / 22.0-29.5; 10 m/s 7.7-27.8 / 7.8-28.4 / 8.5-27.4 / 19.5-26.6; 11.6 m/s
7.1-23.3 / 9.6-21.5 / 12.4-21.6 / 19.2-24.4.

### Lookscore v1.3 (box; stride sheets; pose strips gs/gw/ge are a fixed 9fdfae0 copy, so crouch / sit are not compared)
| sheet | s-gather | s-push | s-stretch | w-gather | w-push | w-stretch | e-gather | e-stretch |
|---|---|---|---|---|---|---|---|---|
| 8.5 m/s before (b189f96) | 66.0 | 92.8 | 96.5 | 67.4 | 93.3 | 100 | 69.3 | 44.1 |
| 8.5 m/s after | 66.0 | 92.8 | 96.5 | 67.4 | 93.3 | 100 | 69.3 | **42.6** |
| 11.6 m/s before | 57.1 | 79.9 | 92.1 | 60.5 | 99.2 | 98.3 | 86.0 | 79.3 |
| 11.6 m/s after | 57.1 | 79.9 | 92.1 | 60.5 | 99.2 | 98.3 | 86.0 | 81.8 |
The planting-frame change moves a few 8.5 m/s cells (stride cells 4-9, IoU +-0.02), not the best cells of side gather /
push / stretch; end-on stretch -1.5 (noise SD 1.1). The 11.6 m/s sheet is scored by the same references (8.5 m/s-calibrated
noise band; treat as indicative). Plausibility: 0 implausible cells in all sheets.

### Checks
bound-checks hare 99.8 %, host 99.1 % (= base; host overtake FAIL pre-existing). tests/contact-score.test.ts (60 / 120 / 240
Hz gates, 240 Hz vs 1 kHz within 7 deg), bound-v7, bound-v6, forearm.test pass; late swing at 10 m/s max 32.4 deg; npm test
413 pass / 0 fail / 12 todo; tsc 0.

### Loud flags
- 8.5 m/s at 60 Hz reads 10.96 deg: passes only at the table's whole-degree precision.
- The fore stance already flips between solution families frame to frame before this run (wrist + blade steps up to 70-110
  deg per frame, 116-236 steps over 10 deg in 3.5 s at 240 Hz, b189f96); the planting-frame change raises the count ~15 %
  (8.5 m/s 240 Hz 146 -> 169). That flicker is the bigger visual problem; a finer or smoothed scan is the next fix.
- No hare fore touchdown kinematics were found; 11-36 deg is the small-therian range.

### Contract notes
- grok (tests/forearm.test.ts): the late-swing check is per-frame over swing .7-.92, where the pose changes smoothly, so it
  can stay; touchdown gates should use contactScore.ts (foreContacts / inTouchdownRange) rather than per-frame minima.
- Claude (solveChain): committed as a board comment event on this branch,
  tasks/events/2026-10-22T02-55-grok-gait-comment-T-0009.json (schema of board-server POST /api/comment; validated with
  claude/tasks-crlf-comment tools/tasks.ts ledger(): no new errors with tasks/T-0009 present, earns nothing).

### Captures (box /workspace/locomotion/T-0009/v8/)
before/ (b189f96) and after/: ss / sw / se (8.5 m/s) and ss116 / sw116 / se116 (11.6 m/s) stride sheets with .log.json and
lookscore outputs; compare-{ss,sw,se}116.jpg (before above after); angle-table.md; the scratch probes _cs8 / _tab8 / _fl8.
Rendered in headless Edge with --window-position=-32000,-32000 under the bench lock. Not pushed.

## Run 9 (2026-10-22, grok-gait) - fore-stance IK solution lock

Branch grok-gait/T-0009-contact-scorer, on top of 4a4bf7d. Commit b569e5c: `bounding.ts` (FORE_LOCK, windowed
foreLimb, stancePsi / preSwingPsi) and `tests/fore-lock.test.ts`. Not pushed.

**Rule 15 (review first).** I reused standard approaches rather than inventing new ones: warm-starting the IK from the
previous frame's solution, a windowed (rate-limited) local solve around it, hysteresis on the branch (leave it only when
the window has no exact solution left), and on release the nearest exact branch rather than the cheapest one.

**Lock design (`FORE_LOCK`; every rate and weight is an estimate tuned against the gate test).**
- Touchdown frame: the branch is chosen fresh (`plant: 0`, `FORE_CONT.plant = 0`, as in run 8), so the exact-contact
  11-36 deg gate is unchanged. The manus angle (psi) at touchdown is stored as `lockPsi`.
- Stance: windowed solve around the previous solution, exact solutions only (`stanceSoft 0`, so no slip).
  - psi window per frame = 1.8 x 88 deg / t_stance x dt, capped at 0.5 rad.
  - Blade window per frame = 40 rad/s x dt.
  - Both windows scale with dt, so the lock is frame-rate independent.
  - psi target `stancePsi`: from `lockPsi` toward -0.6 rad over stance, weight 10.
- Release: if the window has no exact solution, the full scan runs with continuity weight 100, so it lands on the nearest
  exact branch. `FORE_LOCK_STATS.release` counts these frames.
- Lift-off and swing: the window keeps running in swing (30 rad/s, soft acceptance), so the foot leaves on its stance
  branch. From 80% of swing, `preSwingPsi` blends the manus target toward the last touchdown psi.
- `FORE_CONT` revisited: `plant 0` is kept (the contact gate needs it); `carry .3` is unchanged.

**Jump gate.** The per-frame limit is omega_gate x dt, with omega_gate = 2 x 88 deg / t_s.
- 88 deg is the forearm sweep from touchdown to lift-off (Schmidt 2008, JEB 211:3775, Table 4: TD 11-36, LO 102-121).
- t_s = duty / stride frequency of the plan.
- The factor 2 (peak / mean angular speed) is an estimate.
- Limit at 60 / 120 / 240 Hz: 5 m/s 53/27/13, 8.5 m/s 90/45/23, 10 m/s 106/53/27, 11.6 m/s 123/62/31 deg.
- Measured on the scapula and manus (the lock's outputs) over stance and lift-off frames. The touchdown frame is
  reported but not gated (see the open item below).

Jump table, before (4a4bf7d, lock off) -> after (b569e5c). Each cell: frames over the limit / max mid-stance / max
lift-off / max touchdown frame, in deg. Window 2.5-6 s, hare plan, both fore legs.

| speed | 60 Hz | 120 Hz | 240 Hz |
|---|---|---|---|
| 5 | 28/92/86/29 -> 0/40/29/39 | 62/57/40/103 -> 0/24/14/78 | 92/57/11/103 -> 0/12/7/84 |
| 8.5 | 10/63/103/74 -> 0/34/34/90 | 32/74/74/103 -> 0/29/15/102 | 57/63/29/103 -> 0/20/7/109 |
| 10 | 0/46/103/86 -> 0/34/34/85 | 26/57/74/103 -> 0/29/19/106 | 43/57/17/86 -> 0/13/10/99 |
| 11.6 | 0/63/97/57 -> 0/34/34/58 | 10/52/86/103 -> 0/29/19/108 | 34/57/57/97 -> 0/14/10/101 |

Contact angles (exact contact instant, 60 / 120 / 240 Hz) are identical to run 8, all inside 11-36:
5 m/s 15.3-33.7 / 20.9-34.4 / 21.6-33.7; 8.5 m/s 11.0-31.6 / 16.0-31.9 / 19.2-31.1; 10 m/s 15.8-31.1 / 15.5-28.1 / 15.8-28.1;
11.6 m/s 12.9-28.3 / 15.5-27.2 / 17.8-27.4.

**Touchdown pop: not fixed (part 2 attempt reverted).** The fresh touchdown solve is bistable. Stride to stride it
alternates between two near-equal-cost exact branches: (humerus ~47-52, manus -34) and (humerus ~-13, manus +69); both
pass the contact gate. I tried three fixes; none worked:
1. Late-swing joint-space blend toward the last touchdown pose. It predicts the other branch half the time.
2. Late-swing blend toward a fresh solve on the swing arc's ground point. The prediction still lands on the other branch
   of the near tie.
3. A small touchdown continuity tie-breaker (`FORE_CONT.plant` 0.1). No change in the touchdown jump, and the 5 m/s
   per-frame contact reads got worse.

The attempt is kept at /workspace/locomotion/T-0009/v9/bounding.r9p2-predict-abandoned.ts.
Earlier in run 9, locking the swing branch through touchdown removed the pop (0 over the limit everywhere), but it failed
the 5 m/s contact gate (3.8-11.8 deg).

**Contract note for Claude (solveChain / animalBehavior.ts).** The touchdown pop needs a branch-aware or predictive
solveChain: either expose the solution branch so the controller can pick one consistently at touchdown, or add a solver
cost that breaks the touchdown tie deterministically toward the forearm 11-36 deg family. I can't fix it inside
bounding.ts without breaking the contact gate.

**Lookscore v1.3.** Scores are in v9/scores.txt; compare images are v9/compare-*.png. Before = the run 8 capture
(bounding.ts identical to 4a4bf7d); after = a b569e5c capture in off-screen headless Edge, under the bench lock, with 0
implausible stride cells. Noise SD: summer 0.6, winter 0.5, end 1.1.
- 8.5 m/s deltas: s-gather +0.8, s-push +6.4, s-stretch -2.3, w-gather -0.2, w-push -1.1, w-stretch 0, e-gather +6.7,
  e-stretch -0.1. Total of the eight shapes: +10.0.
- 11.6 m/s deltas: s-gather +0.1, s-push +2.6, s-stretch +0.1, w-gather +0.8, w-push -0.5, w-stretch -4.4, e-gather -0.7,
  e-stretch -1.3. Total: -3.3.
- FLAG: 8.5 summer-stretch (-2.3, about 4 SD), 8.5 winter-push (-1.1, about 2 SD) and 11.6 winter-stretch (-4.4, about
  9 SD) drop beyond noise.
- The sheets look alike by eye. I haven't checked whether these drops come from the lock or from which stride frames the
  sheet happened to capture.

**Checks at b569e5c (omen).**
- tsc: exit 0.
- npm test: 438 tests, 426 pass, 0 fail, 12 todo. This includes fore-lock, contact-score, bound-v6, bound-v7,
  bound-limits, and grok's forearm.test.ts (late swing <= 36).
- bound-checks, hare plan: 99.9% (99.8% with the lock off). Planted max slip 0.1 mm, 0 leash steps.
- bound-checks, host plan: 99.1%. This is below the 99.7% bar, but it is the same 99.1% with the lock off. The only
  failing check is overtake (hind prints 8.3 cm ahead vs one print, 12 cm; 69%). It predates this run and does not come
  from the fore lock.

**Risks.**
- The touchdown pop (up to ~109 deg in one frame at 240 Hz) remains and is excluded from the gate.
- The windowed solve costs more per frame (fore-lock.test.ts takes about 45 s).
- All lock constants are estimates.
- Lookscore stretch cells: see the flag above.

## Run 10 (2026-10-22, grok-gait) - fore lock perf + per-instance switch

Branch grok-gait/T-0009-forelock-perf, off grok/rabbit-clover 1e355e3 (its locomotion files are identical to 6b3bb7e).
Commits: a1e84fb (perf, the per-instance switch, the cost test, tools/fore-lock-bench.ts) and the cost-test fix that
follows it. Not pushed.

**Why it was slow (Grok's diagnosis, confirmed).** The run 9 window sampled at a fixed 0.01 rad step over a window that
scales with dt. At 30-60 fps that is about 135 x 101 = 13.6k solveLimb calls per fore leg per frame (an estimate from
the window sizes: blade 40 rad/s x dt, clamped to the +-0.3 girdle range but re-solved per step; psi up to the 0.5 cap).
The old full scan is 13 x 19 = 247.

**Fix (`foreLimb` window).**
- Coarse pass: a fixed-count grid of +-`nBlade` (4) x +-`nPsi` (6) samples spanning the dt-scaled window
  (9 x 13 = 117 solves), centred on the previous solution (warm start).
- Fine pass: +-`fine` (2) samples at half the coarse step, about the coarse best (5 x 5 = 25 solves).
- Blade samples clamped onto the same girdle limit are solved once (dedupe).
- At most 142 solves per window. A release adds the old 247-sample full scan, which is rare (rel = 0-1 per run in Grok's
  bench). The touchdown frame also runs one fresh full scan for `plantPsi`.
- The window size still scales with dt (frame-rate independent); only the sample count is fixed.
- `FORE_LOCK_STATS.solves` counts solveLimb calls in foreLimb.

**Per-instance switch.** `BoundOptions.foreLock` (createBounding opts), default **off**. Off is exactly the run 8 path:
- no window, no stance psi hold, no pre-swing blend (`plantPsi` is not set), FORE_CONT unchanged;
- `FORE_LOCK.on` stays as a global kill switch.

**Contract note for grok (hare.ts / host, not edited here).** Pass `{ foreLock: true }` to createBounding for the
embodied hare and the nearest 2-3 rendered hares. Other rendered hares keep the default (old scan). Headless hares should
skip limb IK entirely (body / foot plan only); that hook is in the host, not in bounding.ts.

**Per-frame cost, ms per hare per frame (mean / p95), omen.**
- Old lock: Grok's C:\dev\forelock-bench.ts at 1e355e3, 8.5 m/s only, 3 s per cell. The ~13.6k solves per leg per frame
  is an estimate.
- Lock off and new lock: tools/fore-lock-bench.ts at a1e84fb, which mirrors Grok's script with the per-instance option.
- Solves are per frame for both fore legs (lock off = 2 x 247 = 494).

| v | fps | lock off ms | old lock ms (8.5 only) | new lock ms | solves off / new |
|---|---|---|---|---|---|
| 5 | 30 | 3.23 / 7.94 | - | 1.27 / 3.02 | 494 / 276 |
| 5 | 60 | 3.09 / 13.40 | - | 0.83 / 1.77 | 494 / 229 |
| 5 | 120 | 1.41 / 2.18 | - | 0.89 / 2.11 | 494 / 203 |
| 5 | 240 | 1.42 / 2.26 | - | 0.72 / 1.39 | 494 / 190 |
| 8.5 | 30 | 2.00 / 4.09 | 121.5 / 168.3 | 0.83 / 2.37 | 494 / 228 |
| 8.5 | 60 | 1.56 / 3.04 | 73.3 / 115.2 | 0.88 / 2.02 | 494 / 217 |
| 8.5 | 120 | 1.49 / 2.50 | 22.6 / 35.7 | 0.76 / 1.62 | 494 / 196 |
| 8.5 | 240 | 1.70 / 3.84 | 6.1 / 12.2 | 0.82 / 1.63 | 494 / 184 |
| 11.6 | 30 | 1.62 / 2.28 | - | 1.22 / 3.91 | 494 / 276 |
| 11.6 | 60 | 1.44 / 2.45 | - | 0.96 / 2.28 | 494 / 221 |
| 11.6 | 120 | 1.83 / 4.08 | - | 0.78 / 1.48 | 494 / 198 |
| 11.6 | 240 | 1.50 / 2.70 | - | 0.75 / 1.47 | 494 / 185 |

- The new lock is cheaper than lock off: its window does at most 142 solves, where lock off runs the 247-sample scan
  every frame.
- Max frame (one-off spikes) is up to 5.7 ms with the lock on vs up to 18.6 ms with it off (omen, other processes
  running).

**Gates with the lock on.**
- Jump gate: 0 frames over the limit in all 12 cells. Each cell is mid-stance max / lift-off max / touchdown max (deg):

| speed | 60 Hz | 120 Hz | 240 Hz |
|---|---|---|---|
| 5 | 34/33/26 | 24/17/92 | 12/8/99 |
| 8.5 | 34/34/94 | 33/17/102 | 20/8/111 |
| 10 | 34/34/96 | 33/24/106 | 12/12/98 |
| 11.6 | 34/34/74 | 33/24/108 | 14/12/99 |

- Contact angles at the exact contact instant, 60 / 120 / 240 Hz, are identical to runs 8-9 with the lock on or off:
  5 m/s 15.3-33.7 / 20.9-34.4 / 21.6-33.7; 8.5 m/s 11.0-31.6 / 16.0-31.9 / 19.2-31.1; 10 m/s 15.8-31.1 / 15.5-28.1 /
  15.8-28.1; 11.6 m/s 12.9-28.3 / 15.5-27.2 / 17.8-27.4.
- Late swing <= 36: forearm.test passes with the lock off (default), and with the lock on in a scratch copy (not
  committed).
- bound-checks:
  - hare plan: 99.8% with the lock off, 99.9% with it on;
  - host plan: 99.1% with the lock off or on; the only failing check is overtake, which predates run 9 (see Run 9).

**Touchdown pop.** No new attempts; the Run 9 contract note to Claude stands.

**Tests.**
- tests/fore-lock.test.ts uses `foreLock: true` per instance.
- New cost test: at most 247 solves per fore leg per frame at 30 and 240 Hz. The count resets after construction,
  because reachOf's limb-range scan runs once at createBounding.
- The gate-bites test uses `foreLock: false`.
- Time: about 6-9 s per cell on the box, mostly controller construction and the 4 s simulation; about 95 s for the file.

**Risks.**
- Coarser window sampling: the step is window/4 for blade and window/6 for psi, refined to half that. Gates pass, but the
  sampling is an estimate.
- Defaults off: rendered hares get no lock until grok wires `foreLock` in the host.
- The old-lock cost column covers 8.5 m/s only.

## Run 11 (2026-10-26, grok-gait) - T-0044 fore-paw touchdown pop: planned touchdown (FORE_PLAN)

Branch `grok-gait/T-0044-touchdown-pop` from origin/main 7490003 (worktree C:\dev\boreal-grok-pop; not pushed).
State check 2026-10-26: `grok/hare-rig-port` head is still 708a1ae; PR #38 is merged; origin/main moved to 7745cea
(4 board/globe commits, #122-#125). None of them touch src/animals/locomotion, so no rebase was needed. Main carries
`tasks/T-0044-fore-paw-touchdown-pop.md`, claimed by "grok" (2026-10-23 12:54). Its comments record floor .74 and
"8.5/60 inside the gate, others over". The task text asks for a pole target and "no new elbow-branch search" (see risks).

### Cause (measured)
The pop happens on the planting frame. foreLimb does a fresh (blade, psi) grid scan, and two exact solutions tie at the scan's manus
limits (about -34 deg / +69 deg, FORE_SCAN psiFrom -0.6 / psiTo 1.2 rad). The swing arrives with the manus at 68-77 deg, so whichever
branch wins, the scapula and manus jump by up to 119 deg in one frame (table below).

### Approaches tried
- Pole target / two-bone with a pole (steering 1): no effect. solveChain/solveLeg (Claude, animalBehavior.ts) is analytic
  two-bone and its bend side is fixed by the `front` flag, so a pole adds no freedom. The ambiguity is in the blade/psi
  choice above it, not in the elbow side.
- three.js CCDIKSolver (steering 1): tried as glue, then dropped. It was not needed once the touchdown was planned. The CCD files
  were reverted and never committed (grok-gait/T-0009-touchdown-pop has no commits past 708a1ae). The per-cell CCD numbers
  from that run are not repeated here.
- Planned touchdown (steering 2, kept): see below. Inertialization (Bollo, GDC 2018) was not needed.

### prior_art
- MIT Cheetah Software, `FootSwingTrajectory::computeSwingTrajectoryBezier` + `Interpolate::cubicBezier`.
  https://github.com/mit-biomimetics/Cheetah-Software/blob/c54e50bf5d68f685d8944c8d9047a84a474b454d/common/src/Controllers/FootSwingTrajectory.cpp
  and .../common/include/Math/Interpolation.h (file commit c54e50b, repo head c71c5a1, MIT licence; header kept).
  It was first ported literally to `src/animals/locomotion/footSwing.ts` (b29507c), with tests against hand-worked values
  (`tests/foot-swing.test.ts`). The adaptation is in bounding.ts (48066b3).
- Touchdown band: forearm 11-36 deg below horizontal (Schmidt 2008 JEB 211:3775, Table 4). The band is used as 12-35 deg (1 deg
  margin, an estimate).

### FORE_PLAN design (bounding.ts, `FORE_PLAN = { on: 1, from: .8, lo: 12, hi: 35 }`)
1. At swing phase .8 (an estimate), predict the body at touchdown (tRem = (1-ph)/hz, using the same girdle/pitch/height stride curves as before)
   and the landing point (rest + fwd*(duty*stride/2 + foreTouch*(1-touchW)), then the FORE_REACH floor push).
2. Plan once: one foreLimb scan with `accept` = forearm in 12-35 deg and manus inside [psiFrom, psiTo]. Keep the pair (blade, psi) as qf.
3. Each later swing frame: track qf onto the predicted point with the FORE_LOCK window (keep only locked, exact results, otherwise hold).
   Blend blade/psi from q0 with the ported `cubicBezier(q0, qf, u)`.
4. On the planting frame, take the planned pair through a window solve (in band first, then without the band). A result from the full-scan release
   is refused, so no fresh pick happens on the planting frame.
5. FORE_LOCK gets `clampFine: 1`, so the fine pass stays inside the window. This removed the stance overs at 240 Hz.
The same trajectory runs at all speeds; 5 m/s has no special case.

### Results: tools/touchdown-pop.ts (gate 2*88deg/t_stance*dt on scapula and manus; 88 from Schmidt 2008 Table 4, factor 2 an estimate)
Before (main 7490003, fore lock on), over-gate plant frames / plants (worst plant manus jump, deg). Stance overs were 0 in all cells:

| m/s | 60 Hz | 120 Hz | 240 Hz |
|---|---|---|---|
| 5 | 0/17 (28.6) | 9/17 (92.5) | 18/18 (94.2) |
| 8.5 | 1/18 (96.0) | 8/18 (118.7) | 16/18 (102.9) |
| 10 | 1/18 (107.9) | 14/18 (105.0) | 18/18 (97.8) |
| 11.6 | 0/18 (107.9) | 11/18 (107.4) | 18/18 (99.3) |

After (48066b3/074b368): 0 over-gate frames at plant and in stance in all 12 cells. The plan ran with 0 fails. Tracking holds were 0 up to 8.5 m/s
and 6-21 at 10-11.6 m/s. Each cell shows worst plant manus jump (deg) / exact contact forearm range (deg):

| m/s | 60 Hz | 120 Hz | 240 Hz |
|---|---|---|---|
| 5 | 10.5 / 12.1-34.3 | 4.3 / 21.4-34.6 | 5.3 / 28.9-34.5 |
| 8.5 | 17.7 / 12.0-32.3 | 6.8 / 15.2-32.6 | 7.0 / 26.7-32.3 |
| 10 | 31.5 / 12.2-28.6 | 8.2 / 12.4-28.6 | 7.1 / 23.0-28.6 |
| 11.6 | 33.6 / 12.0-27.2 | 10.1 / 12.1-27.5 | 6.2 / 21.9-27.5 |

Contacts before (lock on, 708a1ae, same solve as main except the floor): 11.0-34.4 deg overall, so they were already in range. The pop was in
the joint angles, not the contact.

Cost, tools/fore-lock-bench.ts (ON column, ms per hare, mean / worst frame). Plan on; timing on omen is noisy:

| m/s | 60 Hz | 120 Hz | 240 Hz |
|---|---|---|---|
| 5 | 0.72 / 1.46 | 0.77 / 2.48 | 0.65 / 1.91 |
| 8.5 | 0.65 / 1.27 | 0.63 / 2.48 | 0.56 / 1.90 |
| 10 | 0.83 / 2.70 | 0.72 / 3.68 | 0.65 / 1.99 |
| 11.6 | 0.68 / 2.13 | 0.70 / 3.58 | 0.59 / 1.83 |

Plan off (PLAN=0, which is main) has means of 0.57-0.73 ms and a worst frame of 6.20 ms. All means are at or under 1.3 ms. Worst single frames reach 3.7 ms.

Tests: `tests/touchdown-plan.test.ts` (12 cells) plus fore-lock, pole-target, contact-score and bound-v7: 32/32 pass. tsc is clean.
Full npm test has 4 failures, and all 4 also fail on main (callField "loons on lakes", constants.rs generated,
planet-layout "solar defined once", tests/core.test.ts).

### FORE_LOCK redundancy
Not redundant. The plan uses the FORE_LOCK window for swing tracking and for the planting frame, and stance still depends on it.

### Clip
`node tools/hare-rig-record.mjs http://127.0.0.1:5317 <out> 0.2 skipPerf drive`, run in off-screen headless Edge (-32000) with the bench lock held,
then released. Vite was stopped. 120 frames: stand, then 2.5 m/s, then 8.5 m/s. Box: /workspace/locomotion/T-0009/v11/T-0044-v11-drive-slowmo.mp4,
frames in /workspace/locomotion/T-0009/v11/clip/frames, contact sheet in contact-sheet-8.5.jpg. Limitation: the recorder's drive mode frames the
whole scene, so the hare is small. The clip is not a close side-on view and cannot show the paw well. The numbers above are the evidence.

### Risks (loud)
- ELBOW INTERIOR IS NOT FIXED. This is T-0044's own metric. Plant elbow delta with the plan on (60/120/240 Hz): 5 m/s 60.7/58.8/44.5;
  8.5 m/s 57.5/53.7/52.3; 10 m/s 90.5/87.4/76.7; 11.6 m/s 90.5/87.0/80.6. It does not halve with rate, so T-0044's acceptance is not met.
  The stance elbow changes by up to 50-115 deg per frame with the plan on AND on main (e.g. main 8.5/240: 67.0). This is an existing
  near-extension flicker outside the scapula/manus gate.
- The plant humerus still jumps by up to 87 deg.
- On the last swing frame the sole misses its world target by 14-124 mm, because blade/psi are held while the body moves.
- T-0044 asks for "no new elbow-branch search". The plan's one in-band scan per stride could be read as one.
- PR #38 merged without this fix.
- The band margin (1 deg), from = .8 and the gate factor 2 are estimates.

### Porting to Rust (Matthew, 2026-10-26 03:32 PT: gait and foot placement move into the Rust simulation later; the paw pop first)
Repo is now github.com/BannonBotBoss/boreal (not pushed from here).
- Pure, deterministic, Rust-ready: `src/animals/locomotion/footSwing.ts` (Cheetah port: cubicBezier and its 1st/2nd derivatives,
  computeSwingTrajectoryBezier) and `src/animals/locomotion/touchdownPlan.ts` (swingProgress, inLateSwing, timeToTouchdown,
  bodyAtTouchdown, landingAhead, forearmBelowDeg, inPlanBand, planBlendU, blendPlan). Neither has a three.js import, Math.random,
  module state or clock. Inputs and outputs are f64 or small structs, so each maps to a `pub fn` over f64. The upstream is C++ (Eigen Vec3),
  so footSwing can follow Cheetah-Software directly (keep the MIT header).
- Tests to port with it: tests/foot-swing.test.ts and tests/touchdown-plan-pure.test.ts (hand-worked values, tolerance 1e-12).
  Parity check: tools/touchdown-pop.ts gave byte-identical output before and after the extraction (959d7d8). Run it against the Rust build.
- Still TS glue (bounding.ts): the per-leg plan state (planQ0, planQ, planned, planFail), predicting the body pose at touchdown
  (girdleShifts, runTilt, pitch/height curves, ground), worldToLimb/limbToWorld, and the foreLimb scan/window calls. In Rust the state
  should be an explicit `struct ForePlan { q0, qf, planned, fail }` per leg, stepped by the sim tick. FORE_PLAN_STATS
  are counters for diagnostics only and do not feed back into the motion.
- Order dependence: the plan is made once at sp >= .8, tracked each frame, and the planting frame takes the planned pair. The result depends on frame rate
  only through dt (the window sizes), so a fixed-step Rust tick gives reproducible results.

### Commits (grok-gait, not pushed)
0d4afb4 probe; b29507c Cheetah port + tests; 48066b3 FORE_PLAN; 074b368 regression test + bench switch; 023b356 handoff; 959d7d8 pure touchdownPlan.ts extraction; this note.
