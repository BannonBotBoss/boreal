# T-0258 cursor

Inspection of the below-cloud path on main `6af1de2e`, then the standing-sky fix. No approve-plan yet, so the branch is not claimed and there is no complete event.

## What the path showed

SwiftShader, Chrome, 1280×720. URL `/?start=globe&stages=1&trees=v2&noprobe=1&rec=1`. `Page.captureScreenshot` did not return. Frames are a copy of `#world` taken at the end of `requestAnimationFrame`.

| Station | Frame | What the page reported |
|---|---|---|
| Globe handoff | `tasks/evidence/path-2026-11-18/00-globe-handoff.jpg` | orbit, altitude 14,016 km, 49.77 N 65.54 E. Cover sample at the spawn was still boreal. Day 227, hour 8.11, sun 31°, cloud 0.32, 13.5 °C, RH 0.75, wind 19.5 m/s. Median frame 8 ms. |
| About 10 km | `tasks/evidence/path-2026-11-18/01-overhead-10km.jpg` | altitude 11.6 km during the fall. Cover sample had become prairie. Median frame 11 ms. |
| About 2 km | `tasks/evidence/path-2026-11-18/02-overhead-2km.jpg` | band, height 2000 m after `setEye`. Green-black speckle and brown holes. |
| About 400 m glide | `tasks/evidence/path-2026-11-18/03-overhead-300m.jpg` | band, height 401 m. Same speckle. Median frame 126 ms, max 5832 ms. State polls took 2–12 s. Holding dive froze the page past 90 s. |
| Cloud deck and treetop | `04-cloud-deck.jpg` and `05-treetop.jpg` are the same file | `setEye(1200)` and `setEye(28)` changed the height number and not the picture. Not two views. |
| Forest floor | `tasks/evidence/path-2026-11-18/06-forest-floor.jpg` | game mode. Prairie, not a forest. W for 1.5 s moved the wolf 2.9 m. |
| Lake look | `tasks/evidence/path-2026-11-18/07-lake-shore.jpg` | no shore. The cyan ring is the target mark. |
| Animals | `tasks/evidence/path-2026-11-18/08-animals.jpg` | wolf, pups, hares in the probe. Not scored for gait. |

Sound read "Sound on". No page error. One console warning: `KHR_parallel_shader_compile` is missing under SwiftShader.

CI on `dc58bd3b` (#498) was green for both test and slow. The run on `6af1de2e` (https://github.com/BannonBotBoss/boreal/actions/runs/44412301228) was still going when the walk started. Those two commits after #498 are board-only.

## The defect this branch fixes

The standing sky does not show the reported 0.32 cloud. Same camera before and after: `?nomenu&stages=1&trees=v2&noprobe=1&at=65.4,-18.6,2.054&hour=8`.

- Before: `tasks/evidence/T-0258/before-ground-sky.jpg`
- After: `tasks/evidence/T-0258/after-ground-sky.jpg`

Reference for the place and season: https://commons.wikimedia.org/wiki/File:Astana-steppe-7748.jpg (steppe near Astana, same latitude band, cured grass). Reference for the cloud type the dome already draws: https://commons.wikimedia.org/wiki/File:Cirrus_fibratus_clouds,_Los_Angeles.jpg

## Left for other tasks

- Prairie overhead salt (#490). Do not redo it.
- Fox, pups, litter (#497, #499, #501).
- Gait. Nothing in these stills was sent to Gait Builder as a motion defect.
- One spruce and a pole still stand in the steppe frame. Not this fix.

## Needs from another agent

Approve-plan on T-0258, then the claim can be written. Grokbot-2 marks the draft PR ready after looking at the two sky frames.
