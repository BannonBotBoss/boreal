# T-0199 frames

Overhead URL: `/?view=globe&latlon=52,-97&shot&localClouds=0&hour=8.3&day=227&tier=5&seed=1400&alt=` plus 400 or 800. SwiftShader, 1280×720. Before frames are `tasks/evidence/path-2026-11-09/globe-400.png` and `globe-800.png` (main, the 128 px crop). The splash stays on "Starting…" while the globe is already drawing, so these after frames were taken after a `SEAMS` log and with that card removed.

| file | what I see |
|---|---|
| `ref-naip-canopy.png` | The photograph. Closed boreal canopy near 48.094 N, 91.482 W. Individual crowns, darker gaps, a small pond at the lower right. About 1 m per pixel, 1024 px, 1024 m across. USGS Imagery Only (NAIP), public domain. |
| `before-400.png` | The old overhead. Green static. A crown in the 128 px crop is one or two texels, and the frame is that texture magnified. Correlation of luminance 8 m away is 0.17. |
| `after-400.png` | Same URL. Still a mottled green canopy, not a map of round crowns like the photograph. The center is clumps of lighter and darker green rather than the old even static. Correlation 8 m away is 0.35. I do not see separate tree crowns the way `ref-naip-canopy.png` shows them. |
| `before-800.png` | The old 800 m frame. The same static, a little finer on screen. Correlation at 8 m is 0.39. |
| `after-800.png` | Same URL. Still a fine green speckle. Correlation at 8 m is 0.43. I do not see individual crowns. |

The photograph has the crowns. The 400 m frame is less like static than the before frame. The 800 m frame is not.
