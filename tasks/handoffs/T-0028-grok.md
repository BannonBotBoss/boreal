# Handoff: T-0028 procedural furred snowshoe-hare mesh (grok, 2026-10-21 16:36 PT; updated 17:35, 18:25 PT)
Owner agent: grok. Branch `grok/hare-mesh` (from grok/rabbit-clover a77830f: hare rig + refs/hare/), worktree
`C:\dev\boreal-grok-hare-mesh`. Preview ports 5204-5209 (this branch on 5205). Plan approved by grok-globe (16:32 PT, main b2600ea).

**Status: claimed, in progress. NOT submitted** - every calibrated look gate (lookscore v1, rule 11) is below 95 % (best: coat
winter 90.4, shape summer 29.0; see the 17:33 brief section). Also: Matthew is deciding whether a reviewer must come from a different agent family (grok vs claude/codex/agy);
tasks/RULES.md on main 7a3b27c (18:16 PT) has no such rule yet - re-check it before any complete event (grok-globe approved this plan).

## Review first (rule 15)
- 16:35 PT, main b2600ea: nothing waited on review that grok did not write.
- 17:25 PT re-check (all local branches, events since 16:00): no complete event awaits review. Read codex 16:31
  comment-T-0028 (hold approve-plan until a named skill + shared data-driven skin assembly with hare dimensions as data;
  card density != hairs/cm2; summer hair not measured) - all three are now done in this branch / the number table (below).
  Read claude 16:46 comment-T-0009 (scores uncalibrated; box-only evidence path; no cross-family reviewer rule).

- 18:25 PT re-check (main 7a3b27c): no complete event awaits a grok review on T-0028; agy complete T-0025 was reviewed by grok
  board loop (76211ee). RULES.md unchanged since 78e20dd.

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

## Draw cost (unchanged by the refactor; superseded 18:14 PT by 9000-card fur: 5 hares +0.166 ms vs 5 wolves +0.347 ms, C:\dev\hare-mesh-rec4\fur-cost.txt)
RTX 5060 laptop, ANGLE D3D11, 1280x800, 600 synced frames, median of 3 (raw C:\dev\hare-mesh-rec3\fur-cost.txt): 1 wolf
12,975 cards fur +0.057 ms; 5 wolves +0.278 ms; 5 hares (6,995 cards each) +0.079 ms summer (~3,084 visible), +0.127 ms winter.

## Next steps as of 17:35 PT (all five done in the 17:33 brief section below)
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

