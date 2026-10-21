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
  tasks/events/2026-10-21T14-30-grok-gait-comment-T-0009.json.
- [ ] (4) split hind foot + knee range
- [ ] (1) fore reach, level trunk
- [ ] (2) 11.6 m/s contact source
- [ ] (3) in-place stepping turn
- [ ] re-score, captures, tsc + npm test
