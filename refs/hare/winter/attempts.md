# Reference attempts: snowshoe hare in WINTER coat, graze -> alert -> bound (T-0028 winter gate)
Question asked of every attempt: "Does this example resemble a realistic version in nature?"
Nature facts checked against: winter coat almost entirely white except black eyelids and blackened ear tips; greyish
underfur, hairs dusky at the base (ADW *Lepus americanus*; ADF&G); ears 62-70 mm, short for a hare (ADW); very large
densely furred hind feet, four long toes spread in soft snow (ADW; Hinterland Who's Who); bounds with the hind feet landing
ahead of the forefeet (T-0009 references).

| # | file | prompt | resembles nature? | score |
|---|------|--------|-------------------|-------|
| 1 | attempt1.jpg | 3x2 sheet, same hare, winter white, black ear tips only, short ears, big furred white hind feet; graze crouch, head up, alert half sit-up, push-off, gathered mid-bound, extended suspension; overcast boreal snow, side-on ~6 m | mostly: white coat with black-edged ear tips, short ears, round body, grazing crouch and sit-up right; the bound panels read as hops (no clear gathered / extended phases) and the hind-foot soles look tan | ~85 % |
| 2 | attempt2.jpg | as 1, attempt 1 as image reference; strictly side-on, one hare, poses graze crouch (x2), upright sit-up, gathered, push-off, extended suspension (prompt summarised) | mostly: all white with black ear tips and dark eye rims, round body, big furred hind feet, upright sit-up and clear gathered / extended bound phases; the graze cell 1 faces left (mirrored in the metric); ears a bit long; fur looks too smooth / plush | ~85 % |
| 3 | attempt3.jpg | as 2, attempt 2 as the image reference, push-off panel spelled out (hind legs extended back pushing off, body rising, fore legs reaching) | yes, but it is nearly a copy of attempt 2 (same poses and framing), so it is NOT independent and is not used as a known-match anchor | ~85 % (rejected as an anchor) |
| 4 | attempt4.jpg | 3x2 sheet with NO image reference; dark spruce forest edge behind so the white outline is crisp; panel 5 a push-off with both hind feet still on the snow, body angled up ~20 deg, fore legs reaching | mostly: white coat, dark eyelids, rounded body, big furred hind feet, upright sit-up, gathered (hind feet forward), clear push-off and full suspension; the black ear tips are faint | ~85 % |
| 5 | attempt5-pushoff.jpg | single side-on push-off photo, no image reference, dark forest edge | mostly: both hind feet on the snow, legs straightening back, fore legs reaching, black ear tips, dark eyelids; body angle ~35 deg (steeper than asked) and the body a little long | ~85 % |

Accepted: attempt 1 for the winter COAT (colour, ear tips, ear length, body shape, foot size); motion stays gated against
refs/hare/graze-alert-flight/ (attempt 2 poses, attempt 4 timing). Generated with the bot's image tool on 2026-10-21.
Update 2026-10-21 18:25 PT (grok, T-0028 17:33 brief): attempt 2 is the PRIMARY side-on winter reference for the calibrated
look metric (C:\dev\hare-mesh-rec4\look\lookscore.py); attempt 1 is its independent "known match" drawing (hand-traced outlines).
Update 2026-10-21 18:50 PT (grok, T-0009 run 7): attempt 4 = the winter KNOWN MATCH of lookscore v1.2 (independent of attempt 2, GrabCut masks C:\dev\rabbit-rec11\look\refmask-winter4.jpg); for the push-off the primary is attempt 4 panel 5 and attempt 5 its known match (IoU .651 vs the .504 other-pose mismatch).
