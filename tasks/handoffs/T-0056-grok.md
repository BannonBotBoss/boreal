# T-0056 handoff (grok)

## Status
Claimed. Not submitted. Branch `grok/globe-low-alt-sheet` off main `57a3d48`. The approve-plan for matthew is on `grok/board-loop` (`tasks/events/2026-10-23T10-26-grok-approve-plan-T-0056.json`, 10:26:10 PT). The claim is `tasks/events/2026-10-23T11-19-grok-claim-T-0056.json` on that same board branch (11:19:00 PT), before this code.

## What changed
`src/world/globe/globeView.ts` `after()` calls `atmos.setClear(cloudClear(alt))` for the standalone globe as well as the in-page path. The `opts.shared` guard is gone. No new cloud field, no new shell height, no new planet mesh. `?atmos=0` still builds no atmosphere, so `setClear` is not called. `cloudClear` is unchanged (`CLOUD_OPEN` 1500 km to 150 km). At 3000 m it is already 1. At the default orbit (`PLANET.radius * 2.2`, HUD 14016 km) it is 0, so the deck stays.

## How to verify
`npm test` (includes `tests/globe-low-alt-sheet.test.ts`) and `npx tsc --noEmit`.

Headless Chrome, SwiftShader, 960×540, canvas only. Script `tasks/evidence/2026-10-23-grok-t0056/capture.mjs`. URL `?start=globe&stages=1&trees=v2&view=globe&at=30,0,-0.35&alt=3000`.

Lower half is y from 55%. Beige is R>170, G>150, B>110, R+15>G, G+10>B. Luma is 0.2126 R + 0.7152 G + 0.0722 B.

| Frame | What it is | Lower-half luma std | Beige | Gate |
|---|---|---|---|---|
| `known-bad-1016-alt3000.png` | 10:25 run, issue URL, before this fix | 2.0 | 1.000 | sheet, fails |
| `before-alt3000.png` | this run, same URL, before the call | 2 | 1 | sheet, fails |
| `after-alt3000.png` | this run, after the call | 10.1 | 0 | open ground, passes |
| `before-alt3000-atmos0.png` / `known-match-1016-atmos0.png` | atmosphere off | 15.7 | 0 | open ground |
| `after-orbit.png` | no `alt`, 14016 km | 41.9 | 0.023 | disc, not a sheet |

Viewed `before-alt3000.png`: the top is blue sky; from about mid-frame down the canvas is one beige plane (about 200, 196, 188) with no terrain breaks. Viewed `after-alt3000.png`: the same sky; below it the beige plane is gone and the lower half is broken green and dark blue-green ground (row means about 103,117,110 then 33,52,73 through 58,70,70). Viewed `after-orbit.png` and `before-orbit.png`: a disc in a dark field, the same sample grid before and after. The canvas shots do not include the DOM HUD. HUD on the live page at 3000 m read ground 371 m, 49.77°, 65.54°.

One console 404 per some loads is the known Vite sourcemap miss. Not part of this task.

## Numbers
No new rate. `CLOUDS.heightKm` stays 2.5. `cloudClear(3000)` is 1 and `cloudClear(PLANET.radius * 2.2)` is 0, both the existing function.

## Leftovers
Not submitted. No complete event. T-0057, T-0058 and T-0059 are the other issue #43 layers and are not this change. In-page `CLOUD_OPEN` and the T-0043 coast are untouched.

## Needs from another agent
None for this fix. A non-author still approves when it is submitted, unless Matthew's rule 16b approve is recorded after the complete event. Do not merge while CI is red.
