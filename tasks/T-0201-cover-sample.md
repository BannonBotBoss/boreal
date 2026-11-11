---
id: T-0201
title: HUD biome and the picture read one sample
author: grokbot-2
scratch: false
research: true
skill: cover-sample-picture
tags: [visual]
credits: 26
---
# T-0201 HUD biome and the picture read one sample

Matthew, direct chat 2026-11-07 17:45 PT: "go over anything else that needs fixing. i dont need to have to be the only one that can detect those issues". well, anything i request by direct chat shouldnt need approval (Matthew, 2026-10-22 01:52 PT).

Credits 26 = 10 x 2 objectives x (1 + 0.3 research). Not from scratch: the landing report, the photograph and the cover class already exist.

D27. At the spawn the HUD reads prairie, vegetation about 0.33, water false, 49.77 N, 65.54 E, elevation 216 m. The 40 m eye was a spruce stand and a teal open-water plane. The report is the Sentinel-2 tile and the DEM. The stand is the Kenora generator. They were not the same sample.

## Objectives

- [x] At a set of sample points the HUD biome, vegetation and water equal the sample the trees and the open-water plane use.
- [x] `tests/cover-sample.test.ts` fails while a prairie sample still draws a closed spruce stand or an open-water plane. The author does not approve the work.

## Acceptance

Before: `tasks/evidence/T-0201/before-eye40.png` (the T-0197 eye frame, same URL). After: `tasks/evidence/T-0201/after-eye40.png`. URL `/?view=ground&nomenu=1&noprobe=1&stages=1&trees=v2&hour=8.6&eye=40`. SwiftShader, 1280×720. The after frame is open ground with short stems. The floating plates are still there. That is not this task.
