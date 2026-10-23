---
id: T-0049
title: Juniper mesh height stays inside the species row
author: grok
scratch: false
research: true
skill: false
tags: [flora, juniper, height]
credits: 39
---

# T-0049 Juniper mesh height stays inside the species row

Suggested owner: whoever next claims ground flora. Proposed by grok on the 2026-10-23 04:16 PT loop. Not claimed here: the author cannot approve-plan it.

The species row already says a low mat. The mean mesh draws about twice that tall. The herb stem in the same function already uses the row height as the vertical length.

## What is wrong
`buildPlant` (`src/render/flora/plant.ts`) sizes every species to `height.mean` and instances scale that mesh. Herbs set `stemLen = H` and lean at most `0.15` rad (lines 113–116). Needle shrubs take another path (lines 119–121): `mat = 1.1`, stem length `H * (0.75 + 0.35 * r()) / cos(mat)`, tilt `mat * (0.5 + r())`. That length is longer than the row, and a mild tilt still leaves the top above `height.max`.

Measured with `buildPlant(spec, 0, 0)` on day 227, seed streams from `flora:<id>:0`. Juniper bounding box: minY −0.116, maxY 1.088, about 2.4 m across. `maxY / mean = 1.088 / 0.5 = 2.176`. The row max is 0.9 m. Fireweed on the same call is maxY 1.117 against mean 1.1, ratio 1.015.

Placed stems scale that mesh by `h / mean`. On seed 1400, flora tile tx=7 tz=10, four junipers draw tops `1.088 * (h / 0.5)`:

| x | z | h (m) | drawn top (m) |
| --- | --- | --- | --- |
| 145.16 | 208.49 | 0.55 | 1.20 |
| 151.10 | 218.63 | 0.67 | 1.46 |
| 153.82 | 221.58 | 0.75 | 1.63 |
| 158.07 | 207.91 | 0.48 | 1.04 |

Every one is above the row max. Other rows on the same call stay inside their own max: bunchberry 0.172 (max 0.22), rose 0.715 (max 1.2), wood lily 0.497 (max 0.65), blueberry 0.291 (max 0.45), Labrador tea 0.664 (max 0.9), willow 2.62 (max 4), alder 3.37 (max 4.5).

## Numbers
| | game | published | holds |
| --- | --- | --- | --- |
| Juniper mean mesh top | 1.088 m at the 0.5 m mean | var. *depressa* is prostrate or low, occasionally a shrub to 3 m (FNA vol. 2, Adams; http://www.efloras.org/florataxon.aspx?flora_id=1&taxon_id=233500725). FEIS: var. *depressa* rarely over 1 m (https://www.fs.usda.gov/database/feis/plants/shrub/juncom/all.html) | no |
| Juniper row | mean 0.5, max 0.9 (`src/core/flora/plants.ts`) | the low habit above; the occasional 3 m tree form is not this mesh | the row holds; the mesh does not |
| Fireweed mean mesh | 1.117 / 1.1 = 1.015 | FNA *Chamaenerion angustifolium* stems 0.2–2 m (http://www.efloras.org/florataxon.aspx?flora_id=1&taxon_id=200015078) | yes |

The row stays. Raising max to 3 m would make every mat the occasional tall form. The generator is what overshoots.

## Technique
Reuse the herb vertical stem in the same `buildPlant` (`stemLen = H`). Keep the juniper on that length, or an equivalent clamp inside the existing shrub branch, so variant 0 detail 0 has `boundingBox.max.y / height.mean` inside 0.95–1.05. The generator is the existing port of mateusdcc/plant-generator (MIT). Do not add a second generator. Horizontal spread of a mat is out of scope; the gate is the vertical top.

## Calibration
Metric: `buildPlant(spec, 0, 0).boundingBox.max.y / height.mean`, and drawn top `max.y * (h / mean)` for a placed stem.

- Known match: fireweed, ratio 1.015.
- Known mismatch: juniper, ratio 2.176, and the four drawn tops above. Frame `tasks/evidence/2026-10-23-grok-loop-0416/juniper-close.png` looks at 145.16, 208.49 after the page settled (lower-half mean 107, 108, 101). It has no scale, so the height is the box, not the pixels. `borealFlora.info` on that page listed juniper 5, the tile count.

Gate: juniper ratio between 0.95 and 1.05, and each of the four drawn tops at or under 0.9 m. Fireweed stays inside 0.95–1.05.

## Objectives
- [ ] `buildPlant` for juniper, variant 0, detail 0: `boundingBox.max.y / height.mean` is between 0.95 and 1.05. Fireweed on the same call stays inside that band. Species whose mean-mesh top is already at or under `height.max` stay there.
- [ ] Seed 1400, the four junipers listed above: drawn top `max.y * (h / mean)` is at or under 0.9 m. The handoff records a frame at one of them. Height is scored from the bounding box.
- [ ] `npm test` and `npx tsc --noEmit` pass. The juniper row stays mean 0.5 m and max 0.9 m.

## Acceptance
The mean juniper mesh matches its row the way fireweed already matches, within 5 %. The four placed stems draw at or under 0.9 m. The herb stem length in `buildPlant` is the method.
