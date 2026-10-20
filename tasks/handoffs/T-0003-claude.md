# T-0003 handoff (claude)

**Branch:** `claude/T-0003-wolf-reach`, worktree `C:\dev\boreal-claude-reach`, off `main` 07ac0d8, main 64c16a5 merged in (clean).
**Carried in by cherry-pick (grok-gait, T-0002):** f8982ab, c92b418, 732ac70, 76ef3b1 (`src/core/gaitData.ts` + `tests/gait-data.test.ts`),
55dbda4 (`core/gaitReadout`), 57d9f78 (`?timescale`; conflicts in main.ts and lab.ts resolved: kept main's in-page sfx check, hares use `sdt`).
**Baseline:** `npx tsc --noEmit` clean; `npm test` 296 tests, 287 pass, 0 fail, 9 todo (T-0002 LIVE gaitFor rows).

## Done (30f09c5, merge 42a7b71, then the opt-out and these notes)
- `gaitFor` reads `canidPlan` for the wolf (cadence, stride, duty, rotary offsets), with Froude hysteresis from `brain.gaitName`
  (a snapshot field). Deer, walking backwards and the `?loco=1` pace/canter/bound/pronk overrides keep `alexanderGait`.
- Shoulder blades: `girdleRest + reachTargets.scapula`, relative to the trunk. `glide` is 0 for the game wolf at every speed
  (the scapula stays under its 0.35 rad cap up to 10.5 m/s), so it is not applied.
- Pelvis: the hind chain tops move about `LUMBAR_PIVOT` by `spineFlex` (`pelvisShift`) on both rigs. **No new bone.** The trunk
  is still one torso bone, so the back itself does not visibly bunch or stretch; the tops of the hind legs move fore and aft (see Open).
- Tilt group on the default rig (MERGE.patch hook 2 folded in). `poseWolfRig` poses both rigs alike. The wall-clock torso
  bounce is gone. `suspensionBob` (g t^2/8 per flight) replaces `gallopBob` for the wolf.
- Body pitch comes from the vault, not from `reachTargets.pitch`. That field is the same stance vault on REF_BODY's levers,
  and it steps by up to 3.7 degrees at each touchdown (2300-6800 deg/s on the rig). `vaultDips` solves each leg's touchdown
  and liftoff needs with the rig's own limbs, joins them along the stance and eases them over the swing (`vaultEnvelope`).
  Planted paws are then topped up exactly. The body pitches about its centre at hip height (`pitchShift`). With the ground
  point as the pivot, a dropped end also swung its girdle fore or aft, so the top-up could not converge: a 6 mm need shrank
  by only 0.8 mm per pass.
- Paws are solved against the moved chain tops on both paths (`solveChain`, shared with `ik.solveLimb`). The foot bone turns
  toward the leg only as far as reach needs, which gives a stance-varying metatarsus. `?loco=1` gets the same reach inputs and
  the same vault (level-ground needs cached per gait and crouch), and releases over `VAULT_RELEASE`. `Tilt` and `LegPose`
  carry the pitch shift.
- Animal opt-out from surface bands: `userData.noBands` on every wolf material (the T-0004 decision, see notes/claude.md).

## Measured
- `npm test` 324: 315 pass, 0 fail, 9 todo. The 9 todo are T-0002's LIVE rows; all 25 gait-data rows pass with the todo removed.
- Acceptance (`tests/locomotion-touchdown.test.ts`): canid cadence within 15 % at 6 and 10 m/s. No stance target lies past
  (upper + lower)·√0.97. Planted slip is under 1 cm. Sweep is 0.67 m ±15 % at 9.2 m/s and ≥ 0.55 m at 6 m/s. `?loco=1` LH/RH
  touchdowns come at `canidPlan(v).hz`. On both paths at 3, 6, 8 and 10 m/s, body height changes at ≤ 1.5 m/s and pitch at
  ≤ 5 rad/s, and every paw lands once per stride.
- Body motion (default / `?loco=1`): max vertical speed 0.39 / 0.42 m/s at 6 m/s, 1.27 / 0.69 at 8 and 0.91 / 0.72 at 10.
  Deepest vault: 18 mm at 6 m/s, 44 mm at 8-10 m/s. No leash steps at a steady speed.
- Cost (best of 7, node, omen under load): `quadrupedPose` 13-17 µs per call (main: 2.2 µs); `?loco=1` update 26-40 µs. Both
  are under T-0002's 50 µs per wolf per frame. `tools/bench-gait.ts` is on grok-gait's branch, not here; the method is the same otherwise.
- Captures (lab, `rig=real cam=profile`, paused frames across one stride): `artifacts/T-0003/after/6ms/` and `.../10.5ms/` in
  this worktree (artifacts/ is gitignored). The gathered flight (hind paws ahead of the fore) and the extended one read clearly.
- `tsc` clean, `npm run build` OK. smoke-tiers: see notes/claude.md.

## Open
- **Visible back flexion** needs a lumbar bone with the croup weighted to it (`core/wolfBody.ts`), and Gait Builder approves any
  new bone. Asked again in notes/claude.md. Until then the objective "rotated by spineFlex, with the hind chains hanging from
  it" is met for the chains but not for the skin of the back.
- **T-0002 LIVE rows:** grok-gait removes the todo in the joint landing (they pass here).
- `reachTargets.pitch` steps at each touchdown, and the rig no longer reads it. grok-gait may want the envelope there too.

## How to check
`npx tsc --noEmit`, `npm test`, `npm run build`. Game `?timescale=0.25` (and `&loco=1`): about 2.7 Hz at 6 m/s and 3 Hz at
10 m/s, and all four paws land. Lab: `tools/locomotion-lab.html?rig=real&cam=profile&speed=6&pause=1&t=4.1`.
