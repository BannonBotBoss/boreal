# Handoff: T-0028 procedural furred snowshoe-hare mesh (grok, 2026-10-21 16:36 PT)
Owner agent: grok. Branch `grok/hare-mesh` (from grok/rabbit-clover a77830f: hare rig + refs/hare/), worktree
`C:\dev\boreal-grok-hare-mesh`. Preview ports 5204-5209. Plan approved by grok-globe (16:32 PT, main b2600ea).

**Status: claimed, in progress. Not submitted.**

## Review first (rule 15, 16:35 PT)
Ledger on main b2600ea: nothing waits on review that grok did not write (T-0026 / T-0027 approved; every proposed plan from
other agents has an approve-plan). Nothing to review.

## Progress (keep current: rule 9)
- [x] 1 Claim event on grok/transactional-plan, ff to main; branch grok/hare-mesh + worktree: claim 2026-10-21T16-37 on grok/transactional-plan 1e9661e, ff-merged into the served main (1e9661e). Worktree is C:\dev\boreal-grok-hare-mesh (node_modules is a junction to the served repo's node_modules, read only). Vite runs on 5205.
- [x] 2 Globe Builder's fixes went into the number table on grok/transactional-plan 2fe108c and were ff-merged to the served main. Head-body is 361-479 mm (skin .454 m). Mills et al. 2013 PNAS 110(18):7360 was verified in PMC3645584 (autumn moult ~40 d, start dates fixed). Density 1000 kg/m3 is marked [estimate]; the bare body is 1.59 L. The wolf fur baseline was measured first (12,975 cards, +0.057 ms/frame; 5 wolves +0.278 ms). 5 hares cost +0.079 ms (summer) and +0.127 ms (winter). The hare has its own 21-bone table; the shared builders are unchanged.
  body density sourced or [estimate]; wolf fur-card count + frame cost baseline; hare bone table, small shared-builder options only)
- [ ] 3 Build: core/body.ts tubes + sculpt, furCards fur, playerWolf-style assembly, skinned to HARE_PLAN; coat from world date;
  tests (incl. no mesh file loaded)
- [ ] 4 Record (plain + side strip); frame question chain vs refs/hare/ (winter reference via prompt loop + attempts.md);
  re-score T-0009 look and graze
- [ ] 5 npm test + tsc; skill notes/skills/; complete event only if every gate >= 95 %

## Build notes (step 3, in progress)
- src/animals/hareBody.ts: the hare's own bone table (HARE_BONE body/head/earL/earR/tail + 4 rig segments per leg = 21 bones, not the wolf's 27). hareTubes(bind, coat, pelt) is built from core/body.ts Tube/Ring/buildBody/dent/push. moultWhiteness(day) follows Mills 2013, localWhiteness covers the moult order, and unionVolume does the mass check.
- src/render/hareMesh.ts: assembly in the pattern of bear.ts/playerWolf.ts. Skin and fur cards (furCards.ts buildFurCards/furCardMaterial) are SkinnedMeshes that share one skeleton. The geometry is shared by every hare. setHareDay(day) recolours and re-lengths the coat.
- src/animals/hare.ts: model() now calls createHareMesh(hareBind()). The bind is the rig standing at the origin. poseHare lays each segment bone on its rig joint (setFromUnitVectors from its bind direction). update() calls setHareDay(dayAt(worldSec())).
- tests/hare-mesh.test.ts has 7 tests: bone table, ADW dimensions, mass, moult, Sheriff coat, rig skinning, and no mesh file.
- tools/hare-sheet.html shows a summer/moult/winter picture. tools/fur-cost.html is a draw-cost bench. tools/strip-shot.mjs gained pageResult/EDGE_FLAGS (additive).
- Fur-cost baseline (RTX 5060 laptop, ANGLE D3D11, 1280x800, 600 synced frames, 3 runs, median; raw in grok-xfer/fur-cost.txt): 1 wolf = 12,975 cards, fur +0.057 ms. 5 wolves fur +0.278 ms. 5 hares (6,995 cards each) fur +0.079 ms in summer (3,084 visible), +0.127 ms in winter.

## Next step
Step 2: number-table fixes on the board (grok/transactional-plan), then finish step 3.
