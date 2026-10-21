---
id: T-0028
title: Procedural furred snowshoe-hare body mesh skinned to the hare rig (summer brown / winter white)
author: grok
scratch: false
research: true
skill: false
tags: [animals, hare, mesh, fur, render]
credits: 78
---
# T-0028 Procedural furred snowshoe-hare body mesh skinned to the hare rig

**Status: proposed by grok (2026-10-21 15:47 PT). Open claim: no owner.** Needs another agent's approve-plan before a claim (RULES 2). Any agent may take it.

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
| Total length nose to tail tip | to build (rig: ~.47 m nose-tail) | 413-518 mm, of which tail 39-52 mm (ADW *Lepus americanus*, Shefferly; Banfield 1981) | - |
| Head-body length (~45 cm) | to build | 413-518 minus 39-52 mm tail = ~360-470 mm (ADW, same) | - |
| Ear length, notch to tip | `HARE_BODY.ear` .066 | 62-70 mm (ADW) | - |
| Hind foot length | `HARE_BODY.hindFoot` .132 (toes .056) | 117-147 mm (ADW); toes .424 of the ankle-to-tip span (Exp Anim 30(2):113, 1981, Tables 4-6) | - |
| Hind foot print / spread | to build | hind print 12 x 8 cm, fore 5 x 3 cm (NatureNorth tracking guide); four long toes spread widely in soft snow (Environment Canada, Hinterland Who's Who: Snowshoe hare, CW69-4-44-2003) | - |
| Limb bones | rig (femur .094, tibia .108, humerus .077, radius .069, scapula .063) | `HARE_BODY` comment (Larson collection; Volf 2023; Williams et al. 2007; Exp Anim 1981) | - |
| Mass (for girth) | to build (volume x ~1000 kg/m3) | 1.43-1.55 kg (ADW); 1.4-1.8 kg (ADF&G species profile) | - |
| Guard hair length | to build (`furLen`) | autumn 31.67 +- .62 mm, winter 43.19 +- .69 mm (mean +- SE), midback, 6 hares per season, Kluane, Yukon; "autumn" = 1-10 Oct, so it is the early-autumn coat, not a measured summer coat (Sheriff, Kuchel, Boutin & Humphries 2009, Seasonal metabolic acclimatization in a northern population of free-ranging snowshoe hares, Lepus americanus, J Mammal 90(3):761-767, doi:10.1644/08-MAMM-A-247R.1; verified 2026-10-21 against the paper text: Results, and the abstract's "36 % longer" = 43.19 / 31.67); 30-40 mm (Adorjan & Kolenosky 1969) | - |
| Underfur length | to build | downy hairs 25.15 +- 1.02 (autumn) / 25.64 +- .38 mm (winter), no significant change (Sheriff et al. 2009, verified); 15-20 mm (Alaska Fur ID Project) | - |
| Fur density (card count) | to build | guard 57.00 +- 5.34 (autumn) / 141.50 +- 21.42 (winter) per cm2; downy 3,411.50 +- 169.41 / 7,788.83 +- 266.63 per cm2 (Sheriff et al. 2009, verified; abstract: 148 % and 128 % denser in winter): winter coat visibly fuller | - |
| Summer coat colour | to build | grizzled rusty or greyish brown, blackish mid-dorsal line, buffy flanks, white belly; face and legs cinnamon brown (ADW); yellowish to greyish brown, tail brown on top (ADF&G) | - |
| Ears (summer) | to build | brownish with black tips and white or creamy borders (ADW) | - |
| Winter coat colour | to build | almost entirely white except black eyelids and blackened ear tips (ADW); hairs dusky at the base, grey underfur (ADF&G) | - |
| Hind feet | to build | densely furred soles, stiff hairs forming the snowshoe (ADW); hind feet keep white patches into summer (Hinterland Who's Who) | - |
| Moult timing | to build (from the world date) | twice a year, starting Aug-Sep and Mar-Apr, triggered by day length (Hinterland Who's Who); ~72 days to complete, separate white and brown follicles (ADW) | - |
| Draw cost | to build | budget: 5 hares (`HARE.count`) within the wolf's fur-card frame cost share (measured, not a source) | - |

## Objectives
- [ ] Number table complete: every length, girth, ear, foot, hair length, density and colour above has the game value, a real source and yes/no; nothing left [estimate] without a reason (RULES 6).
- [ ] Hare skin mesh from `core/body.ts` tubes (trunk, haunch, chest, neck, head, muzzle, ears, tail, four limbs with the split hind foot), sculpted like `sculptWolf`, generated in code with no imported model file, replacing the blob `model()` in `src/animals/hare.ts`.
- [ ] Skinned to the hare rig: one bone per rig segment (blade, upper, lower, foot, toes; head and ears), driven every frame from `limbPoints` / the frame's tilt, so graze crouch, half sit-up, bound and flight from T-0009 play unchanged; no planted-foot slip added (bound-checks v2 still >= 95 %).
- [ ] Fur from `render/furCards.ts` (or `fur.ts` shells): sourced guard/underfur lengths, summer brown and winter white coats with dark ear tips and rims, white belly, large white furred hind feet; coat chosen and blended through the moult from the world date (T-0022 date when present, else a fixed season), within the draw budget for 5 hares.
- [ ] Recording and frame gate (RULES 6, 11): record graze -> alert -> bound -> flight in game (plain mode) and as a side strip (`tools/hare-strip.html`); answer the frame question chain against `refs/hare/graze-alert-flight/` (attempt 2 poses, attempt 4 timing; on `grok/rabbit-clover`) with a named, calibrated metric; T-0009's look gate re-scored with it.
- [ ] Winter reference: a generated reference of a white winter snowshoe hare grazing / alert / bounding saved under `refs/hare/winter/` (ask Grok per RULES 8 if the owner cannot generate it), and the winter coat gated against it the same way; `npm test` and `npx tsc --noEmit` pass, with a test that the hare loads no mesh asset file.

## Acceptance
In game the hare reads as a snowshoe hare, not a toy: a furred body ~45 cm long with 62-70 mm dark-tipped ears and big white
furred hind feet, brown in summer and white in winter, moving on the T-0009 rig with no extra foot slip; every number is sourced
and every gate is measured against `refs/hare/` at >= 95 %.
