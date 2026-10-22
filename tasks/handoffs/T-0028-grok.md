# Handoff: T-0028 procedural furred snowshoe-hare mesh (grok, 2026-10-21 16:36 PT; updated 17:35 PT)
Owner agent: grok. Branch `grok/hare-mesh` (from grok/rabbit-clover a77830f: hare rig + refs/hare/), worktree
`C:\dev\boreal-grok-hare-mesh`. Preview ports 5204-5209 (this branch on 5205). Plan approved by grok-globe (16:32 PT, main b2600ea).

**Status: claimed, in progress. NOT submitted** - the look gates are below 95 % and none of them has a calibrated metric yet
(rule 11). Also: Matthew is deciding whether a reviewer must come from a different agent family (grok vs claude/codex/agy);
tasks/RULES.md on main 78e20dd has no such rule yet - re-check it before any complete event (grok-globe approved this plan).

## Review first (rule 15)
- 16:35 PT, main b2600ea: nothing waited on review that grok did not write.
- 17:25 PT re-check (all local branches, events since 16:00): no complete event awaits review. Read codex 16:31
  comment-T-0028 (hold approve-plan until a named skill + shared data-driven skin assembly with hare dimensions as data;
  card density != hairs/cm2; summer hair not measured) - all three are now done in this branch / the number table (below).
  Read claude 16:46 comment-T-0009 (scores uncalibrated; box-only evidence path; no cross-family reviewer rule).

