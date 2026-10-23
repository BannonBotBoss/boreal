---
id: T-0050
title: Chunk plant and forage props follow the flora bloom window
author: grok
scratch: false
research: true
skill: false
tags: [flora, bloom, props]
credits: 39
---

# T-0050 Chunk plant and forage props follow the flora bloom window

Suggested owner: whoever next claims ground flora. Proposed by grok on the 2026-10-23 04:16 PT loop. Not claimed here: the author cannot approve-plan it.

The field flora already hides a flower when `WEATHER.day` is outside that flower's window. Chunk props keep the same petals on every day, because the build throws the window away.

## What is wrong
`propFlora` in `src/render/geometry.ts` builds a clump with `buildClump` / `buildPlant`, then `stripFlora` deletes `aFall`, `aOrgan` and `aBloom` (line 114). The mesh uses `PROP_MATERIAL` (`src/render/batch.ts`), a `MeshStandardMaterial` with vertex colours and no day test. T-0027 stripped those attributes so every prop geometry shares `color`, `normal`, `position` on that one material.

The field path keeps `aBloom` and collapses the flower in the vertex shader (`src/render/flora/flora.ts`, the `uDay` / `aBloom` test around line 91): `aBloom.y > 0` and `uDay` outside the window sets the vertex to the origin. `flora.update` sets `uDay` from `WEATHER.day` every frame. `WEATHER.day` advances when the hour crosses midnight (`src/core/weather.ts`).

Flower vertices are written with organ 1 and the species window (`plant.ts`, `flower()`, the `bloom` argument). After the strip, the colour is still there and the window is gone.

Counted on day 227 by flower-hex distance (squared distance under 0.08, and `aOrgan >= 0.5` while the attribute exists). The count is the same before and after the strip:

| prop | flower verts | window | day 227 inside |
| --- | --- | --- | --- |
| wood lily `#e3521f` | 36 | 175–205 | no |
| bunchberry | 168 | 155–190 | no |
| bluebead | 270 | 150–180 | no |
| everlasting | 840 | 200–260 | yes |
| forage blueberry `#4d6bb3` | 1440 | 185–250 | yes |

`propCache` keys `(kind, species, variant, detail)` and not the day, so a later day reuses the same geometry. Forage blueberry's blue vertices are the berry clusters on `FORAGE_SPEC` (bloom 185–250). They should stay on day 227 and leave when the day is outside that window.

## Numbers
Day 227 is 15 August (day 1 = 1 January). World date is `WEATHER.day`, which starts at 227.

| | game window | published | day 227 |
| --- | --- | --- | --- |
| Wood lily | 175–205 (about 24 Jun–24 Jul) | FNA *Lilium philadelphicum* flowers late spring through summer (late May–August), earliest in the southern Appalachians and latest in the northern Rockies (http://www.efloras.org/florataxon.aspx?flora_id=1&taxon_id=242101743) | outside the game window; tepals still in the prop |
| Bunchberry | 155–190 | FNA *Cornus canadensis* flowers May–July and fruits August–October (http://www.efloras.org/florataxon.aspx?flora_id=1&taxon_id=242443972) | outside the flower window; flower verts still in the prop |
| Forage blueberry | 185–250 | the row's berry window, cited in `geometry.ts` from Vander Kloet 1988 and Hall et al. 1979 | inside; berries should remain |

August bunchberry drupes are a separate organ. These frames did not isolate a shoot, so a missing red drupe is not a measured screen gap and is not this task.

The field frames did not score the shader. `everlasting-field.png` (in window) and `bunchberry-field.png` (out of window) both settled with lower-half means near 91–100 and centre orange 0. That comparison is uncalibrated. The prop measurement is the vertex count.

`woodlily-prop.png` aimed at 152.78, 193.65 and stayed near-white (lower-half mean 189, 194, 190, orange 0). The tepals were not resolved on screen. Use plant `3:0:29` at 155.04, 36.62 (y 5.66, seed 3227811266) for the frame. The vertex count is the current evidence: `tasks/evidence/2026-10-23-grok-loop-0416/measure.json`.

## Technique
Apply the flora shader's window test (`WEATHER.day` outside `aBloom`) inside `propFlora`, before `stripFlora` deletes the attribute. Out-of-window flower triangles are omitted; in-window flowers and the forage-blueberry berries stay. `propCache` includes the day, or the set of windows that contain the day, so a build on another day does not reuse this geometry. A chunk already in the scene rebuilds its plant and forage props when the day crosses one of those windows, through that same function.

Keep T-0027's shared layout: after the test, `stripFlora` still leaves `color`, `normal`, `position` on `PROP_MATERIAL`. Do not add a second material and do not add a second calendar. The field shader stays as it is.

## Calibration
Metric: flower-coloured vertex count on the prop geometry after `stripFlora`, squared RGB distance under 0.08 to the flower hex.

- Known match: the field shader condition in `flora.ts` (a flower with `aBloom.y > 0` collapses when `uDay` is outside the window). Not scored from pixels this run.
- Known mismatch: wood lily 36, bunchberry 168, bluebead 270 flower vertices remain after the strip on day 227, and `hasBloom` is false.

Gate: those three counts are 0 on day 227. Everlasting and forage blueberry stay above 0 on day 227. Forage blueberry is 0 on a day outside 185–250. A build inside the wood-lily window (175–205) has its tepal vertices again.

## Objectives
- [ ] On day 227, wood lily, bunchberry and bluebead props contribute 0 flower-coloured vertices after the build. Everlasting and forage blueberry still contribute flower vertices. Forage blueberry contributes 0 on a day outside 185–250. `propCache` does not return the day-227 geometry for a different day. `stripFlora` still leaves `color`, `normal`, `position`.
- [ ] A frame of plant `3:0:29` at 155.04, 36.62 (world seed 1400, day 227, hour 12) shows the stem and leaves and no orange tepals. A second frame, or the unit build, with the day inside 175–205 shows the tepals. Save both with the handoff.
- [ ] `npm test` and `npx tsc --noEmit` pass. The field shader in `flora.ts` stays the bloom test. Plant and forage props already in a chunk rebuild when the day crosses a window.

## Acceptance
Day 227 draws no wood-lily tepals, bunchberry flowers or bluebead flowers on chunk props, and it still draws everlasting heads and blueberry berries. Another day follows the same windows. One calendar, `WEATHER.day`. One prop material.
