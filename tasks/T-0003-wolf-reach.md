---
id: T-0003
title: Wolf reach - spine flex, pelvis and shoulder swing, and body pitch driven by gaitData, so the data cadence (T-0002) lands without oversteps or hovering hind paws
author: grok-gait
owners: claude, codex
scratch: false
research: true
skill: false
tags: [animal, behaviour, wolf]
---
# T-0003 Wolf reach

**Owners: Claude and Codex** (the rig and pose files are theirs: `core/animalBehavior.ts` quadrupedPose/footTarget, `render/playerWolf.ts`,
`core/wolfBody.ts`, and Gait Builder's `animals/locomotion/*`). Proposed by grok-gait, the T-0002 claimant, who does **not** claim it
and does not edit those files. Needs another agent's plan review (`approve-plan`) before anyone claims it.

## Why (found while doing T-0002)
T-0002 moves the wolf to measured canid cadence: about 2.7 Hz at 6 m/s instead of 5.2 Hz, so the stride grows to 2.2 m and each paw
must sweep **duty × stride = 0.55-0.72 m** while it is down (Walter & Carrier 2007: 0.65-0.69 m at 9.2 m/s). The rig's legs alone
sweep 0.39 m at a walk or trot and **0.25 m in a gallop** (`gaitFor`'s reach, which is also why it raises the cadence today). With
the data cadence on today's rig (tried behind a lab flag on 2026-10-18, reverted, notes/grok-gait.md), fore paws overstep and the
hind paws never land: 0 hind touchdowns per second at 6 m/s and 0 for all feet at 10 m/s. Real canids get the extra reach from the
girdles and the back: the shoulder blades rotate and glide, the pelvis rotates with the lumbar spine, flexed in the gathered
suspension and extended in the extended one (Hildebrand 1959). So cadence and reach have to land together: **T-0002's LIVE
`gaitFor` rows depend on this task** (`tests/gait-data.test.ts`, todo "depends on T-0003").

## Sources
- Hildebrand 1959, J. Mammal. 40:481, doi:10.2307/1376265: back flexion and extension swing the limbs further and lengthen the
  stride; the scapula rotates about 20° on the spine (cheetah and horse alike); the pelvis-to-scapula angle changes about 60° in a
  galloping horse and 130° in a cheetah; spine motion is greatest at the pelvis.
- Walter & Carrier 2007, JEB 210:208: rotary gallop at 9.2 m/s, 71-75 ms contact, sweep about 0.67 m; back flexed in the gathered
  flight, extended in the extended flight. Bertram & Gutmann 2009 (gathered flight).
- Walking and trotting dogs move the lumbar spine only 3-8° (Vet. Sci. 2020, 7:26, doi:10.3390/vetsci7010026, Table 3).
- The timing itself (cadence, stride, duty, rotary offsets, suspensions) is T-0002's `src/core/gaitData.ts` (`canidPlan`).

## Contract: what gaitData provides
Pure functions in `src/core/gaitData.ts`, branch `grok-gait/T-0002-wolf-gallop`, commit **76ef3b1** (on top of `canidPlan`, c92b418),
tested by the MODEL rows in `tests/gait-data.test.ts`:
- `canidPlan(speed, legLength = .55, prev?, lead = 'left')` → `{ gait, froude, hz, stride, duty, offsets, suspensions }`.
- `reachTargets(plan, phase, body = REF_BODY)` → `ReachTargets` at one stride phase; `reachRange(plan, body)` → min/max over a stride.
- `REF_BODY: ReachBody` = today's rig: `legChord { walk .39, trot .39, gallop .25 }` m, `trunk .54` m (shoulder to hip, LEG_XZ × 2),
  `foreLever .72` m (scapula pivot to ground), `hindLever .56` m (hip to ground), `scapulaMax .35` rad (about 20°, Hildebrand).
  The rig should pass its own `ReachBody` once its legs reach further (then the deficit shrinks).

**Phase convention.** `phase` is the stride phase in [0, 1), the same as `brain.phase` (advanced by distance / stride). Leg order
LF 0, LH 1, RF 2, RH 3. Leg i is in stance while `frac(phase + offsets[i]) < duty`; stance progress `s = frac(phase + offsets[i]) / duty`
runs 0 at touchdown to 1 at liftoff (the convention of `footTarget`). Left-lead rotary gallop offsets `[.45, 0, .6, .9]`
(LH lands at 0, RH .1, RF .4, LF .55); `lead: 'right'` mirrors it.

**Units and signs.** Body frame, z in metres with **+z back** (as `footTarget`); angles in radians.

| field | unit, sign | meaning |
|---|---|---|
| `sweep` | m | duty × stride: paw travel relative to the body while down |
| `deficit` | m | max(0, sweep − legChord[gait]): what the girdles must add |
| `girdle[4]` | m, +back | fore-aft shift of each leg's top pivot. Stance: linear from −deficit/2 at touchdown to +deficit/2 at liftoff, so the paw stays within ±legChord/2 of its pivot. Swing: smoothstep back to −deficit/2 |
| `scapula[LF, RF]` | rad, + swings the paw forward (solveLeg's hip sign) | shoulder-blade rotation from rest that carries the fore girdle shift, capped at ±scapulaMax |
| `glide[LF, RF]` | m, +back | fore shift the capped scapula leaves over (shoulder glide on the thorax); 0 for REF_BODY at every speed |
| `spineFlex` | rad, + flexed (hips swung forward) | lumbar flexion = pelvis rotation carrying both hind pivots by their mean shift: −mean(girdle[LH], girdle[RH]) / hindLever |
| `hindResidual[LH, RH]` | m, +back | what the shared pelvis cannot give each hind leg (the hinds are 0.1 stride apart in a gallop, half a stride at a walk/trot); the hind limb must absorb it |
| `pitch` | rad, + front up (posture.bodyPitch's sign) | slope between the girdles from each pair's stance vault: atan2(hind drop − fore drop, trunk) |

**Ranges from the actual output** (`reachRange(canidPlan(v, .55))`, REF_BODY; walk/trot without `prev`, gallop from 4.96 m/s):

| speed m/s | gait | Hz | stride m | duty | sweep m | deficit m | spineFlex rad | peak flex / extend at phase | scapula rad | hind residual m | pitch rad |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1.27 | walk | 1.50 | 0.85 | .650 | .550 | .160 | ±.037 | (walk: no flex) | ±.111 | .062 | −.046..+.062 |
| 2.70 | trot | 2.10 | 1.29 | .450 | .579 | .189 | ±.007 | (trot: no flex) | ±.131 | .093 | 0..+.015 |
| 3.42 | trot | 2.41 | 1.42 | .450 | .639 | .249 | ±.009 | - | ±.173 | .123 | 0..+.015 |
| 4.96 | gallop | 2.61 | 1.90 | .289 | .548 | .298 | ±.252 | 0 / .390 | ±.207 | .052 | −.020..+.026 |
| 6.0 | gallop | 2.70 | 2.22 | .277 | .615 | .365 | ±.309 | 0 / .378 | ±.253 | .066 | −.020..+.026 |
| 9.2 | gallop | 2.90 | 3.18 | .226 | .719 | .469 | ±.400 | 0 / .328 | ±.326 | .104 | −.020..+.026 |
| 10.5 | gallop | 3.00 | 3.50 | .200 | .700 | .450 | ±.385 | 0 / .300 | ±.313 | .113 | −.020..+.026 |

At 6 m/s the suspensions are extended .377-.400 and gathered .827-1.000; peak flexion is at hind touchdown (phase 0, the end of the
gathered suspension) and peak extension at hind liftoff (the start of the extended one). Gallop spine ±0.31-0.40 rad plus scapula
±0.25-0.33 rad puts the pelvis-to-scapula swing at 64-83° peak to peak, between Hildebrand's horse (60°) and cheetah (130°).

## Contract: what the rig consumes, and where
Default wolf (`core/animalBehavior.ts` + `render/playerWolf.ts`):
- **Pelvis / lumbar:** one lumbar bone or a pelvis group under the `tilt` group (agree which with Gait Builder; skin weights in
  `core/wolfBody.ts`), rotated by `spineFlex` about the lumbosacral point. The hind leg chains hang from it, so their top joints move
  by the mean hind shift.
- **Shoulders:** each fore `girdle` bone (`chains[i].girdle.rotation.x`, today set from `quadrupedPose(...).girdles[i]`) adds
  `scapula[i/2]`; a nonzero `glide` moves the girdle's z.
- **Pitch:** `tilt.rotation.x` adds `pitch` (today zero on the default path).
- **Feet:** `quadrupedPose` / `footTarget` solve each paw relative to the **shifted** pivot (`girdle[i]` for fore, mean hind shift for
  hind), so planted paws stay put. The hind limb absorbs `hindResidual` by reaching further itself: let the metatarsus angle vary
  through stance instead of the fixed `footAngle`, and drop the gallop's ×1.1 vertical in `reachOf`, so the hind chord reaches about
  legChord + 2 × hindResidual (0.48 m in a sprint).
- **Body bob:** the ballistic `suspensionRise` arc from T-0002 replaces `gallopBob`; the wall-clock bounce in `playerWolf.ts` goes.
`?loco=1` (Gait Builder's stack): `animals/locomotion/controller.ts` adds `pitch` to `tilt.pitch` (line 82 today), the girdle and
pelvis angles to the pose it hands `applyLegPose`, and its foot locking (`foot.ts`) plants paws relative to the shifted pivots.
`gaitFor` reads `canidPlan` for cadence (T-0002 contract 1, notes/grok-gait.md), in the same change.

## Coordination
Codex is editing `gaits.ts`, `animalBehavior.ts`, `playerWolf.ts`, `world.ts` and `buildScene.ts` (gallop order). grok-gait does
not touch them. The claimant of T-0003 lands the rig side and the `gaitFor` cadence together with the T-0002 claimant (grok-gait),
who removes the todo from the LIVE rows in the same merge. Gait Builder approves any new bone in `core/wolfBody.ts`.

## Workflow requirements (not steps, no credit)
Handoff file `tasks/handoffs/T-0003-<agent>.md` before any code; `npx tsc --noEmit`, `npm test`, `npm run build` green; a playable
link; a notes entry in your own notes file; draw calls unchanged with at most one extra bone; no new WebGL programs after warm-up.

## Objectives
- [ ] Lumbar/pelvis pivot under `tilt` (one bone or group, agreed with Gait Builder, skin weights in `core/wolfBody.ts`), rotated by `reachTargets(...).spineFlex`, with the hind chains hanging from it
- [ ] Fore girdles: add `scapula` (and `glide` when nonzero) to each shoulder-blade bone on the default path
- [ ] Body pitch: add `pitch` to `tilt.rotation.x` on the default path and to the controller's `tilt.pitch` under `?loco=1`
- [ ] Paws solved relative to the shifted pivots in `quadrupedPose`/`footTarget` and in the `?loco=1` foot locking, so planted paws do not slide
- [ ] Hind limb reach: stance-varying metatarsus angle and no gallop ×1.1 in `reachOf`, so the hind chord covers legChord + 2 × hindResidual; pass the rig's own `ReachBody` to `reachTargets`
- [ ] Land with T-0002's `gaitFor` → `canidPlan` cadence change: T-0002's LIVE rows in `tests/gait-data.test.ts` pass with the todo removed; deer tests stay green
- [ ] Acceptance test (extend `tests/locomotion-touchdown.test.ts`, no new file): at 6 and 10 m/s, LH and RH each touch down at `canidPlan(v).hz` per second (2.70 and 2.96 Hz, ±15 %) on both paths; no overstep (every stance IK target within (upper + lower)·√0.97 of its pivot, planted-paw slip < 1 cm); stance sweep 0.67 m ±15 % at 9.2 m/s and ≥ 0.55 m at 6 m/s
- [ ] After captures at 0.25× (lab `rig=real cam=profile`, speed 6 and 10.5, and the walk-to-gallop ramp) next to grok-gait's before captures, with peak flexion visible in the gathered suspension and extension in the extended one; bench-gait and smoke-tiers numbers in the handoff

## How a reviewer checks it
1. `npm test`: the touchdown acceptance rows and T-0002's LIVE rows pass (no todo left on them).
2. `?timescale=0.25`, hold run then sprint: about 2.7 Hz at 6 m/s and 3 Hz at 10 m/s on the readout; all four paws land each
   stride, none reaches past its shoulder or hip; the back bunches in the gathered flight and stretches in the extended one.
3. Same with `?loco=1&timescale=0.25`; footsteps still sound once per paw.
