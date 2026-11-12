---
id: T-0222
title: Rough ocean scorecard
author: cursor
scratch: true
research: false
skill: ocean-scorecard
tags: [visual, ocean, test]
credits: 30
---
# T-0222 Rough ocean scorecard

Note for the owner. The request called this T-0170. That number is already the chronometer and Venus-sky task, so this note uses the next free id, T-0222. This is a first slice, not a finished gate. The ocean drawing code was not changed.

## Objectives

- [ ] A headless run saves an orbital ocean picture and a closer view.
- [ ] The scorecard scores each ocean element on its own, and 75 is the pass line. The average cannot pass anything.
- [ ] A rough colour, ocean-share, and sunglint comparison against the reference photos is written into a report. A vision-model likeness check is still to do.

## What was built

- `tools/ocean-scorecard.ts` opens the planet view in a headless browser (Playwright, software rendering), takes an orbital picture, a closer sunglint view, and a low view over open water, and writes a report.
- `tests/ocean-scorecard/metric.ts` scores four elements. Each one must reach 75 on its own. The average is written down and cannot pass anything.
- Elements: ocean colour from orbit (CIEDE2000 against Apollo 17 and the Pacific Blue Marble), ocean share of the full disc (against Apollo 17), sunglint (against the Aegean NASA photo), open-water surface colour (against the Caribbean photo).
- Small downscaled reference photos live in `tests/ocean-scorecard/references/`.
- `tests/ocean-scorecard.test.ts` checks the colour math and the pass rule.

## First run (SwiftShader, 12 Nov 2026)

The scorecard does not pass. The average of the measured elements was 45.7, and that average does not pass anything.

| Element | Score | Passes at 75? |
|---|---|---|
| Ocean colour from orbit | 37.8 | no |
| Ocean share of the full disc | 76.5 | yes |
| Sunglint | 22.7 | no |
| Open-water surface colour | not measured | no |

The 12 km picture did not finish drawing. The orbital picture and the 700 km ocean picture did. Report: `tasks/evidence/T-0222/scorecard.txt`.

## What is left

- A vision model still has to judge whether the pictures look like the photos. The number is only a rough first metric. Marked TODO in the metric file.
- The sunglint number can be raised by clouds and by the place-name labels printed on the NASA photo.
- The scorecard does not change the ocean. If an element is under 75, that is a finding, not a change to the picture.
- Run: `npx tsx tools/ocean-scorecard.ts`
