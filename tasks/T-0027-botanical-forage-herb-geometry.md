---
id: T-0027
title: Replace cartoon icosahedron forage and herb blobs with botanical geometry from core/flora/plants
author: agy
scratch: false
research: true
skill: boreal-forage-herb-geometry
tags: [flora, forage, props, render]
credits: 39
---
# T-0027 Replace cartoon icosahedron forage and herb blobs with botanical geometry from core/flora/plants

**Status: completed by agy (2026-10-21 13:02 PT). Plan approved by grok (2026-10-21 12:14 PT).**

**Credits: 39** (= 10 x 3 objectives x (1 + 0.3 research)). Matthew can change it.

## What I saw (recorded 2026-10-21, agy/loop at 3c5da10 = main, port 5250)
Recording: `refs/rocks/shield-audit/upland-ridge-0.png`, `upland-walk-2.png`, `forest-floor-0.png`, `forest-walk-2.png` (`capture.mjs`).

Description:
1. In `upland-ridge-0.png` (centre foreground, directly in front of the wolf) and `forest-floor-0.png` (centre background next to the tree trunk), the interactive `"Practice herb"` entity (`entity.kind === 'plant'`, `src/render/geometry.ts:139-145`) is rendered as 5 vertical green icosahedron columns (`0.46 m` wide × `0.85 m` tall) crowned by 5 huge orange-yellow faceted spheres (`0.26–0.30 m` diameter each), scaled by `entity.scale` (`0.75–1.40`), forming a **0.71–1.33 m tall cactus-like blob that towers over the wolf (`0.75 m` shoulder height)** (`292 px` tall vs `215 px` wolf height in `upland-ridge-0.png`).
2. Across `upland-walk-2.png` and `forest-floor-0.png`, every interactive `"Forage berry patch"` (`entity.kind === 'forage'`, `src/render/geometry.ts:132-138`) is rendered as 7 green icosahedron cushions topped by 7 bright blue spheres of radius `0.06 m` (`12 cm` diameter before `0.65–1.0` scale = **7.8–12.0 cm diameter per single berry**, the size of a grapefruit!).

## Does it look natural? How I know
In the boreal forest (and in our accepted nature reference `refs/rocks/reference/shield-ridge-ref.png`):
- Lowbush blueberry (*Vaccinium angustifolium*) is a low woody dwarf shrub **15–35 cm tall** with small elliptical leaves (`1–3 cm`) and berries **6–12 mm (`0.006–0.012 m`) in diameter** (Vander Kloet 1988, *The Genus Vaccinium in North America*, Agriculture Canada Publ. 1828; Hall et al. 1979, *Can. J. Plant Sci.* 59:193). Game berries (`78–120 mm`) are **10x too large in diameter (1,000x in volume)**.
- Boreal understorey herbs (bunchberry *Cornus canadensis* `10–20 cm` tall, bract cluster `2–4 cm`; bluebead lily *Clintonia borealis* `15–30 cm`; wild sarsaparilla *Aralia nudicaulis* `30–50 cm`; fireweed *Chamaenerion angustifolium* `40–90 cm` with `2–3 cm` petals, Sims et al. 1997 NW Ontario FEC) have slender stems, thin leaf blades, and centimetre-scale flowers/berries — never `30 cm` orange spheres on `46 cm` thick green pillars.
- Moreover, the codebase **already has** a realistic botanical mesh builder in `src/render/flora/plant.ts` (`buildPlant` / `buildClump`) and species data table in `src/core/flora/plants.ts` (`FLORA`, including `blueberry`, `bunchberry`, `fireweed`, `bluebead`, `sarsaparilla`, `labrador-tea`, `rose`)! Only `src/render/geometry.ts:132-145` still uses the old pre-flora placeholder icosahedra.

## Numbers (game vs nature)
| Quantity | Game (`src/render/geometry.ts:132-145`) | Nature (published source) | Resembles? |
|---|---|---|---|
| Single blueberry diameter (`forage`) | **78–120 mm** (`2 * 0.06 m * scale 0.65..1.0`) | **6–12 mm** (*Vaccinium angustifolium*, Vander Kloet 1988; Hall et al. 1979) | **No** (10x too large in diameter) |
| Blueberry shrub height (`forage`) | `0.25–0.38 m` (`0.385 * scale`) | **0.15–0.35 m** (Vander Kloet 1988; `FLORA` `blueberry` in `src/core/flora/plants.ts`: `h = [0.22, 0.06]`) | Height yes, organ geometry no |
| Herb flower / bud head diameter (`plant`) | **195–364 mm** (`2 * 0.13 m * scale 0.75..1.40`) | **15–35 mm** (boreal forest herbs: *Cornus canadensis*, *Clintonia borealis*, *Chamaenerion angustifolium*, Sims et al. 1997; `src/core/flora/plants.ts`) | **No** (10x too large) |
| Herb leaf thickness (`plant`) | **345–644 mm** thick solid icosahedra (`2 * 0.23 m * scale`) | **< 2 mm** leaf lamina thickness on `20–50 mm` blades (`src/core/flora/plants.ts`) | **No** (>100x too thick) |
| Herb total height relative to wolf withers (`0.75 m`) | **0.71–1.33 m** (`0.95–1.77x` wolf height; `1.36x` in `upland-ridge-0.png`) | **0.10–0.45 m** (`0.13–0.60x` wolf height for bunchberry / bluebead / sarsaparilla, Sims et al. 1997) | **No** (2–3x too tall, cactus-like silhouette) |

## Proposed implementation / scope (reuse first)
- Reuse `buildPlant` / `buildClump` from `src/render/flora/plant.ts` and the sourced species data in `src/core/flora/plants.ts` (`blueberry` for `forage`, and herb species from `FLORA` for `plant`) inside `generateGeometry` (`src/render/geometry.ts:132-145`), stripped of custom flora shader attributes or adapted to `PROP_MATERIAL` vertex colours so chunk batching (`src/render/batch.ts`) works with zero extra draw calls or materials.
- Scale berry size on `forage` clusters to sourced *Vaccinium* dimensions (`8–12 mm` berries in small terminal clusters on a multi-stem lowbush shrub clump) so the patch remains recognizable for foraging while matching botanical proportions.
- Keep `entityMass` (`src/render/mass.ts`) and all existing interaction/forage tests green.

## Objectives
- [x] Replace the placeholder icosahedron loops for `forage` and `plant` in `src/render/geometry.ts:132-145` by reusing the botanical geometry builder (`src/render/flora/plant.ts` / `src/core/flora/plants.ts`) with vertex colours on `PROP_MATERIAL`.
- [x] Match sourced organ dimensions (lowbush blueberry shrub `0.18–0.35 m` tall with clustered `8–12 mm` berries; understorey herb `0.15–0.40 m` tall with thin leaves and `15–30 mm` inflorescence).
- [x] Verify both gates: re-record `upland-ridge-0.png` and `forest-floor-0.png` via `refs/forage/t0027-audit/capture.mjs`, verify organ/height numbers table and >=95% visual match against `refs/rocks/reference/shield-ridge-ref.png`, and pass `npm test` and `npx tsc --noEmit`.

## Acceptance
No giant cactus-like `plant` blobs or 12 cm grapefruit-sized `forage` spheres appear anywhere in the world; `forage` and `plant` entities render as botanical lowbush blueberry clumps and boreal herbs from `core/flora/plants` in the chunk batch with 0 extra draw calls; `npm test` and `npx tsc --noEmit` pass.
