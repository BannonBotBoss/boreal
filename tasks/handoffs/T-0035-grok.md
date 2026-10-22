# T-0035 handoff (grok)

Branch grok/interact-outline, worktree C:\dev\boreal-grok-outline (from main a436a9d). Test Vite: 127.0.0.1:5411 with its
own cacheDir (C:\Users\0\outline-shots\vite.outline.mjs) so it never rewrites the shared node_modules/.vite of :5173.

## Status
Built and verified; NOT submitted: waiting for an approve-plan (claude, codex or agy) on the 00:43 propose event.

## Done
- c3515b5 render/targetGlow.ts: three r180 OutlinePass on a one-object proxy scene, blended onto the canvas after post.render
  (no composer, no full-scene depth pass); ground ring removed; ?glow=0 turns it off.
- da3481d core/focusLock.ts + tests/focusLock.test.ts: held focus (Focus binding LB / F). Engages only while held with an
  interactable object (not pebbles) within the radius in the view cone; dropped on release or when out of radius; while
  locked, forward movement steers toward it at the stick's own 2.2 rad/s (clamped per step, no snap), hand steering wins.
  Super stealth no longer auto-focuses. Camera look-at + fov ease in/out (no snap).
- 30cd7b1 src/config/systemProperties.ts: autoFocus + targetGlow sections, read by focusLock, bindings, targetGlow, buildScene,
  main. Focus radius 4.5 m from Matthew's red guideline ring (it was a hand-drawn annotation, not game code: no red ring
  exists on any branch). Senses halo hidden while a target is locked (autoFocus.hideSensesHalo).
- Shots (PC GPU, headless, off-screen): before/after herb, deer, focus-held herb and deer -> box /workspace/outline/.
- Glow cost: tools/glow-bench.mjs -> 0.41 ms median (IQR 0.26-0.52) at 1280x720 on the RTX 5060; nothing with no target.
  In-game A/B (?glow=0) was swamped by PC load (17-38 ms frame swings), so the isolated bench is the number.
- npm test 366 tests, 354 pass, 0 fail, 12 todo; tsc clean.

- Softer glow (Matthew 01:43 PT: "i like the highlighting effect, but make the glow less focused"): targetGlow
  edgeStrength/edgeGlow/edgeThickness 1.8/1.0/1.6 -> 1.3/2.5/6.0 (values only). Herb crop vs ?glow=0, added luminance
  (px > 6/255): sum 330.5k -> 321.5k (-3 %), 98th-pct 164 -> 160; hard edge replaced by a wider soft halo. Shots: box
  /workspace/outline/soft-before.png, soft-after.png. glow-bench 0.28 ms median (IQR 0.26-0.30) at 720p, RTX 5060.

## Findings
- Berry bushes (forage) are not a target for any playable, so no berry shot can show the glow (same static path as the herb).
- At the deer spawn (49.65, 18.16) the deer is not visible in either the before or the after shot although it is the target
  (pre-existing; the rig glow path draws nothing when the rig draws nothing). Worth a look by whoever owns deer rendering.
- Wolf head does not turn to the target (no head-look hook in the wolf rig); attention = camera look-at + glow.

## Next step
After an approve-plan: write the complete event (skill notes/skills/target-outline-glow.md) and ask for approve.

## Needs from another agent
- approve-plan for T-0035 (claude, codex or agy), then approve of the complete event.