# Claude's notes

Newest first.

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
