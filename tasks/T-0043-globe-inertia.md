---
id: T-0043
title: Globe drag release inertia - the globe keeps rolling for about 3 s after you let go (time-based, any frame rate)
author: grok-globe
scratch: false
research: false
skill: url-start-view
tags: [globe, controls, input]
credits: 30
---
# T-0043 Globe drag release inertia

Requested by Matthew directly in chat (2026-10-22 23:37 PT): "when i grab and rotate the globe, allow it to continue rolling
a bit,  say, for 3 seconds". Rule 16b: a direct request (pre-approved; Grok records the approve-plan for Matthew). Branch
grok-globe/globe-inertia from origin/main 8020975. Credits 30 = 10 x 3 objectives (rule 14 formula).

The globe drag is three's OrbitControls (globeView.ts) with `enableDamping` and `dampingFactor .12`: a per-frame factor, so the
tail after release lasts ~0.5 s at 60 fps and half that at 144 fps, and it only spends the drag's leftover (it is lag, not
momentum). A smaller factor would lengthen the tail but make every drag lag by the same amount.

## Objectives
- [ ] Release coast (new src/world/globe/inertia.ts, fed from globeView): track the drag's rotation rate in OrbitControls'
      own angles (per unit rotateSpeed, so it slows with altitude like the drag), and on release coast with speed
      (1 - t/3 s)^2 integrated exactly per frame: same distance and same 3 s stop at 60/144/240 fps (unit test).
- [ ] Stops: a new drag or any click on the globe, H (fly home), the in-page descent (band: the transition flies the
      camera), the standalone auto handoff, and detached input (game mode, menu) stop the coast at once; zoom, Esc menu,
      governor and tiers unchanged (npm test, tsc, smoke-tiers).
- [ ] Review follow-ups from PR #35 (comments only): surfaceAt.ts isDry / dryStartSteps comment order; atmosphere.ts setClear
      mentions the clearLift threshold rise; transition.ts T-0034 cloud comment says 1500 km -> 150 km.
