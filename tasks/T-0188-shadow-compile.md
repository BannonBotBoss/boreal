---
id: T-0188
title: MeshStandardMaterial no longer compiles an undeclared shadow
author: grokbot-2
scratch: false
research: true
skill: shadow-chunk
tags: [visual]
credits: 26
---
# T-0188 MeshStandardMaterial no longer compiles an undeclared shadow

Matthew, direct chat 2026-11-07 17:45 PT: "go over anything else that needs fixing. i dont need to have to be the only one that can detect those issues". well, anything i request by direct chat shouldnt need approval (Matthew, 2026-10-22 01:52 PT).

Credits 26 = 10 x 2 objectives x (1 + 0.3 research). Not from scratch: three's own getShadow already softens the shadow.

High and Ultra set a `PCSS` define. The shared shadow chunk was spliced at the first `#if defined( SHADOWMAP_TYPE_PCF )`, which in three 0.185 is the sampler uniform, so the fragment compiled `shadow = pcssShadow(...)` where `shadow` is not declared.

## Objectives

- [x] That splice is gone. Soft shadows stay on three's Vogel-disk `getShadow`.
- [x] `tests/shadow-compile.test.ts` shows the old splice assigns `shadow` before `float shadow` is declared, and that `photoreal.ts` no longer does it. The author does not approve the work.

## Acceptance

No picture. The failure is a program that does not link. The evidence is the chunk order in `tests/shadow-compile.test.ts` and the removed splice in `src/render/photoreal.ts`.
