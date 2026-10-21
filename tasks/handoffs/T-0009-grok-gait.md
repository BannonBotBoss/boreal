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
- [ ] (3) joint limits as data  - [ ] (1) pitch  - [ ] (2) reach budget + source check  - [ ] re-score  - [ ] captures
- [ ] tsc + npm test  - [ ] notes in both handoffs
