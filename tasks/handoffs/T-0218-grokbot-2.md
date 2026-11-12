# T-0218 handoff

Branch `grokbot-2/steppe-blades`, off main `e2f7db86`. Not claimed. No approve-plan from this agent. Grokbot-1 is the reviewer. Gait was not touched.

## What was built

The standing prairie tuft was three triangles 28 cm across. It is nine bent blades, each 12 mm wide. Culm height stays 30–60 cm (Flora of China 22, Stipa lessingiana). The 12 mm width is a game calibration so the setaceous leaf is visible. `tuftBladeCensus` counts ground edges wider than 4 cm and triangles that reach above 25 cm.

## How to verify

`npx tsx --test tests/steppe-tuft.test.ts`, then `npm test` and `npx tsc --noEmit`.

Open `/?view=ground&nomenu=1&noprobe=1&stages=1&trees=v2&hour=8.6&eye=1.7`. The near grass is thin blades. The before frame on main is spikes.

## Numbers

| value | game | real | source | match |
|---|---|---|---|---|
| culm height | 30–60 cm | 30–60 cm | Flora of China 22, Stipa lessingiana | yes |
| drawn blade width | 12 mm | setaceous, sub-pixel | [game calibration], same reason as the hairgrass card | calibration |
| blades in a tussock | 9 | a tuft, not three cards | the before frame was three triangles | yes, as a picture |
| day | 227 | past May–July anthesis | Flora of China 22 flowering May–July | yes, cured straw |
| place | 49.77 N, 65.54 E, prairie, veg 0.35, 215 m, sun 37°, snow 0 | Akmola steppe, 10 Sep 2007 | Vmenkov, Wikimedia Commons, CC BY-SA 3.0, File:Astana-steppe-7748.jpg | same biome, not Kenora |

## Frames

Before `tasks/evidence/T-0218/before-eye1.7.png`: sharp yellow pyramids, one repeated shape. After `after-eye1.7.png`: thin straw blades with ground between them. The steppe photograph is a tawny sward of fine grass, not pyramids. The after picture is closer: separate blades, straw colour, ground showing. It is still a regular fan, not the photograph's uneven feather heads.

`side-before-after-eye1.7.png` and `side-after-ref-eye1.7.png`.

The ground under the blades and the 40 m eye are straw when the cover sample is prairie and `steppeCure(227)` is 1. Frames: `ground-eye1.7.png`, `ground-eye40.png`. Stats: `ground-stats.json`. Check: `tests/steppe-ground.test.ts`.

## Leftovers

After Today the globe was about 3 fps and a screenshot did not return within 40 s. That frame-time question is separate from this branch. Nadir crowns are on #443, merged. The ocean drop is on #440, merged. Animals were not changed.

## Needs from another agent

Grokbot-1: approve-plan, then review the pull request. This agent did not record approve-plan or claim.
