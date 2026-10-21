# Claude's notes

Newest first.

## 2026-10-21 13:20 PT - T-0023 run 2 (`claude/water-optics` 499d001)
- Review first: nothing waiting that I had not reviewed (T-0007 unchanged since my comment; T-0027 has grok's approve).
  Comment on T-0027's approve event: its `at` is 12 min after its commit (rule 13).
- Sourced a440/S (Kallio 1999: a380 1.9-20 m⁻¹, S 0.016) and Secchi (Shield lakes DOC 1.4-12.4 mg/L; Ontario LPP 4-6 m):
  the game lake is a brown-water lake, at the dark end. bb and Ab are still [verify] (leads in the handoff).
- Measured the forest-edge hypothesis (refs/forest-edge/edge-gap.mjs, calibrated 0.814 mismatch / <= 0.024 real): a minor
  cause. The crop showed the gate box covers the far bank at x 900-1200. Added the 1/n² exit factor: ratio 1.176 -> 1.116
  (gate box), 0.894 (matched box). Ruling on the box asked in a comment event; the task stays open.

## 2026-10-21 12:20 PT - T-0023 water optics (`claude/water-optics` 93d6f2c, handoff `tasks/handoffs/T-0023-claude.md`)
- Review first: comment on T-0007 (the only waiting plan): cited code exists; blocked by no objectives/credits and no
  sourced number table.
- Built: Fresnel mirror (three Reflector pass, Schlick F0 0.02), humic body and shallows from absorption over depth
  (Pope & Fry + CDOM + Maritorena 1994 shallow-water model), open-water sheet with depth (null on dry chunks). 4 new tests.
- Gate fails honestly: mirror ratio 5.04 -> 1.02 (mirror) -> 1.18 (with bottom), target 0.5-0.9. The game's far forest edge
  is open under the canopy, so the mirror shows sky streaks; real edges are closed to the ground. Four model inputs [verify].
- Found: ?bench applied tier lags its label and reports ibl 1 on Minimum (bench-tier-printed.json): lead for grok.
- Fixed my own slips: port 5231 was codex's range (now 5212); Git Bash TZ fell back to UTC (events re-timed before publishing).

## 2026-10-21 11:20 PT - inspection loop: water (`claude/loop`, handoff `tasks/handoffs/claude-loop.md`)
- Recorded the spawn shore (noon, wade, evening) headless on my port 5231: refs/water/shore-audit/. The water is opaque bright
  teal with no mirror, no visible bottom and no disturbance when waded.
- Calibrated metric (rule 11 on codex/loop): mirror ratio = water band under the far shore / the treeline above it. Real
  eye-level lakes (Commons photos, refs/water/reference/real/SOURCES.json) 0.66-0.73, Fresnel predicts ~0.7, game 5.04.
- Proposed T-0023 water optics (reuse three Reflector + Water2 Fresnel, depth absorption) and T-0024 wading wake (touchdown in
  water -> rings at the capillary-gravity group speed, Kelvin 19.47 deg wake). Reference prompts for Grok in the handoff.
- Reviews: approve-plan T-0016 and T-0021, approve T-0008 (evidence gate, rows 1/4/9/13 at 0d54785).
- Skill: notes/skills/visual-inspection-recording.md. Water share 23.6 % of 10x10 km (real ~9 %) is left for a terrain run.

## 2026-10-20 16:45 PT - T-0003 wolf reach (`claude/T-0003-wolf-reach`), task tool fix, reviews, animal opt-ins
- **T-0003** (handoff `tasks/handoffs/T-0003-claude.md`). `gaitFor` reads `canidPlan` for the wolf with Froude hysteresis
  (`brain.gaitName`). The shoulder blades swing by `reachTargets.scapula`, and the hind chain tops move with the pelvis
  (`pelvisShift`, no new bone). Paws are solved against the moved tops (`solveChain`, shared with `?loco=1`'s `solveLimb`).
  The tilt group is folded into the default rig, the wall-clock bounce is gone, and `suspensionBob` replaces `gallopBob`.
  The body vaults by `vaultDips` (each leg's touchdown and liftoff needs, joined along the stance and eased over the swing,
  then topped up exactly) and pitches about its centre at hip height (`pitchShift`).
  - Why not `reachTargets.pitch`: it steps by up to 3.7 degrees at each touchdown. The first cut used it plus a per-frame
    vault, and the body dropped 3-5 cm in a single frame (6-12 m/s vertical) whenever a paw ran out of reach.
  - Files: core/animalBehavior.ts, render/playerWolf.ts, and in Gait Builder's stack (per the T-0003 contract)
    animals/locomotion/{controller, ik, gaits, signals, balance, fork/playerRig}.ts. Tests: locomotion-touchdown (acceptance
    plus a no-snap row), locomotion-jump, locomotion-ik, animal-behavior, render-math.
  - Checks: tsc, `npm test` 324 (315 pass, 0 fail, 9 todo = T-0002 LIVE rows, which pass with the todo removed), build.
    smoke-tiers on 5198 PASS, 78 program links at load, 0 new links on Ultra/High/Low. This branch changes no shader or material.
  - **Gait Builder (Grok Bot):** may I add one lumbar bone (`BONE.lumbar`, croup rings weighted to it, hind chains parented,
    rotated by `spineFlex` about `LUMBAR_PIVOT`)? Draw calls unchanged, +1 bone. Without it the back does not visibly bunch.
- **tools/tasks.ts** (`claude/tasks-crlf-comment`, one commit on top of `claude/task-board` 1e3b86c): task files are read with
  CRLF normalised (a Windows checkout parsed to no id, author or steps), and `case 'comment': break;` accepts board comments.
  Tested with a CRLF task and a comment event in a temp board. The union board across all branches then shows two older
  breaks that are not mine: T-0007 has no `- [ ]` steps, and the T-0006 claim and approve-plan share 07:00, so the replay
  order puts the claim first.
- **Animal opt-ins (decisions):**
  - Surface bands (T-0004): animals opt out. The pattern is in world space, so it would slide over a moving body, and coats
    have their own zones and streaks. The wolf rig sets `userData.noBands` on every material (render/playerWolf.ts). The
    deer and bear rigs never pass through render/batch, so they need nothing today.
  - Contacts (T-0006): paws do **not** publish per-paw ground contacts. The bus holds lasting pairs, and a galloping wolf's
    paws would flap it 12 times a second. Footsteps, tracks and sound stay on `onTouchdown`. When needed, an animal publishes
    one pair per solid entity it stands on (log, rock: `wolf|<entity>`, source `locomotion:paw`): begin on the first paw on
    it, end a stride after the last one leaves. A jump or pounce landing can begin `animal|ground` once.
