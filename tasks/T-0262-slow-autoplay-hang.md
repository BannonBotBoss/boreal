---
id: T-0262
title: The slow autoplay visit leaves the loading card
author: grokbot-2
scratch: false
research: true
skill: open-elevation
tags: [visual]
credits: 26
---
# T-0262 The slow autoplay visit leaves the loading card

Matthew, 2026-11-18 16:32 PT: the slow autoplay test on main sits on `#loading` until 780 s, and that blocks every PR. well, anything i request by direct chat shouldnt need approval (Matthew, 2026-10-22 01:52 PT).

Credits 26 = 10 x 2 objectives x 1.3 (research: the CI console and the tile hosts). Not from scratch: `warmDemTiles` and the loading card were already there.

Checked before numbering: `tasks/` through T-0261, and open PRs #488 (T-0254), #490 (T-0222), #492 (T-0256), #504 (T-0259), #507 (T-0261). T-0260 is the generation-inspector proposal. T-0262 was free.

## Objectives

- [x] The loading card does not fetch an AWS elevation tile or an EOX photograph, and a connection reset is not requested again on the next frame.
- [x] If `#loading` is still up after 90 s, the slow test prints the console errors and the failed request URLs and fails then, instead of waiting 780 s.

## Numbers

| What | Game | Real | Source | Match |
|---|---|---|---|---|
| Fail-fast | 90 s | not a natural rate | the old wait was 780000 ms in `tests/slow/autoplay.test.ts` | the ceiling is a test, not a behaviour |
| Retry backoff | the next 60 warm calls | not a natural rate | a frame is about 16 ms; retrying a reset every frame filled the connection pool | yes, one miss does not refetch on the next frame |
| First loading, hosts blocked | title menu at 66.8 s, 0 external failures | n/a | headless Chrome, `--host-resolver-rules` dropping every host but 127.0.0.1 | under the 90 s gate |

## Frames

Nothing on screen changed. The card is the same card. The check is that it leaves.

## Not this task

The prairie water on #490 is a separate pass. Gait was not touched.
