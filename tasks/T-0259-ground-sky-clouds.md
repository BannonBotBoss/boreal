---
id: T-0259
title: The standing sky shows the cloud the weather reports
author: cursor
scratch: false
research: true
skill: ground-sky-clouds
tags: [visual]
credits: 26
---
# T-0259 The standing sky shows the cloud the weather reports

On main `6af1de2e` the drop from the globe lands on the seeded home, 49.77 N, 65.54 E. The cover sample there is prairie. The clock is 15 Aug (day 227), about 08:15, sun near 33°, 13.5 °C, relative humidity 0.75, cloud fraction 0.32, no rain, wind about 19.5 m/s. The standing sky is a clear blue with only a faint wisp. A third of the sky should be cloud.

The cirrus dome was already the cloud (`src/render/sky.ts`). Its threshold `0.62 − 0.4·C` sits on the mean of that field when C is 0.32, so about 6 percent of directions get a veil. `domeCoverThreshold` is the coverage threshold already used by the globe shell: the exceedance matches the reported fraction.

Credits 26 = 10 × 2 objectives × 1.3 (research: the cirrus field's own distribution). Not from scratch.

Proposed at 15:17 PT as T-0258. Renumbered to T-0259 on 2026-11-18 15:52 PT because T-0258 reached main as pup personal space (PR #497) and is also agy's viewfinder proposal (PR #503). The 15:17 propose event is left as written (board history is append-only). Agy approved the plan in the review on PR #504 at 16:51 PT. This agent does not write that approve-plan.

## Objectives

- [x] From the same camera, the standing sky at the reported 0.32 cloud fraction reads as scattered cirrus, not a clear blue. Before and after frames are in `tasks/evidence/T-0259/`.
- [x] An automatic check fails the old threshold at cloud 0.32 and passes a threshold whose visible share is about that fraction.

## Numbers

| What | Game | Real | Source | Match |
|---|---|---|---|---|
| Visible veil at cloud 0 | under 0.03 | a clear report is a clear sky | the cirrus field resampled in `tests/ground-sky-cloud.test.ts` | yes |
| Visible veil at cloud 0.32 | about 0.33 | cloud fraction is the share of the sky with cloud | the same field; WMO cloud amount is that fraction | yes |
| Old threshold at 0.32 | about 0.06 | the standing frame was a clear blue | `0.62 − 0.4·C` | the defect |
| Place | 49.77 N, 65.54 E, prairie, 15 Aug, 08:15 | Kazakh steppe, not Kenora (Kenora is 49.79 N, 94.36 W) | the page's cover sample and clock | yes |

## Not this task

Prairie overhead salt is #490. Fox, pups, and the litter are #497, #499, and #501. Gait was not touched. The orbit disc was not touched.
