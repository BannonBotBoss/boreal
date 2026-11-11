---
id: T-0211
title: An ice landing is not a clipped white sheet
author: grokbot-2
scratch: false
research: true
skill: ice-sheet
tags: [visual]
credits: 26
---
# T-0211 An ice landing is not a clipped white sheet

Matthew, direct chat 2026-11-07 17:45 PT: "go over anything else that needs fixing. i dont need to have to be the only one that can detect those issues". well, anything i request by direct chat shouldnt need approval (Matthew, 2026-10-22 01:52 PT).

Credits 26 = 10 x 2 objectives x (1 + 0.3 research). Not from scratch: the snow albedo is already in `render/pbr.ts`. Plan approval is not recorded here. This is the worst open picture that is not #422, #428, #429, or #434.

The drop on 2026-11-10 landed at 8.49 N, 129.33 W, elevation 5074 m, biome ice, water false, vegetation 0.92, day 227, sun about 49°, snow 0 cm. The ground pixels are about 243–248 with no shade. The glide before it was a pale blank, then a black field. Fresh snow is 0.80–0.95 (Oke 1987). Sea ice is about 0.5–0.7 (Perovich 1996, already cited in `planetLayers.ts`). A flat 0.8 under the ground exposure clips, so a slope cannot show.

## Objectives

- [ ] That landing shows shaded ice, not one clipped white value, and the glide shows the ground before the feet do.
- [ ] A check of the rendered frame fails the current white sheet and passes the shaded one.

## Acceptance

Before: `tasks/evidence/path-2026-11-10-pm/10-floor.png`. After: a frame of the same drop. Reference: `tasks/evidence/path-2026-11-10-pm/ref-greenland-ice.jpg`.