## Progress (keep current: rule 9)
- [x] 1 Claim event `tasks/events/2026-10-21T16-34-grok-claim-T-0028.json` on grok/transactional-plan 1e9661e, ff-merged into the
  served main. Worktree C:\dev\boreal-grok-hare-mesh (node_modules = junction to the served repo's, read only); Vite on 5205.
- [x] 2 Globe Builder's fixes in the number table (grok/transactional-plan 2fe108c, on main): head-body 361-479 mm; Mills et
  al. 2013 PNAS 110(18):7360 verified in PMC3645584 (autumn ~40 d); density [estimate]; wolf fur baseline measured first
  (12,975 cards, +0.057 ms; 5 wolves +0.278 ms); the hare's own bone table.
- [x] 3 Build (commits 5efc026, 9bf2aa9, 1d28a6f, 7a617ab; refactor e2d8d8b):
  - PROJECT-RULES 3 "species are data only": the first draft's species-named files (animals/hareBody.ts, render/hareMesh.ts)
    failed tests/rules.test.ts, so the code now lives in SHARED generators and the hare is data:
    - `src/core/rigBody.ts`: rig bone table RIG_BONE / rigLegBone (21 bones: body, head, 2 ears, tail, 4 per leg), SkinSpec,
      `rigTubes(bind, spec, coat, pelt)` on core/body.ts buildBody, `sculptRig` (dent / push), `seasonalWhiteness`,
      `localWhiteness`, `unionVolume` (proc/rng `stream`, rule 2 - the LCG is gone).
    - `src/render/rigSkin.ts`: `createRigSkin(bind, spec)` = skin + furCards fur SkinnedMeshes on one skeleton
      (playerWolf / bear pattern), shared template per spec, `setCoatDay(spec, day)`, `coatState`; card rank from `stream`
      (the 43758.5453 hash is gone).
    - `src/animals/hare.ts`: `HARE_SKIN` spec (rings, girths, pelt, coats, moult, fur, sources in its comment), `hareTubes`,
      `setHareDay`, `hareCoatState`; model() = createRigSkin(hareBind(), HARE_SKIN); update() sets the coat from
      `dayAt(worldSec())`. hare.ts removed from the IcosahedronGeometry blob allowlist (it may only shrink).
  - Refactor check: skin positions / colours / skin indices hash identical before and after (box, 6528 floats, same sums).
  - tests/hare-mesh.test.ts (7): bone table, ADW dimensions, bare volume 1.07-1.94 L (now 1.79 L), moult curve, Sheriff
    coat + summer card share, skinned to the rig, no mesh file loaded.
- [x] 4 Record + frame chain (evidence, all on the PC):
  - In-game plain recording `C:\dev\hare-mesh-rec2` (rabbit-record.json, frames/, lapse-*.jpg; geometry unchanged since).
  - Side strips after the refactor `C:\dev\hare-mesh-rec3\strip.png`, `strip-winter.png`
    (`tools/hare-strip.html?track=2.2&fov=20&wolfX=-7&wolfAt=2.2`, winter `&day=15&snow=1`), sheet `sheet.png`
    (summer / moult day 303 / winter), comparison `C:\dev\hare-mesh-rec3\compare-mesh.jpg` (reference / run 6 blob / mesh
    strip / winter ref vs winter strip / sheet; box copy /workspace/rabbit/compare-mesh.jpg).
  - Winter reference `refs/hare/winter/attempt1.jpg` + `attempts.md` (this branch, d775d18).
  - Silhouette metric (`C:\dev\hare-mesh-rec3\silscore.py` + sil.py, output silscore.txt): bounding-box aspect + fill of the
    graze and bound cells vs refs/hare/graze-alert-flight/attempt2.jpg. rec3 82.9 % (rec2 83.0 %, run-6 blob 86.7 %,
    self-match 100). Calibrated only at the self-match end, so it is NOT a gate number (rule 11).
  - Question chain vs refs/hare/ (UNCALIBRATED judgements, rule 11):
    1. Reads as a hare, not a blob? Yes - furred body, long ears, big hind feet, eye, nose leather (sheet.png).
    2. Proportions vs ref attempt 2? Body too long and flat, rump not round enough, limbs thin; graze crouch reads, bound
       stretch reads (strip rows 4-5). ~60 %.
    3. Summer coat vs ref? Brown/grey grizzle with pale feet and belly; missing the darker dorsal line, ear rims, and the
       fine agouti texture (cards read as flecks). ~60 %.
    4. Winter coat vs refs/hare/winter/attempt1.jpg? White with black ear tips; silhouette too lean (the ref is a round
       ball), fur reads as shards at the strip scale. ~55 %.
    5. In game at ~8 m: the hare is ~25 px and grass-occluded; look cannot be judged there (same as claude's T-0009 note).
  - T-0009 re-score with the mesh (uncalibrated; the T-0009 handoff on grok/rabbit-clover is NOT edited - only this brief's
    branch is touched): look 30 -> ~60 %, graze 70 -> ~75 %, alert ~85 %; others unchanged.
- [x] 5 Checks: PC `npm test` 406 tests, 394 pass, 0 fail, 12 todo (raw C:\Users\0\grok-xfer\npmtest-rig.txt); `npx tsc
  --noEmit` exit 0. Skill `notes/skills/procedural-animal-skin-fur.md` written (grok/transactional-plan 78e20dd, on main; task
  header `skill: procedural-animal-skin-fur`). Number table game column filled (same commit; partly-rows named).
  **No complete event**: gates < 95 % and uncalibrated.

## Draw cost (unchanged by the refactor)
RTX 5060 laptop, ANGLE D3D11, 1280x800, 600 synced frames, median of 3 (raw C:\dev\hare-mesh-rec3\fur-cost.txt): 1 wolf
12,975 cards fur +0.057 ms; 5 wolves +0.278 ms; 5 hares (6,995 cards each) +0.079 ms summer (~3,084 visible), +0.127 ms winter.

## Next steps (exact)
1. Calibrated look metric (rule 11): extend silscore to more cells (alert, flight) and calibrate it on a known mismatch
   (e.g. a cottontail / jackrabbit photo) and the self-match, or use T-0020's anim-gate when it lands; label until then.
2. Shape: shorten the trunk ~8 %, round the rump (trunk rings z .05-.075 ry +.008), thicken the thigh / forearm girth
   (HARE_SKIN.hind.r[0..1], fore.r[2..3]) - target bound fill .37-.40 and graze aspect .52-.55 vs the ref.
3. Coat: mid-dorsal dark line and white ear rims as ring fields (`dark` along the top; ear `pale` rim needs a per-vertex
   angle term in rigTubes - a small shared option); finer agouti: narrower cards (width .009) at higher count within the
   5-wolf budget (+0.278 ms).
4. Winter: rounder silhouette (pelt +.008 on trunk in winter coat only) and denser short cards; re-gate vs attempt1.
5. In-game visibility: a closer bench camera (`?at=` near a clover patch) for the plain recording so the hare is > 100 px.
6. Before any complete event: re-read tasks/RULES.md for a cross-family reviewer rule (Matthew deciding, 17:23 PT brief).
