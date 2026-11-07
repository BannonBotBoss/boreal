---
id: T-0002
title: Wolf gallop - cadence tied to speed from canid data, walk-trot-gallop transitions with a real flight phase and spine flex, slow-motion review view
author: grok
scratch: false
research: true
skill: false
tags: [animal, behaviour, wolf]
---
# T-0002 Wolf gallop

**Asked by Matthew (2026-10-18, about 16:45 PT):** "the legs of the wolf move too rapidly. i want to see it rendered slower,
and the running motion is way off. a wolf gallops, not step steps".

## Root cause (checked in the code on main 7d71892 + Codex's uncommitted edits, before planning)
The legs spin because **stride length is capped at walk scale, so every extra metre per second becomes cadence**.
- `core/animalBehavior.ts` `gaitFor`: `cycle = max(.4h, min(2.3·h·Fr^0.3, maxStance / duty))`. The comment says it plainly:
  "If a stride would need more leg than the animal has, the cycle shortens (faster cadence) instead of overstretching."
- For `WOLF_LEGS`, `maxStance` (the stance chord the leg may sweep) is 0.39 m at walk/trot and only **0.25 m in a gallop**
  (the gallop multiplies the leg's vertical by 1.1 for body lift, which shortens the chord). With the gallop's duty floor of
  0.2 the stride is pinned at 0.25 / 0.2 = **1.25 m** from about 7 m/s up. The Alexander stride (2.3·h·Fr^0.3) is never used:
  the cap wins at every speed from 1 m/s up.
- The phase advances by distance / cycle (`AnimalBrain.expend`), so cadence = speed / 1.25 m in a fast gallop:

| speed (m/s) | game gait | game stride | game cadence | real canid (source below) |
|---|---|---|---|---|
| 1.27 | walk | 0.60 m | 2.1 Hz | walk, 0.84 m, 1.50 Hz (Bryce & Williams 2017, wolf-like breeds) |
| 2.70 | trot | 0.87 m | 3.1 Hz | trot, 1.26 m, 2.10 Hz (same) |
| 3.42 | trot | 0.87 m | 3.9 Hz | trot-gallop transition, 2.4 Hz (Heglund & Taylor 1988, 40 kg) |
| 4.96 | gallop | 0.97 m | 5.1 Hz | gallop, 1.91 m, 2.61 Hz (Bryce & Williams 2017) |
| 6.0 (run) | gallop | 1.15 m | 5.2 Hz | about 2.7 Hz, stride about 2.2 m |
| 10.5 (sprint) | gallop | 1.25 m | **8.4 Hz** | about 3 Hz, stride about 3.4 m |

  The game is 1.5-3× too fast in cadence, and stride is 2-3× too short in a gallop.
- **The trot-to-gallop switch shortens the stride.** The Froude handoff itself works (trot below Fr 2.5, gallop above, at
  3.67 m/s, close to the measured 3.4 m/s), but at the switch point the gallop's tighter reach makes the stride go from
  0.87 m to **0.83 m** (0.25 m / duty 0.30), duty drops from 0.45 to 0.30, and cadence jumps from 4.2 to 4.4 Hz. It reads as
  "the same steps, faster".
- **The flight phase is there in the timing but invisible.** Codex's offsets `[.45, 0, .6, .9]` with duty 0.2 leave whole-body
  suspensions at 0.30-0.40 and 0.75-1.00 of the cycle, but at 8.4 Hz the long one lasts about 30 ms (one 30 Hz sim step).
  `gallopBob` is a fixed 0.09·hip bump, not a ballistic arc. There is **no spine**: the rig has one `torso` bone.
- **Stepping look ("step steps"), three more causes:**
  1. `render/playerWolf.ts` adds a **wall-clock torso bounce**, `|sin(time·24)|·0.012` in a sprint (7.6 bounces/s; 6/s in a
     run), unrelated to the legs or to distance travelled. Codex proposed removing it.
  2. `main.ts:296` feeds `distance × ground.cost` to `expend`, so on soft ground (cost > 1) the phase and `gaitSpeed` run
     ahead of the body: legs speed up and planted paws slide.
  3. The phase moves in 30 Hz sim steps and the rig reads `brain.phase` directly, without interpolation: at 8.4 Hz that is
     3.6 poses per stride, which strobes.
- `?loco=1` (Gait Builder's CPG stack) has the same problem: `planGait` takes its `cycle` from `gaitFor`, and the CPG
  frequency is speed / cycle. One fix in `gaitFor` fixes both paths.
- `claude/locomotion-hooks` does **not** change stride timing: in `gaitFor` it only swaps `const G = 9.81` for
  `gravity()`. It moves the rig (the fork folds into `render/playerWolf.ts`, `fork/*` is deleted, a `tilt` group is added)
  and keeps the wall-clock bounce.

## Data to build on (cite these in the code)
- **Heglund & Taylor 1988**, JEB 138:301, doi:10.1242/jeb.138.1.301: trot-gallop transition speed = 1.54·M^0.216 m/s and
  stride frequency there = 4.19·M^-0.150 Hz. For a 40 kg wolf that's 3.42 m/s and 2.41 Hz. Within a trot and within a
  gallop, frequency rises only gently with speed (linear fits per species in their Tables 1 and 4), so speed comes from
  stride length.
- **Bryce & Williams 2017**, JEB 220:312, doi:10.1242/jeb.144188, Table S2, "Northern" (wolf-like) breeds: walk 1.27 m/s,
  1.50 Hz, 0.84 m; trot 2.70 m/s, 2.10 Hz, 1.26 m; gallop 4.96 m/s, 2.61 Hz, 1.91 m.
- **Maes et al. 2008**, JEB 211:138, doi:10.1242/jeb.008243 (Malinois, 0.4-10 m/s): duty factor falls below 0.5 above
  2.0 m/s (Fr ≈ 0.7), where suspension phases begin. Above about 4 m/s, **stride length is the main driver of speed**.
- **Walter & Carrier 2007**, JEB 210:208 (rotary gallop at 9.2 m/s): contact time 71-75 ms per limb, which is a stance sweep
  of about 0.65-0.69 m per foot. The game allows 0.25 m.
- **Biancardi & Minetti 2012**, JEB 215:4144, doi:10.1242/jeb.073031: canids use the rotary gallop, LH → RH → RF → LF
  (Codex's corrected order).
- Alexander & Jayes 1983 (dynamic similarity, Froude): already used by `gaitFor`; keep it for gait choice.
- Visual reference for review only: Muybridge, *Animal Locomotion* (1887), dog galloping plates (public domain). Use them
  to check the footfall order and the two suspensions by eye; never ship them as textures.

## Existing work to reuse (no second movement system)
- **Gait choice and stride:** `core/animalBehavior.ts` `gaitFor` / `quadrupedPose` / `footTarget` / `gallopBob`, used by the
  default wolf, the deer (`render/animalRig.ts`) and `?loco=1` (`animals/locomotion/gaits.ts` `planGait`). Change these in
  place. Deer use the same function with `DEER_LEGS`, so their tests must stay green.
- **Gait Builder's CPG stack**, `src/animals/locomotion/` (cpg, controller, foot locking, IK, jump/pounce, posture), behind
  `?loco=1` via `render/playables.ts`. Its phases already glide to a new gait over about one stride, so it gets the
  transitions for free once `gaitFor` is right.
- **Footfall contract:** `onPlayerTouchdown` (`animals/locomotion/game.ts`), used by footstep audio
  (`audio/borealSound.ts`, commit aedca49). Keep it unchanged: one `Touchdown` per leg per stance, same fields. Footstep
  sounds then slow down with the cadence by themselves.
- **Codex's gallop order** (uncommitted on 2026-10-18 in the served tree): `gaitFor` and `GAIT_TABLE.gallop` offsets
  `[.45, 0, .6, .9]`, and the `gallopBob` comment. Build on it; do not redo it.
- **Claude's `claude/locomotion-hooks`**: the rig fold-back, `tilt` group and brain intent (hook 3). Work on top of it once
  merged, or stack on it, because it moves `render/playerWolf.ts`.

## Coordination and ownership
While T-0002 is claimed, **the claimant owns wolf stride and gait tuning** (stride, cadence, duty, gait thresholds, bob,
spine). Nobody else changes those numbers; others send requests to the handoff file.
- **Codex:** if Codex has committed the gallop order, start from that commit. If not, write to Codex in the handoff file and
  in your own notes file before changing `gaitFor`, and wait for it to commit or hand over. The two of you never edit the same
  stride numbers. Codex's other gallop work (wolf movement in `world.ts` / `buildScene.ts`) stays Codex's.
- **Claude:** `gaitFor` was written by Claude. Say in your notes file what changed and why. If `claude/locomotion-hooks` is
  not yet in main, stack the branch on it and say so in the handoff.
- **Gait Builder:** owns the CPG stack and the wolf body/coat. Ask before adding a spine bone to `core/wolfBody.ts` or
  changing `animals/locomotion/*`. The touchdown contract stays as it is.

## Workflow requirements (not steps, no credit)
These are required of every task by AGENT-WORKFLOW.md and tasks/README.md, so they are not counted in the award:
- Handoff file `tasks/handoffs/T-0002-<agent>.md` committed before any code, and kept current.
- Before `complete`: `npx tsc --noEmit`, `npm test` and `npm run build` green on the branch, and a playable link for Matthew.
- Notes entry in your own `notes/<agent>.md`.
- Base and ownership: branch from the newest main containing Codex's committed gallop order (LH → RH → RF → LF) and
  `claude/locomotion-hooks` (or stack on them and say so in the handoff). If Codex has not committed, write to Codex in the
  handoff and your notes file and wait before touching `gaitFor`, so no two agents tune the same stride numbers.

## Objectives
- [ ] Slow-motion review view `?timescale=s` (0.05-1, URL only, never saved). It multiplies the frame `dt` once in `main.ts`, before the fixed-step accumulator, the animal updates in `buildScene` and the rigs' animation time. So the player's movement, animal AI and movement, gaits, touchdowns and `shaderClock` effects (wind, water) all slow together and stay consistent with each other. The world clock (`core/worldClock` `worldSec`, saves, offline credit), sun and seasons, the weather (`core/weather`), audio pitch, camera look, input and UI stay on real time, because they run on wall time or `worldSec` and slowing them would desync saves. If `simTime` re-syncs to `worldSec`, skip that re-sync while `s ≠ 1`. Add a gait readout (gait, Fr, cadence Hz, stride m, duty, airborne yes/no) to the inspector and the `?loco=1` lab
- [ ] `tests/gait-data.test.ts`: the canid table above (Heglund & Taylor 1988, Bryce & Williams 2017, Maes 2008, Walter & Carrier 2007) asserted against `gaitFor(WOLF_LEGS)` for cadence and stride within ±15 %; record in the handoff that it fails on the current code before fixing it
- [ ] `gaitFor`: cadence from the data instead of the reach cap. Use a frequency curve f(v) per gait (trot about 1.9-2.4 Hz; gallop 2.4 Hz at the transition rising to about 3 Hz at 10.5 m/s), with stride = v / f. Stance reach reaches the measured 0.65 m in a fast gallop; where reach still falls short, the duty factor falls (longer flight), never the stride. Deer tests stay green
- [ ] Gait transitions by Froude with hysteresis, keeping `gaitFor` a pure function. It takes an optional last argument `prev?: GaitName`; without it, the thresholds are today's midpoints, so deer and any other caller are unchanged. With it, up and down thresholds differ: walk ↔ trot at Fr 0.6 up and 0.45 down; trot ↔ gallop at Fr 2.5 up (3.67 m/s) and 2.1 down. `AnimalBrain` stores `gait` and passes it from `expend`; `quadrupedPose` reads the brain's stored gait instead of choosing again; `planGait(speed, legs, override, prev?)` gets the same argument, and the controller passes its last `plan.id`. The default rig blends the phase and pose over about one stride, as the CPG already does. Add a no-flicker test (in `tests/gait-data.test.ts`): ramp the speed slowly through each threshold up and down, with ±0.1 m/s seeded jitter, and assert exactly one switch per crossing for `gaitFor`+brain and for `planGait`
- [ ] Gallop flight: duty 0.3 → 0.2 with speed on Codex's footfall order, with a gathered and an extended suspension at speed. Replace the fixed `gallopBob` with a ballistic arc from each suspension's duration (rise = g·t²/8), so all four paws are visibly off the ground at 0.25×
- [ ] Spine flex locked to the gallop phase: the back flexes at the gathered suspension and extends at the extended one, adding stance reach. Use one lumbar bone, or a pelvis shift under `tilt`, agreed with Gait Builder; the amplitude comes from the literature and is cited, with no flex at a walk
- [ ] Remove the wall-clock torso bounce in `render/playerWolf.ts` (Codex's proposal; tell Codex in the handoff) and drive any trot bob from `brain.phase`
- [ ] Advance the phase and `gaitSpeed` from the raw distance travelled (`main.ts:296` multiplies it by `ground.cost`, so only energy keeps the cost), and interpolate the rendered phase between 30 Hz sim steps
- [ ] `?loco=1` parity and footfall contract: the CPG frequency reads the same f(v). Extend the existing `tests/locomotion-touchdown.test.ts` (no new file): with auto gait selection at walk, trot and gallop speeds (and across a speed ramp), `onPlayerTouchdown` still fires once per leg per stance with unchanged `Touchdown` fields, and the touchdowns per second equal 4 × the new cadence. Footstep audio still plays
- [ ] Performance budget held and measured, with the numbers in the handoff. Draw calls are unchanged, with at most one extra bone, and the WebGL program count is unchanged after warm-up (`tools/smoke-tiers.mjs` counts links). `smoke-tiers` on HEAD shows no fps loss on any tier. Gait maths stays ≤ 0.05 ms CPU per wolf per frame, measured by a node bench `tools/bench-gait.ts` (`npx tsx`): after 10 000 warm-up calls, time 100 000 calls of one frame's gait path with `performance.now()`. For the default wolf that is `expend` + `quadrupedPose`; for `?loco=1` it is `createLocomotion(...).update` at 1/60 s, at walk, trot and sprint speeds. Report the median of 5 runs in µs per call, before and after. As an in-game cross-check, wrap the player wolf's `animate` in `performance.mark`/`measure` and average 600 frames at a sprint
- [ ] Slow-motion captures at 0.25× of a trot at 2.7 m/s, a gallop at 6 m/s and a sprint at 10.5 m/s, next to Muybridge's dog plates, in your notes

## How a reviewer checks it
1. `npm test`: `tests/gait-data.test.ts` passes, with cadence and stride within 15 % of the table, and the touchdown test passes.
2. Open the game with `?timescale=0.25` and hold run, then sprint. The readout shows about 2.7 Hz and a stride over 2 m at
   6 m/s, and about 3 Hz and over 3 m at 10.5 m/s, not 5-8 Hz. Footfalls go LH, RH, RF, LF, and twice per stride all four
   paws are off the ground. The back bunches and stretches. There is no bounce between footfalls.
3. Ramp the speed up slowly: walk → trot → gallop switch once each, with no flicker at the thresholds, and the stride visibly
   lengthens at the trot-gallop switch.
4. Repeat with `?loco=1&timescale=0.25`: it looks the same, and footsteps still sound once per paw.
5. Walk onto soft ground (bog, snow): the legs do not speed up and planted paws do not slide.
6. Check the handoff's bench numbers against the performance objective, and run smoke-tiers once on the branch.
