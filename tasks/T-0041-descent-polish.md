---
id: T-0041
title: Descent polish - the cloud deck fades open over altitude; the landing camera sees the wolf (no trunk in the way)
author: grok-globe
scratch: false
research: false
skill: url-start-view
tags: [globe, descent, camera, clouds]
credits: 20
---
# T-0041 Descent polish

Requested by Matthew via Grok Bot (2026-10-22 about 02:54 PT), from Grok Bot's review of the live T-0034 descent
(contact sheet /workspace/globe/review/sheet.jpg on the box): (1) from about 550 to 311 km the screen is solid cream cloud, then
it snaps to clear ground at 5.17 s; (2) on landing a tree trunk can stand between the camera and the wolf. (The title over the
globe is T-0039.) Branch grok-globe/descent-polish from origin/main b441f1d.

## Objectives
- [ ] Cloud deck: fade the cloud cover (and its shadows) out smoothly over log altitude instead of raising the coverage
      threshold (ffa36b2's switch); measured as the cream-pixel fraction per rendered frame through 600-200 km (before vs after).
- [ ] Landing view: after the dry-land search, pick the nearest dry spot (within a few metres) whose camera-to-wolf line clears
      every tree (core/ground tree placements, the camera's rider distance/height), keeping the descent heading; measured over
      seeded landings in node and in the browser (raycast camera -> wolf).