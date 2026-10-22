# Skill: build a procedural furred animal body (tube skin + fur cards) skinned to an existing rig, as species data

Use when an animal needs a real body instead of blobs or an imported model, and it already moves on a rig (bounding.ts,
wolf IK, ...). First written by grok for the snowshoe hare (T-0028, 2026-10-21, branch grok/hare-mesh).

## Rules that shape the design (read first)
- PROJECT-RULES 3 "species are data only": no new species-named source file (tests/rules.test.ts path regex
  `wolf|bear|deer|hare|elk|moose|fox|bird|owl|lynx|rabbit|animalRig`). The species is a `SkinSpec` record in its existing
  host file; the code goes in shared generators. A first draft as `animals/hareBody.ts` + `render/hareMesh.ts` failed npm test.
- PROJECT-RULES 2: no second RNG / hash (banned `Math.imul(`, `1664525`, `0x6d2b79f5`, `43758.5453`); use proc/rng
  `stream(seed, label)` for any sampling (Monte Carlo volume, card ranks).
- The blob allowlist (`IcosahedronGeometry`) may only shrink: remove the host file from it once the blobs are gone.
- No mesh asset: add a test that greps the sources for `.glb|.gltf|.fbx|.obj` loaders and checks `public/` has none
  (`existsSync`, the box copy may lack public/).

## Steps
1. **Number table first** (rule 6): every length, girth, ear, foot, hair length, density, colour and moult date with a
   source; mark estimates. Measure the draw-cost baseline of an existing furred animal before giving the new one a number
   (tools/fur-cost.html: N animals in view, 600 synced frames, median of 3, fur on vs off).
2. **Bind pose from the rig**: run the rig standing still at the origin (heading 0) for ~2 s and read its joints
   (`limbPoints`), relative to the hip-joint midpoint (animals/hare.ts `hareBind`).
3. **Skin** = `core/rigBody.ts rigTubes(bind, spec, coat, pelt)` over `core/body.ts buildBody`: trunk / neck / head / tail
   rings in pivot or head-bone space, ears as flat leaves, one tube per leg through the rig joints (ring at each joint
   blending its two bones + mid-segment rings; `ref [1,0,0]` keeps the ring frame from flipping at knee / hock). Gotchas:
   - a sharply folded chain (fore leg ~150 deg at the elbow) gives Catmull overshoot and edge-on rings: split the upper arm
     into its own short tube;
   - lift any leg ring whose half-width + pelt reaches below y 0;
   - eyes go on the pelt surface (the underfur layer buries them otherwise), with a fur clear zone ~ the guard-hair length;
   - draw dense underfur as a pelt offset of the skin (sourced length), keep the bare body (pelt 0) for the mass check
     (`unionVolume`, sourced mass / [estimate] density band).
4. **Fur + assembly** = `render/rigSkin.ts createRigSkin(bind, spec)`: skin + `furCards.buildFurCards` as two
   SkinnedMeshes on one skeleton (bone per rig segment + body / head / ears / tail); geometry and materials shared by every
   animal of the spec (`userData.shared`, skip them in remove()). The host poses each segment bone onto its rig joint each
   frame (`position = joint`, `quaternion.setFromUnitVectors(bindDir, dir)`).
5. **Season**: build summer and winter bodies + cards with the same seed (same cards, different colours); `setCoatDay(spec,
   dayAt(worldSec()))` blends colour and card length and hides cards above the summer density share. Record the wanted
   value before the first build (a call before any animal exists must not be lost).
6. **Pictures + gates**: a sheet page (side, three-quarter, head, feet x summer / moult / winter), the side strip, the
   in-game plain recording; question chain against refs/<animal>/; generate a missing seasonal reference (attempts.md).
   Copy every cited image to the PC (C:\dev\<task>-recN or refs/) - a box path cannot be opened by a reviewer.

## Checks that proved it worked
- tests: own bone table count, sourced dimensions (head-body, ear, hind foot), bare volume band, moult curve, summer card
  share, skinned to the rig with one skeleton, no mesh file; tests/rules.test.ts 0 new violations.
- Refactor check: hash of the skin positions / colours / skin indices identical before and after moving code to generators.
- npm test + npx tsc --noEmit on the PC (the box lacks vendor/detect-gpu, so box tsc shows one unrelated error).

## Mistakes to avoid
- Species-named files, private hashes, copying wolfBody instead of feeding it data.
- Calling a summer hair length "measured" when the source sampled the early-autumn coat: mark it [estimate].
- Fur-card count is a sampling density, not hairs/cm2: tie only the summer/winter RATIO to the measured densities.
- Scores without a calibrated metric are labelled uncalibrated (rule 11).
