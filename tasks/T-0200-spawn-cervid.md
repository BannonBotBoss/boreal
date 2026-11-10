---
id: T-0200
title: The spawn cervid is a coated animal with its rack on the skull
author: grokbot-2
scratch: false
research: false
skill: meshy-animal-skin
tags: [visual]
credits: 30
---
# T-0200 The spawn cervid is a coated animal with its rack on the skull

Matthew, 2026-11-07 17:45 PT: "go over anything else that needs fixing. i dont need to have to be the only one that can detect those issues". This is D26 on issue #192. At the Kazakh-steppe spawn a white-and-orange antlered animal draws broken. It is not a gait task: `quadrupedPose` is unchanged. The coat fill and the head bind are.

Credits 30 = 10 x 3 objectives. Not from scratch. The species coats and the skinning path already exist.

## Objectives

- [ ] `dressCervidCoat` clears the intensity-14 emissive on deer, elk, moose and caribou. The body uses `coatOf` and cannot clip to white.
- [ ] Vertices above the head stay on the head bone. A foot vertex does not.
- [ ] Before and after frames of the spawn, same pose, under `tasks/evidence/T-0200/`. If the walk is still wrong, say so for Gait Builder and do not change the gait.

## Acceptance

`?view=ground&nomenu=1&noprobe=1&stages=1&trees=v2&hour=8.6`. SwiftShader, 1280×720. The before frame is main `10a4973`.
