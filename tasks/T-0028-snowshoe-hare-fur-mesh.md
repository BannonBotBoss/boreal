---
id: T-0028
title: Procedural furred snowshoe-hare body mesh skinned to the hare rig (summer brown / winter white)
author: grok
scratch: false
research: true
skill: procedural-animal-skin-fur
tags: [animals, hare, mesh, fur, render]
credits: 78
---
# T-0028 Procedural furred snowshoe-hare body mesh skinned to the hare rig

**Status: claimed by grok (2026-10-21 16:37 PT) after grok-globe's approve-plan (16:32 PT).** Work on branch `grok/hare-mesh`, handoff `tasks/handoffs/T-0028-grok.md`.

**Credits: 78** (= 10 x 6 objectives x (1 + 0.3 research); not from scratch: it reuses the wolf body and fur builders). Matthew can change it.

## Why
T-0009 (hare grazes clover, alerts, flees; grok, branch `grok/rabbit-clover`) is held at **look 30 %**: the hare is drawn as
icosahedron blobs (`src/animals/hare.ts` `model()`), with stick-segment legs. The gait, poses and clover gates moved in runs 3-5,
but nothing on the board owns a real hare body, so the look gate cannot pass. This task builds that body.

## Hard constraints
- **Procedural only.** No downloaded, purchased or imported model (no .glb/.gltf/.fbx/.obj/.vrm or any mesh asset file for the hare);
  every vertex is generated in code at runtime.
- **Reuse before writing.** Build it the way the wolf is built:
  - tube skin `src/core/body.ts` (`buildBody`, `Tube`/`Ring`, `dent`, `push`, `computeNormals`), pattern in
    `src/core/wolfBody.ts` (`wolfTubes`, `sculptWolf`, `earFrame`, bone table `BONE` / `legBone`);
  - fur cards `src/render/furCards.ts` (`buildFurCards`, `furCardMaterial`, per-vertex `furLen`), or `src/render/fur.ts` shells
    if card count is over budget;
  - skinned-mesh assembly as in `src/render/playerWolf.ts` `createPlayerWolf` (skin + fur `SkinnedMesh` on one skeleton,
    fur-root shade under the cards).
- **Skins onto the existing hare rig.** The bones are the T-0009 rig: `HARE_BODY` / `HARE_PLAN` / `skeletonOf` and the bounding
  controller frame (`src/animals/locomotion/bounding.ts` `limbPoints`: blade pivot, glenoid, elbow, wrist, toe; hip, knee, hock,
  MTP, toe tip). The stick legs become the skeleton (bone per segment); body pitch, head and ear groups keep their pose targets
  from `hare.ts` `POSES`. No change to the gait or pose numbers. (The rig is on `grok/rabbit-clover`, not yet on main: work from
  that branch or after T-0009 lands.)
- **Every dimension sourced** (table below); a size without a source is marked [estimate] and cannot pass the numbers gate.

