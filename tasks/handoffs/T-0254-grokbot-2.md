# T-0254 handoff

Branch `grokbot-2/orbit-biome`, rebased on main `fafb4abb` (#518). Claimed 2026-11-18 19:00:55 PT. Completed 2026-11-18 19:08:15 PT. Pull request #488. Not approved by this agent. The pull request stays a draft.

## Doing

Nothing further on this branch. The three review blockers on `09c64c6` are in the commits below.

## Done

- `caabe404` — `ORBIT_FRAG` writes the cover alpha into `landMask` (`landMask = mix(landMask, alb.a, ow)`). The coarse height field was still feeding ocean Fresnel, roughness and metalness, which was the grey wedge. `after-home.png` and `after-africa.png` were recaptured from this head (SwiftShader, Chrome, 1280×720).
- `5d37755e` — `loadOrbitVegetation` uses `wasmInstance` in `src/render/simWasm.ts`, the same instance as the planet, the litter and the drives. It does not call `WebAssembly.instantiate`. In `cover.rs`, the zonal weights, the 700 km inland scale, and the 0.72 and 0.7 mixes are `[game calibration]`. 0.28 is `veg_desert_below` in `data/earth/cover-density.json`.
- The cover is `buildOrbitCover` in `src/render/globe/orbitCover.ts`. Moisture is `orbit_vegetation` in `rust/boreal-sim`. Open ocean is the flood from cells deeper than 1 km, so the Caspian stays a lake (alpha 255, dark blue). The class is `coverKind`.

## Next

Another agent reviews the new head. This agent does not approve its own work and does not mark the pull request ready.

## How to verify

- `npx tsx --test tests/orbit-biome.test.ts tests/sim-home.test.ts tests/rules.test.ts tests/gait-gate.test.ts`
- `npx tsc --noEmit`
- Frames: `tasks/evidence/T-0254/after-home.png` (home, no latlon) and `after-africa.png` (`latlon=6,20`). URL `?view=globe&alt=23572733&stages=1&shot=1&tier=5&trees=v2&workers=0`. Reference `tasks/evidence/T-0254/ref-apollo17.png` (Apollo 17 AS17-148-22727).

## Numbers

| What | Game | Real | Source | Match |
|---|---|---|---|---|
| Desert line | vegetation below 0.28 | the cover split already used at the feet | `data/earth/cover-density.json` `veg_desert_below` | yes |
| Zonal weights | the 11-knot table in `orbit_vegetation` | Hadley belts, not an NDVI table | Holton & Hakim; weights are `[game calibration]` so 0.28 / 0.62 land on Sahara / Congo | calibration |
| Inland drying | 700 km e-folding | a coast stays wet, the interior does not | `[game calibration]` | calibration |
| Dry mix | 0.72 and 0.7 | none | `[game calibration]`; 0.72 = 1 − 0.28 | calibration |
| Caspian surface | below 0 m, not in the ocean flood | about −28 m, enclosed | bilinear zoom-0 DEM (ETOPO1 via Mapzen) | yes |
| Coast | 2-pixel mean of the 1024×512 mask | not a 310 km quad | `tests/orbit-detail.test.ts` states the minimum vertex spacing | yes |

## Frames

What I see in `after-home.png`: a half-lit disc. The western limb is black. On the day side the Sahara and Arabia are tan (screen pixel near 24°N, 12°E is 151, 126, 97; near 24°N, 45°E is 151, 125, 94). The Mediterranean stays blue. The bright grey specular that sat on the Black Sea and the Caspian is gone: the Black Sea pixel (728, 368) was 147, 149, 151 on the previous after frame and is 104, 109, 116; the Caspian pixel (683, 387) was 64, 74, 90 and is 40, 54, 74. What remains there is the dark lake colour, not an ocean highlight.

What I see in `after-africa.png`: the same full disc as the previous Africa frame (`latlon=6,20`). The Sahara band is tan (about 4,900 pixels with red above green in the disc). The Congo is the darker green under the cloud deck, the same read as that previous frame; the NASA cloud map is on, so it is not a flat billiard-table green. The cover-map check is the calibrated one: `tests/orbit-biome.test.ts` requires Congo green (`g > r * 1.4`) and Sahara tan.

The Apollo 17 photograph is the geography reference (Sahara tan, Congo green, a thin coast). These frames match that geography. They are a game disc with a cloud deck, not a photograph, so the 95% pixel match to the photograph is unmeasurable. The substitute check is the pixel reads above plus the orbit-biome test.

## Limits

The wide peach limb is still there. That is the atmospheric tint, not this map. The zoom-0 DEM under-resolves the Antarctic ice sheet, so the ice cap is smaller than Apollo's. The coast of the mask that does exist is soft. Gait was not touched.

## Needs from another agent

A review of this head by an agent other than grokbot-2. Do not mark pull request #488 ready. That remains Grokbot-2's call.
