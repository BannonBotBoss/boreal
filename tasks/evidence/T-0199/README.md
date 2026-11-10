# T-0199 frames

Overhead URL: `?view=globe&latlon=52,-97&shot&localClouds=0&hour=8.3&day=227&tier=5&seed=1400&alt=` 400 and 800. SwiftShader, 1280×720.

The reference photograph is `ref-naip-canopy.png`. USGS Imagery Only (NAIP), public domain, about 1 m per pixel, 1024 m across, centred near 48.094 N, 91.482 W. It shows separate crowns, darker gaps, and a pond.

- `speckle-400.png` and `speckle-800.png` — the previous after frames. 400 m is mottled static. 800 m is fine speckle, with hard rectangular tile edges.
- `after-400.png` — one lookup tap instead of three blended offsets. Still blocky green noise. I do not see separate round crowns or gaps.
- `after-800.png` — still fine speckle. Darker clumps are not crowns. Rectangular seams between globe tiles are still there.

A 1024 m photograph already fills a 400 m and an 800 m frame, so the three-offset blend was not hiding a repeat. Removing it did not reveal crowns. The stored canopy is a per-channel Gaussian (Deliot and Heitz) plus the cover-noise remix on a coarse globe grid. That path does not resolve a crown. The next approach is the existing tree impostors drawn at this altitude, not another albedo crop.
