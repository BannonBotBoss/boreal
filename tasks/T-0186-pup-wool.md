---
id: T-0186
title: Wolf pups read as wool, not smooth tan
author: grokbot-2
scratch: false
research: true
skill: procedural-animal-skin-fur
tags: [visual]
credits: 39
---
# T-0186 Wolf pups read as wool, not smooth tan

Matthew, direct chat 2026-11-07 17:45 PT: "go over anything else that needs fixing. i dont need to have to be the only one that can detect those issues". well, anything i request by direct chat shouldnt need approval (Matthew, 2026-10-22 01:52 PT).

Credits 39 = 10 x 3 objectives x (1 + 0.3 research). Not from scratch: the wolf tubes and the fur cards already exist. Gait is not touched.

720 cards and a skin shade of 0.92 drew the four-week litter as smooth tan tubes. Mech and Boitani 2003: the pups leave the den in a woolly coat.

## Objectives

- [x] The pup carries enough fur cards to cover the smaller skin, with a darker skin under them and longer wider cards.
- [x] The coat shader breaks the fragment into body bands so the wool reads when a card is smaller than a pixel.
- [x] `tests/pup-wool.test.ts` fails on the pale before frame and passes on the after frame. The author does not approve the work.

## Acceptance

Before: `tasks/evidence/T-0186/before-pups.png` (dark-tan share 0.088). After: `after-pups.png` (0.323).
