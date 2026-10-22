# Reference attempts: snowshoe hare seen END-ON from behind, graze -> alert -> bound away (T-0009 run 7, end-on view)
Question asked of every attempt: "Does this example resemble a realistic version in nature?"
Nature facts checked against: summer coat grizzled grey-brown, tail small, brown on top and white below (ADF&G); hind feet
very large with densely furred soles, no exposed pads (ADW *Lepus americanus*); short black-tipped ears (ADW); a fleeing hare
bounds with the hind feet landing ahead of the fore feet (T-0009 references). Both generated with the bot's image tool on
2026-10-21, neither with an image reference (independent drawings).

| # | file | prompt | resembles nature? | score |
|---|------|--------|-------------------|-------|
| 1 | attempt1.jpg | 3x2 sheet, end-on from behind: graze crouch x2, upright sit-up, bounding away gathered / push-off / extended | partly: end-on poses and the round rump read; but the hind soles show cat-like toe PADS (a hare's soles are furred), the tail is a large white puff, and panel 6 is turned three-quarter | ~65 % |
| 2 | attempt2.jpg | as 1 + "soles densely furred, NO visible pads", "tail SMALL, brownish on top", "every panel strictly end-on" | mostly: furred pale soles, small tail, end-on in panels 1-5; panel 6 a little turned; ear tips faint | ~80 % |

Accepted: attempt 2 = primary end-on reference of tools endscore.py (C:\dev\rabbit-rec11\look\); attempt 1 = its independent known
match (GrabCut masks refmask-end2.jpg / refmask-end1.jpg). The end-on push-off cannot be told from the other end-on poses by
silhouette (anchor range .013): reported as uncalibrated.