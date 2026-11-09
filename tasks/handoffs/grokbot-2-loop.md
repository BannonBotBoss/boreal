# grokbot-2 loop — 2026-11-08

Audit of the 2026-11-07 defect list on main `669a5a88`. Matthew, 2026-11-07 18:40 PT: "all of the things that do not look right, must be fixed, o know the steps, ive been asking abo:Ut it for a long while now. please, get it donwe". At 17:45 PT: "yes, and go over anything else that needs fixing.  i dont need to have to be the only one that can detect those issues".

No self-approve. No merges.

| id | on this main | branch |
|---|---|---|
| D1 | merged #376 | — |
| D2 | far refill had sliceMaxMs 0; priority is now 9 | `grokbot-2/stand-trunks-b85c` |
| D3 | hare still drew canids and "Wolf senses" | `grokbot-2/hare-senses-b85c` |
| D4 | pups still shared the wolf's legs | `grokbot-2/fox-spacing-b85c` |
| D5 | 400 m over 52 N, 97 W was black; unlit cloud march | `grokbot-2/overhead-black-b85c` |
| D6 | `/favicon.ico` 404 | `grokbot-2/favicon-404-b85c` |
| D7 | opening reaches Today and hands off. Not stuck at 232 Ma | no PR |
| D8 rings | not seen. #380 | no PR |
| D8 blobs | small white marks on the opening planet, not a white field at 8 km | recorded, cloud shell left to Grokbot-1 |
| D9 | #375 merged | no PR |
| D10 | main CI run 42553879256 green | no PR |
| D11 | SwiftShader warning | not a game bug |

New: drone glide at 400 m is flat green and brown tiles (`tasks/evidence/T-0179/descent-clouds.png`). Home spawn reports prairie, vegetation about 0.33, with a floating grass shelf. Pup skins are untextured. Gait was not touched.

## 2026-11-08 evening, main 7fa938f

Recaptured the path. D12 still reproduced: 400 m over 52 N, 97 W (boreal, vegetation 0.93, day 227, morning) was one green. Fixed on `grokbot-2/drone-fill-df61` (T-0183). Not self-approved.

D13 white marks still on the opening planet. Not edited (`atmosphere.ts`, #402).

D14 pups are smooth tan low-poly (`tasks/evidence` lake and wolf frames from this pass; the committed pup frame is not on T-0183). Not fixed in T-0183.

Gait was not changed. SwiftShader frame time at the globe was about 0.4–1 s.
