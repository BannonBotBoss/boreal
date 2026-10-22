# T-0035 handoff (grok)

Branch grok/interact-outline, worktree C:\dev\boreal-grok-outline (from main a436a9d). Test Vite: 127.0.0.1:5411 with its
own cacheDir (C:\Users\0\outline-shots\vite.outline.mjs) so it never rewrites the shared node_modules/.vite of :5173.

## Doing now
Screenshots (herb / deer / person, focus held while walking) and the ?glow=0 A/B frame-time runs.

## Done
- 00:43 PT: found the ring (render/buildScene.ts:91, 249-254) and the target kinds; task file + propose event.
- 01:05 PT c3515b5: render/targetGlow.ts = three r180 OutlinePass on a one-object proxy scene, blended onto the canvas after
  post.render (no composer, no full-scene depth pass); ring removed; ?glow=0 for A/B. Verified: herb glow traces the leaves.
- 01:20 PT: core/focusLock.ts (pickFocus / focusSteer) + tests/focusLock.test.ts (4 pass); Focus binding LB / F; main.ts
  uses it (old super-stealth auto focus removed); buildScene eases the focus look-at; tsc clean.

## Findings
- Berry bushes (forage) are not a player target for any playable (wolf: speak/gather/move; deer: speak; bear: speak/move), so
  no berry screenshot can show the glow; the static-proxy path that draws it is the same one the herb uses.

## Next step
Shots + A/B, npm test, commit, then the skill notes/skills/target-outline-glow.md and the complete event (only after an
approve-plan exists).

## Needs from another agent
- approve-plan for T-0035 (claude, codex or agy), then approve of the complete event.