## Numbers (to build; the handoff fills the game column and the yes/no)
| Quantity | Game | Real figure + source | Resembles? |
|---|---|---|---|
| Total length nose to tail tip | skin .486 m (tail tube ~50 mm from its base, 21 mm past the rump fur line) | 413-518 mm, of which tail 39-52 mm (ADW *Lepus americanus*, Shefferly; Banfield 1981) | yes |
| Head-body length | skin nose to rump .467 m with the pelt; tests/hare-mesh.test.ts holds it to 361-479 mm | 413 - 52 = 361 to 518 - 39 = 479 mm (ADW, same; arithmetic corrected per grok-globe 16:32 review) | yes |
| Ear length, notch to tip | `HARE_BODY.ear` .066 = the ear tube length from its crown base (HARE_SKIN.ear rings t 0..1) | 62-70 mm (ADW) | yes |
| Hind foot length | `HARE_BODY.hindFoot` .132 (toes .056); tests/hare-mesh.test.ts holds the skin foot to 117-147 mm | 117-147 mm (ADW); toes .424 of the ankle-to-tip span (Exp Anim 30(2):113, 1981, Tables 4-6) | yes |
| Hind foot print / spread | hind foot 13.2 cm long; skin width 2 x (.020 + pelt .012) = 6.4 cm at the MTP, plus combed guard-hair cards; fore paw 2 x (.009-.011 + .012) = 4.2-4.6 cm wide | hind print 12 x 8 cm, fore 5 x 3 cm (NatureNorth tracking guide); four long toes spread widely in soft snow (Environment Canada, Hinterland Who's Who: Snowshoe hare, CW69-4-44-2003) | length yes; width 6.4 vs 8 cm partly (no toe spread modelled) |
| Limb bones | rig (femur .094, tibia .108, humerus .077, radius .069, scapula .063); the skin bones are laid on these segments each frame (poseHare) | `HARE_BODY` comment (Larson collection; Volf 2023; Williams et al. 2007; Exp Anim 1981) | yes |
| Mass (for girth) | bare body (pelt 0) 1.79 L by Monte Carlo union of the closed tubes (core/rigBody unionVolume, proc/rng stream) = 1.79 kg at 1000 kg/m3; test band 1.07-1.94 L | 1.43-1.55 kg (ADW); 1.4-1.8 kg (ADF&G species profile); density ~1000 kg/m3 is **[estimate]** (water; mammal soft tissue ~1.0-1.1 g/cm3, no hare-specific source found), so girth is sourced to +-25 % only | yes (density [estimate]) |
| Guard hair length | fur cards 43.19 mm in winter; 31.67 mm outside the moult (HARE_SKIN.fur) - the early-Oct autumn value used for summer [estimate: no measured summer coat] | autumn 31.67 +- .62 mm, winter 43.19 +- .69 mm (mean +- SE), midback, 6 hares per season, Kluane, Yukon; "autumn" = 1-10 Oct, so it is the early-autumn coat, not a measured summer coat (Sheriff, Kuchel, Boutin & Humphries 2009, Seasonal metabolic acclimatization in a northern population of free-ranging snowshoe hares, Lepus americanus, J Mammal 90(3):761-767, doi:10.1644/08-MAMM-A-247R.1; verified 2026-10-21 against the paper text: Results, and the abstract's "36 % longer" = 43.19 / 31.67); 30-40 mm (Adorjan & Kolenosky 1969) | yes winter; summer [estimate] |
| Underfur length | drawn as a pelt offset of the skin: 25 mm trunk / neck / tail, 12 mm head and limbs [estimate: thinner], 1.5 mm ears, none on the nose (HARE_SKIN.pelt) | downy hairs 25.15 +- 1.02 (autumn) / 25.64 +- .38 mm (winter), no significant change (Sheriff et al. 2009, verified); 15-20 mm (Alaska Fur ID Project) | yes trunk; head / limb [estimate] |
| Fur density (card count) | 7,000 card slots per hare (6,995 placed): a SAMPLING density, not hairs/cm2. Winter shows all, summer .44 of them (HARE_SKIN.fur.summerDensity) = the measured autumn/winter ratio (downy 3,411.5 / 7,788.8 = .44; guard .40) | guard 57.00 +- 5.34 (autumn) / 141.50 +- 21.42 (winter) per cm2; downy 3,411.50 +- 169.41 / 7,788.83 +- 266.63 per cm2 (Sheriff et al. 2009, verified; abstract: 148 % and 128 % denser in winter): winter coat visibly fuller | yes (ratio only) |
| Summer coat colour | back RGB [.36,.27,.18] with dark guard tips (tipAmount .35), buff cheeks (accent), white belly [.86,.84,.8], cinnamon-pale feet; no mid-dorsal line yet | grizzled rusty or greyish brown, blackish mid-dorsal line, buffy flanks, white belly; face and legs cinnamon brown (ADW); yellowish to greyish brown, tail brown on top (ADF&G) | partly (no dorsal line) |
| Ears (summer) | brownish ear tube, black over the last ~15 % (dark .7-1); no white rim yet | brownish with black tips and white or creamy borders (ADW) | partly (no rim) |
| Winter coat colour | white [.9,.9,.88] all over, black ear tips kept; eyelids not modelled | almost entirely white except black eyelids and blackened ear tips (ADW); hairs dusky at the base, grey underfur (ADF&G) | partly (eyelids) |
| Hind feet | foot cards combed toward the toes (lean .5), pale .75 on the feet (white patches in summer); broad snowshoe from HARE_SKIN.hind girths | densely furred soles, stiff hairs forming the snowshoe (ADW); hind feet keep white patches into summer (Hinterland Who's Who) | yes |
| Moult timing | core/rigBody.ts `seasonalWhiteness(day, HARE_SKIN.moult)` from the world date (`timeOfDay.dayAt(worldSec())`): autumn from day 283 over 40 d, spring from day 100 over 40 d; low parts whiten first (`localWhiteness`, [estimate] order) | Mills, Zimova, Oyler, Running, Abatzoglou & Lukacs 2013, Camouflage mismatch in seasonal coat color due to decreased snow duration, PNAS 110(18):7360-7365, doi:10.1073/pnas.1222724110 (verified 2026-10-21 in the PMC text PMC3645584): initiation dates fixed (~10 Oct / ~10 Apr, Science news summary of the paper), autumn brown-to-white "about 40 d each year", spring rate plastic (30-50 d); twice a year Aug-Sep / Mar-Apr by day length (Hinterland Who's Who); ADW's ~72 d is the general figure | yes |
| Draw cost | 5 hares x 6,995 cards (summer shows 3,084 each): fur +0.079 ms/frame summer, +0.127 ms winter | **baseline measured first** (tools/fur-cost.html, RTX 5060 laptop, ANGLE D3D11, 1280x800, 600 synced frames, median of 3): player wolf 12,975 cards, fur +0.057 ms; 5 wolves +0.278 ms. Budget: 5 hares <= 5 wolves' fur cost (measured, not a source) | yes (0.127 <= 0.278 ms) |
| Bone table | shared table `RIG_BONE` / `rigLegBone` (core/rigBody.ts; species data in animals/hare.ts HARE_SKIN, PROJECT-RULES 3): body, head, 2 ears, tail + 4 rig segments per leg = 21 bones (the wolf's `BONE`/`legBone` pattern, not its 27 indices); shared builders body.ts / furCards.ts unchanged, no hare copies | grok-globe 16:32 review note (e) | yes |

## Objectives
- [x] Number table complete (2026-10-21 17:29 PT; partly-rows named): every length, girth, ear, foot, hair length, density and colour above has the game value, a real source and yes/no; nothing left [estimate] without a reason (RULES 6).
- [ ] Hare skin mesh from `core/body.ts` tubes (trunk, haunch, chest, neck, head, muzzle, ears, tail, four limbs with the split hind foot), sculpted like `sculptWolf`, generated in code with no imported model file, replacing the blob `model()` in `src/animals/hare.ts`.
- [ ] Skinned to the hare rig: one bone per rig segment (blade, upper, lower, foot, toes; head and ears), driven every frame from `limbPoints` / the frame's tilt, so graze crouch, half sit-up, bound and flight from T-0009 play unchanged; no planted-foot slip added (bound-checks v2 still >= 95 %).
- [ ] Fur from `render/furCards.ts` (or `fur.ts` shells): sourced guard/underfur lengths, summer brown and winter white coats with dark ear tips and rims, white belly, large white furred hind feet; coat chosen and blended through the moult from the world date (T-0022 date when present, else a fixed season), within the draw budget for 5 hares.
- [ ] Recording and frame gate (RULES 6, 11): record graze -> alert -> bound -> flight in game (plain mode) and as a side strip (`tools/hare-strip.html`); answer the frame question chain against `refs/hare/graze-alert-flight/` (attempt 2 poses, attempt 4 timing; on `grok/rabbit-clover`) with a named, calibrated metric; T-0009's look gate re-scored with it.
- [ ] Winter reference: a generated reference of a white winter snowshoe hare grazing / alert / bounding saved under `refs/hare/winter/` (ask Grok per RULES 8 if the owner cannot generate it), and the winter coat gated against it the same way; `npm test` and `npx tsc --noEmit` pass, with a test that the hare loads no mesh asset file.

## Acceptance
In game the hare reads as a snowshoe hare, not a toy: a furred body ~45 cm long with 62-70 mm dark-tipped ears and big white
furred hind feet, brown in summer and white in winter, moving on the T-0009 rig with no extra foot slip; every number is sourced
and every gate is measured against `refs/hare/` at >= 95 %.
