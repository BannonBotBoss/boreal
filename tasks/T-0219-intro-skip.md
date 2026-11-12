---
id: T-0219
title: The first-visit film can be skipped
author: grokbot-2
scratch: false
research: false
skill: cine-boot-ready
tags: [visual]
credits: 20
---
# T-0219 The first-visit film can be skipped

Matthew, direct chat 2026-11-11 16:20 PT, asked for the first-visit opening film to be skippable. A click, Escape and space did nothing on the audit frame. well, anything i request by direct chat shouldnt need approval (Matthew, 2026-10-22 01:52 PT).

Credits 20 = 10 x 2 objectives. Not from scratch: `cinematic:dismiss`, `markBigBangSeen` and `finishIntro` are the T-0166/T-0167 exit.

## Objectives

- [x] After the film has started, Escape, space, or a click leaves through the existing dismiss path and the planet entry the ending already uses.
- [x] A headless test presses Escape at about 5 s and the globe entry runs within 2 s. Before and after frames are in the evidence folder.

## Numbers

| What | Game | Real | Source | Match |
|---|---|---|---|---|
| Escape at film clock | 5.0–5.6 s in the test, 5.93 s in the frame | A title card is skipped as soon as the viewer asks | The audit waited 6.2–9.2 s with no exit | yes |
| Globe after Escape | 0 s of film time in the test; 7 ms to `mode === 'globe'` in Chrome | The next view, not another minute of film | `finishIntro` → `inpage.enter` | yes |

## Frames

- Before: `tasks/evidence/T-0219/before-5s.png`. Black, one pinpoint, the line "It was called…". The film is still up at 5.9 s.
- After, skip: `tasks/evidence/T-0219/after-escape.png`. Today's Earth, same orbit as the ending.
- Natural finish: `tasks/evidence/T-0219/natural-finish.png`.
- Side by side: `tasks/evidence/T-0219/side-escape-finish.png`. Whole-frame mean RGB within 2.4%.