## Brief 17:33 PT: next steps 1-5 (grok, done 18:25 PT; code commit 387d681 on grok/hare-mesh)
Evidence folder for this brief: `C:\dev\hare-mesh-rec4\` (compare `compare-mesh2.jpg`, box copy /workspace/rabbit/compare-mesh2.jpg).
- [x] 1 Calibrated look metric v1 (rule 11) - `C:\dev\hare-mesh-rec4\look\` (lookscore.py + README.md, refmask.py, polys.py, overlay.py,
  reference masks ref-*.npy + refmask-*.jpg, score-rec4.json, score-base.json, ov-rec4.png, ov-base.png, acts-rec3.csv).
  - Game masks: new `tools/hare-strip.html?...&matte=1` (magenta background, no fog / ground / trees / labels; pageResult = the
    30 cell actions, so every strip cell is scored, not only graze + bound). Strips `matte-summer.png`, `matte-winter.png` (PC GPU).
  - Shape per pose (crouch, sit-up, gathered, push-off, stretch): area + centroid normalised IoU, best game cell among the
    cells with that pose's action. Coat per pose (crouch, sit-up): CIELAB dE76 + 12-band L* profile.
  - Calibration: KNOWN MATCH = an independent second drawing of the same pose (summer refs/hare/graze-alert-flight/attempt3.jpg,
    winter refs/hare/winter/attempt1.jpg hand-traced); KNOWN MISMATCH = the same ref hare in the other pose classes (shape) /
    the other season (coat). score = clip((x - mismatch) / (match - mismatch)) x 100. Anchors (match / mismatch IoU): summer
    crouch .903/.575, sit .884/.368, gather .864/.593, push .753/.614, stretch .669/.456; winter crouch .911/.577, sit
    .786/.334, gather .827/.573, push .607/.463, stretch .794/.446; coat match dE ~1-3, mismatch ~36-42.
  - New winter primary ref `refs/hare/winter/attempt2.jpg` (side-on 3x2 sheet, row 2 in winter/attempts.md); white-on-snow
    GrabCut needed seeded ellipses; attempt1 uses hand polygons (polys.py).
  - Weakness: winter push = 100 is suspect (its match anchor is a hand polygon at IoU .607, close to the mismatch .463).
- [x] 2 Shape (src/animals/hare.ts HARE_SKIN, sources in its header): trunk rings shortened (headZ -.3 -> -.27, neck ring at
  z -.205) -> nose-to-rump head-body .446 m (ADW 361-479 mm); rump rings z -.07..-.185 fuller (ry .019/.018, rz .046/.039);
  fore girth r [.022,.021] .. hind thigh [.034,.024] thicker; bare volume 1.878 L (inside the 1.07-1.94 L band of
  tests/hare-mesh.test.ts 'mass check': 1.43-1.55 kg at ~1000 kg/m3 [estimate], within 25 %). Girth targets are [estimate: refs] - no published girths.
- [x] 3 Coat detail: dorsal dark line = trunk ring `saddle` .15-.3 (summer only; winter coat saddle 0) - ADW "darker
  dorsal line"; pale ear rims = new shared `Ring.rim` in core/body.ts (colour toward the belly colour at the ring's rim angle;
  wolf unaffected); finer fur cards 9000 x .009 m (was 6995 x .012). Draw cost (C:\dev\hare-mesh-rec4\fur-cost.txt, RTX 5060,
  ANGLE D3D11, 600 frames): 5 hares +0.166 ms summer (median of 8), +0.170 ms winter (median of 3) vs 5 wolves +0.347 ms
  (median of 8, same session) -> inside the 5-wolf budget.
- [x] 4 Winter: `winterPelt` 1.5 (rounder; [estimate] vs refs/hare/winter attempt1+2 round "ball" outline) as a skin morph
  target (bodyW - bodyS) driven by the coat whiteness; winter fur cards built on the summer positions and moved by the nearest
  skin vertex's delta (otherwise cards scramble); head + ears pelt fixed (`grow(..., fixed)`); dark eyelids `eyelid {radius
  .015, amount .85}` (ADW / ADF&G "black eyelids"); snow-bounce hemi light in hare-strip (`&snow=1`), winter rootShade .8.
  tests/hare-mesh.test.ts test 8 "coat detail" (dorsal line summer only, pale rims, lid < .5 far, winter morph > 0 on the
  back, winterPelt > 1, cards > 7000 + width < .013).
- [x] 5 In-game camera: `?fov=` view parameter in render/buildScene.ts (5-120, default 48) and tools/rabbit-record.mjs args
  `<base> <out> <mode> <fov> <dist> <side>`; telephoto recording `C:\dev\hare-mesh-rec4\game\` (fov 16, 6.5 m behind, 1.1 m
  side; frames f000-f086 + rabbit-record.json). Sizes `C:\dev\hare-mesh-rec4\rec4g-sizes.md`: graze ~119-127 x 46-52 px, alert
  105 x 88, flee start 117 x 100 (> 100 px wide), end-on at 4.4-4.9 s only 56-62 px; the hare leaves frame after ~6.8 s.
- Board (grok/transactional-plan, ff-merged into the served main): 9c14a01 number table (head-body .446 m, bare 1.878 L,
  9000 x .009 cards, dorsal line / rims / eyelids modelled, draw cost re-measured); ebbc897 skill lessons. RULES.md re-checked
  on main 7a3b27c/ebbc897 at 18:25 PT: no cross-family reviewer rule.
- Checks: PC `npm test` 407 tests, 395 pass, 0 fail, 12 todo (C:\dev\hare-mesh-rec4\npmtest.txt); `npx tsc --noEmit` exit 0
  (C:\dev\hare-mesh-rec4\tsc.txt).

### Calibrated scores (rule 11: metric lookscore v1, tool C:\dev\hare-mesh-rec4\look\lookscore.py, calibration above)
| gate | rec4 (this brief) | baseline (pre-brief code) |
|---|---|---|
| shape summer (mean of 5 poses) | 29.0 | 16.1 |
| shape winter (mean of 5 poses) | 53.0 | 39.7 |
| coat summer (crouch, sit) | 87.7 | 86.1 |
| coat winter (crouch, sit) | 90.4 | 76.5 |
Per pose: summer crouch 24.0, sit 18.1, gather 13.1, push 30.9, stretch 58.9; winter crouch 45.7, sit 32.1, gather 30.3,
push 100 (suspect), stretch 57.0. Coat: summer crouch 85.1, sit 90.3; winter crouch 83.6, sit 97.2.
Baseline = box (swiftshader) render without snow lighting, so the winter coat gain is partly lighting.
Reading: shape is limited mostly by the T-0009 POSES (the alert is a head-up crouch, not the ref's upright sit-up; gathered /
extended phases differ), not by the mesh; T-0028 may not change gait or pose numbers -> that work is T-0009 / T-0020.
T-0009 re-score with this metric (noted here only, the T-0009 handoff is not edited): look ~58 (mean shape+coat summer),
graze 24 (summer crouch), alert 18 (summer sit).
**Not submitted**: every gate is below 95 %. tasks/RULES.md on main 7a3b27c (18:16 PT) re-checked: still no cross-family
reviewer rule.

## Next steps (exact, after the 17:33 brief)
1. Poses in T-0009 / T-0020 (not here): an upright alert sit-up and distinct gathered / extended bound phases; that is where
   shape summer 29 / sit 18 / gather 13 can move.
2. Better winter push anchor: a second independent winter drawing with a clear push-off (GrabCut-able), replacing the hand polygon.
3. Coat metric on the bound poses too (only crouch + sit now); add an end-on (rear) view to the strip and a ref for it.
4. In-game: the end-on flee view is ~60 px; a side offset > 1.1 m or a follow camera in rabbit-record for flight.
5. Before any complete event: re-read tasks/RULES.md on main for a cross-family reviewer rule (Matthew deciding).

## Re-score with the calibrated metric (grok, 19:05 PT, from the T-0009 run 7 brief of 18:23 PT)
Code measured: grok/rabbit-clover 02e1ebc = this branch 8edcad8 (fast-forwarded in) + T-0009 run 7 poses + a shared CHEST bone
(core/rigBody.ts RIG_BONE.chest 21, RIG_BONE_COUNT 22; render/rigSkin.ts head parented to the chest; HARE_SKIN chest weights).
This branch is not changed in code; merge grok/rabbit-clover here if T-0028 should carry the chest bone. Evidence (PC GPU strips,
tools/strip-shot.mjs on 5204): C:\dev\rabbit-rec11\look\ (gs/gw/ss/sw/ge/se-pc8.png, score-pc8.json, score12-pc8.json,
endscore-pc8.json), compare C:\dev\rabbit-rec11\compare-poses.jpg. Metric lookscore v1.2 (C:\dev\rabbit-rec11\look\lookscore.py,
README.md): v1 + bound poses from a stride phase sheet (?stride=8.5), coat on all 5 poses, winter known match = independent
refs/hare/winter/attempt4.jpg (the hand-polygon attempt1 retired), winter push-off vs attempt4 panel 5 with attempt5 as match.
| gate | rec4 (v1, 17:33 brief) | run 7 (v1, PC GPU) | run 7 (v1.2, PC GPU) |
|---|---|---|---|
| shape summer | 29.0 | 36.9 | 46.2 |
| shape winter | 53.0 | 64.0 | 73.7 |
| coat summer | 87.7 | 88.3 | 86.4 |
| coat winter | 90.4 | 91.7 | 95.5 |
| end-on shape / coat (endscore, new) | - | - | 39.9 / 85.5 |
Only coat winter reaches 95 %. **Not submitted**: the other gates are below 95 %. tasks/RULES.md on main ebbc897 re-checked
19:03 PT: no cross-family reviewer rule. In game with the new ?watch=hare camera (C:\dev\rabbit-rec11\game\), the hare stays
in frame through the flight, readable to ~20 m (rec4 lost it after ~6.8 s).
