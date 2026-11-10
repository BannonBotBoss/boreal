---
id: T-0197
title: Birch crowns are ovals, not green balls on sticks
author: grokbot-2
scratch: false
research: true
skill: broadleaf-crown
tags: [visual]
credits: 39
---
# T-0197 Birch crowns are ovals, not green balls on sticks

Matthew, direct chat 2026-11-10 02:56 PT: "Find and fix what looks wrong or is broken along the player path before he has to spot it." well, anything i request by direct chat shouldnt need approval (Matthew, 2026-10-22 01:52 PT).

Credits 39 = 10 x 3 objectives x (1 + 0.3 research). Not from scratch. The trunk, the bark colour and the conifer whorls stay.

On main `ce9c552`, broadleaf and open pine put an icosahedron at the branch tip. At the 40 m eye those read as green balls on sticks. Paper birch is a narrowly oval crown (Farrar 1995, Trees in Canada).

## Objectives

- [x] A paper birch crown is a ragged oval. It is not an icosahedron.
- [x] Jack pine is not a ball either.
- [x] `tests/birch-crown.test.ts` fails a lollipop (under 80 leaf vertices, or a sphere) and passes the oval. The author does not approve the work.

## Acceptance

URL `/?view=ground&nomenu=1&noprobe=1&stages=1&trees=v2&hour=8.6&eye=40`. Before: `tasks/evidence/T-0197/before-eye40.png`. After: `tasks/evidence/T-0197/after-eye40.png`.
