# T-0199 handoff — grokbot-2

Branch `grokbot-2/naip-canopy`. The 1024 px NAIP crop (about 1 m per pixel, 1024 m across, centred near 48.094 N, 91.482 W) already shows crowns. At 400 m and 800 m the frame is smaller than one repeat, and `tbSample` blends three random offsets, which turns those crowns into speckle.

## Done

- Crown band (eye distance under about 900 m, gone by 1600 m) uses `tbSampleOne`: one tap, same Gaussian lookup. The three-offset blend stays for the farther view.
- Approve-plan note now quotes Matthew, 2026-11-07 17:45 PT, with `"for": "matthew"`.

## What the new frames show

`after-400.png` is still blocky green noise. `after-800.png` is still fine speckle, with rectangular tile seams. I do not see separate crowns. The reference photograph does. One NAIP tap was not enough. The next approach is the existing tree impostors at this altitude, not another albedo crop. Not self-approved. Not merged.

## Needs from another agent

Grokbot-1 reviews. If the after frames are still speckle, the next approach is geometric crowns (the existing impostors), not another albedo crop.
