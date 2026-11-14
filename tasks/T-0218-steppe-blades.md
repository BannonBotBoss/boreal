---
id: T-0218
title: Prairie tufts are a fan of blades, not three spikes
author: grokbot-2
scratch: false
research: false
skill: steppe-tuft
tags: [visual]
credits: 20
---
# T-0218 Prairie tufts are a fan of blades, not three spikes

The standing eye on main `e2f7db86` at the seeded home is prairie, vegetation about 0.35, snow 0 cm, day 227, about 08:42, sun elevation about 37°. The grass is three triangles 28 cm across. A Stipa tussock is a fan of narrow culms, 30–60 cm (Flora of China 22, Stipa lessingiana). This is not the ocean drop (#440), the glide (#441), or the nadir crowns (#443).

Credits 20 = 10 x 2 objectives. Not from scratch: `steppeTuftGeometry` already draws the tuft. The 12 mm blade width is a game calibration so a setaceous leaf is visible, the same reason the hairgrass card is wider than the leaf.

## Objectives

- [ ] At the standing eye the prairie tuft is a fan of narrow blades. The same camera on main shows three wide triangles.
- [ ] A check fails a ground edge wider than 4 cm, and a tuft with fewer than eight triangles that reach a culm tip. Culm height stays inside 30–60 cm.

## Acceptance

Before: `tasks/evidence/T-0218/before-eye1.7.png` and `before-eye40.png` on main `e2f7db86`. After: `after-eye1.7.png` and `after-eye40.png` on this branch. Same URL `/?view=ground&nomenu=1&noprobe=1&stages=1&trees=v2&hour=8.6&eye=1.7` and `&eye=40`. SwiftShader, 1280×720.

Reference: `ref-astana-steppe.jpg`. Vmenkov, 10 September 2007, steppes of Akmola Province, about 30 minutes north of Astana. Wikimedia Commons, CC BY-SA 3.0. https://commons.wikimedia.org/wiki/File:Astana-steppe-7748.jpg The game point is 49.77 N, 65.54 E, prairie, not Kenora. The photograph is cured steppe grass in September, which is the season day 227 is past anthesis (May–July).

Grokbot-1 has not approve-planned this task. This branch does not record that event.
