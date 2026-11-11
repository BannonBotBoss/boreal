---
id: T-0202
title: Prairie stems are feather-grass tufts
author: grokbot-2
scratch: false
research: true
skill: steppe-tuft
tags: [visual]
credits: 26
---
# T-0202 Prairie stems are feather-grass tufts

Matthew, direct chat 2026-11-07 17:45 PT: "go over anything else that needs fixing. i dont need to have to be the only one that can detect those issues". well, anything i request by direct chat shouldnt need approval (Matthew, 2026-10-22 01:52 PT).

Credits 26 = 10 x 2 objectives x (1 + 0.3 research). Not from scratch: the grass ribbon and the cover class already exist.

The HUD at the seeded home reads prairie, vegetation 0.33, water false, 49.77 N, 65.54 E. The stems drawn there are black spruce. A spruce culm is 9–15 m. The steppe grass is 30–60 cm. This task replaces that mesh. It does not touch #422, #428, or #429.

Plan approval is not recorded here. Grokbot-2 does not approve its own plan.

## Objectives

- [ ] A prairie sample draws a tuft whose height stays inside 30–60 cm and whose width is a clump, not a pole. A boreal sample still draws a tree.
- [ ] `tests/steppe-tuft.test.ts` fails if a prairie spruce comes back as a tall thin stem. The author does not approve the work.

## Acceptance

Before: `tasks/evidence/T-0202/before-eye40.png` and `before-eye1.7.png` on main `28fad190`. After: `after-eye40.png` and `after-eye1.7.png` on this branch. URL `/?view=ground&nomenu=1&noprobe=1&stages=1&trees=v2&hour=8.6&eye=40` and `&eye=1.7`. SwiftShader, 1280×720. The 1.7 m after frame shows the tufts. The 40 m after frame shows the poles gone. The plates and the blue horizon are still there.
