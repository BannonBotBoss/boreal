# T-0075 handoff (grokbot-3)

Branch: `grokbot-3/wolf-view` off main `3ed7265`. Code `4ae9f46`. Do not merge. Do not push main. Do not approve this work (the author is grokbot-3).

## Doing
Refine the existing follow camera and the existing tube wolf toward Matthew's issue #52 reference (rear three-quarter, gray wolf in the lower half of a forest frame). The three extra angles he posted at 19:22 PT are saved under `refs/wolf/view/reference/` and are not the default camera.

Matthew, issue #52, 2026-10-23 19:14:55 PT: "please use this and refine the view of the wolf, as well as the wolf itself".

## Built
Adopted `positionCamera` (`src/render/math.ts`), `wolfTubes` / `sculptWolf` (`src/core/wolfBody.ts`), `createPlayerWolf` (`src/render/playerWolf.ts`) and `buildFurCards`. No second camera, no mesh file, no new dependency.

- Follow camera: eye 1.05 m, 3.6 m behind, 2.25 m to the animal's left (32° off the tail), pitch −5°. `playables.ts` wolf `cameraHeight` reads `riderHeight`. `LANDING_VIEW` uses the same flank so the landing line is the camera line.
- Coat: timber-grey stops darker gray, cream belly, charcoal points, tan accent. Shoulder and neck guard-hair multiplier 1.75 (10.5 cm). Tail plume multipliers 1.9 / 2.05 / 1.9. Game fur cards 18000, with a pale tip on the upper body.
- Score tool `tools/wolf-view-score.ts`. Headless stills `refs/wolf/view/capture.mjs`.

## How to verify
```
npx tsc --noEmit
npm test
npx tsx tools/wolf-view-score.ts --score refs/wolf/view/reference/issue-main.png refs/wolf/view/before/still.png refs/wolf/view/after/still.png
npx vite --host 127.0.0.1 --port 5270 --strictPort
node refs/wolf/view/capture.mjs 5270 refs/wolf/view/after
```
Before frame is parent `3ed7265` on port 5271, same URL `/?nomenu&bench&hour=11`, viewport 1024×559.

## Number table
| quantity | game | real | source | match |
| --- | --- | --- | --- | --- |
| withers | 80–86 cm (existing shoulder test) | 80–85 cm | Mech 1970, *The Wolf*; Wikipedia "Wolf" restates it | yes |
| eye height | 1.05 m | withers 85 cm + 20 cm | same, plus the 20 cm so the lens clears the back | yes |
| back guard hair | 6.0–7.2 cm (`FUR_LENGTH` 0.03 × fur 1.0–1.2 × 200) | 6–7 cm on the back | Wikipedia "Wolf" | yes, the 7.2 cm ring is the pre-existing z=−0.07 ring the test still allows |
| shoulder / neck guard hair | 10.5 cm (fur 1.75) | 9–13 cm | Wikipedia "Wolf" | yes |
| tail plume | ~12.3 cm (fur 2.05) | shoulder range used for the tail | [verify: no separate tail-hair table] | unverified |
| bearing | 32.0° off the tail | rear three-quarter 25–45° | measured on issue #52 (asset 026b54d0); the band is the gate, not a published angle | yes |
| body point on screen | NDC (0, −0.466) | NDC y −0.48 from warm-pixel centroid image (0.52, 0.74); x set to 0 because 0.52 is 0.02 off centre | `tools/wolf-view-score.ts` on `issue-main.png` | yes (wolf-frame v1 0.987) |
| timber-grey stops | back [.30, .31, .32], belly [.74, .72, .66], dark [.07, .07, .08], accent [.46, .38, .28] | grey is the majority North American morph | Gipson, Bangs et al. 2002, Wildlife Society Bulletin 30(3):821. Linear RGB [verify: no spectrophotometer table] | colour name yes, triples unverified |
| grizzle tip | linear [.72, .70, .66], amount 0.45, above model y 0.30 | banded guard hairs | Young and Goldman 1944, *The Wolves of North America* [verify page] | unverified |
| mass | 73.4 kg | adult gray wolves are often cited 23–80 kg | `rigMass(createPlayerWolf(1400), 'canid')` = volume × canid density. The range is Mech & Boitani 2003 [verify page]. The mass was not assigned to hit it | derivation yes; the comparison is inside the cited range |
| distance / flank | 3.6 m / 2.25 m | — | game calibration of the 32° bearing and the body size in a 48° frame (about a quarter of the vertical frame: 0.82 m at 4.24 m is ~11°) | calibration |

## Frames
URL `/?nomenu&bench&hour=11`, 1024×559, hour 11, dry start, swiftshader Chrome.

**Reference** `refs/wolf/view/reference/issue-main.png` (1024×559). A cool gray forest. Warm pixels (r > g+18 and r > b+25) are rare (223) and their centroid is image (0.515, 0.725). The bright column sits in the centre; the lower-centre box (x 0.30–0.75, y 0.45–0.95) averages sRGB 170, 174, 181.

**Before** `refs/wolf/view/before/still.png`, parent `3ed7265`. Same stand. The camera is higher and dead astern, looking down onto the wolf's back, so the path fills the foreground and the animal sits nearer the middle. Box mean sRGB of that still is not the reference: box-histogram v1 **0.111**.

**After** `refs/wolf/view/after/still.png`, this branch. Daylight conifers, a pale path, and a dark gray wolf in the lower centre, seen from behind and to its left, small against the trees. HUD text sits on the top and bottom edges. Box mean sRGB 209, 213, 210 (the box is mostly trees and sky, not the wolf). box-histogram v1 **0.149**.

## Scores
| metric | known match | known mismatch | before | after | 0.95 |
| --- | --- | --- | --- | --- | --- |
| wolf-frame v1 (NDC + bearing) | 1 | legacy camera 0.559 | the legacy camera | **0.987** | yes, this metric only |
| box-histogram v1 (box x 0.30–0.75, y 0.45–0.95) | reference vs itself = 1 | flat colour < 0.2 | 0.111 | **0.149** | **no** |

The pixel gate is box-histogram v1. It is not met. wolf-frame v1 passing does not stand in for it. The box was locked from the reference luminance before the game frames were scored.

## Tests
`npx tsc --noEmit` exit 0. `npm test`: 644 tests, 630 pass, 0 fail, 14 todo. The board todo stays the pre-existing legacy breaks. Fur-card digest re-pinned `181874e9c7eb7b23` → `a75ee513cc7c2766` because the coat stops and guard-hair multipliers change the cards on purpose. World-chunk digest unchanged.

## Leftovers
- Pixel resemblance to issue #52 is 0.149, not 0.95. The locked box is mostly a different forest. A reviewer should not read the framing score as the frame gate.
- Deer, bear and hare keep their own `cameraHeight`, so their follow distance grows with the new distance/height ratio.
- `src/animals/locomotion/fork/playerRig.ts` still uses 13000 fur cards. The game wolf only was changed.
- Coat RGB, the grizzle page, and the tail-hair length are marked [verify].
- Not approved. Not merged.

## Needs from another agent
None. A non-author review is still required before this is done.
