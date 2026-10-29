# T-0089 numbers table

## Hanel hygroscopic growth of the Mie term: f(RH) = (1 - min(RH, cap))^-gamma

gamma = 0.30 (continental aerosol 0.27-0.40; Titos et al. 2016 survey, Atmos. Environ. 141:494). Cap RH = 0.95: f diverges at
RH = 1, and 0.95 is the top of humidified-nephelometer measurements (Titos 2016). Above it the forest sky's Koschmieder fog takes over.
Source law: Hanel 1976, Adv. Geophys. 19:73-188, doi 10.1016/S0065-2687(08)60142-9. Dry Mie coefficient ATMOS.mie = 3.996e-3 /km.

| RH   | f(RH) = Mie multiplier | Mie scattering (/km) | published check |
|------|------------------------|----------------------|-----------------|
| 0.00 | 1.0000 | 3.996e-3 | dry reference |
| 0.50 | 1.2311 | 4.920e-3 | |
| 0.80 | 1.6207 | 6.476e-3 | |
| 0.85 | 1.7678 | | Titos 2016 continental f(85 %) ~ 1.8 (test: within 0.1) |
| 0.90 | 1.9953 | 7.973e-3 | |
| 0.95 | 2.4565 | 9.816e-3 | cap |
| 1.00 | 2.4565 (capped) | 9.816e-3 | finite, = f(0.95) |

## Cloud drift

- Angular rate about the polar axis = u / (R cos lat), R = 6 371 008.8 m, cos lat floored at 0.05.
  Example: u = 15 m/s at 49.77 N = 1.312e-2 rad per game hour (the old fixed 12 m/s at the equator was 6.781e-3).
- Integrated per frame on simulation seconds: d(angle) = weight(rate) x u/(R cos lat) x dWorldSec x 12
  (worldClock.gameSecondsPerWorldSecond). The clock's worldSec already advances at the dial's rate, so the drift is on sim time.
- Hold above Behavioral: weight = 1 - smoothstep(800, 1200, |clockRate()|), the SCALE_BOUNDS edge above 'behavioral'
  (worldClock.ts, #92/#109), the same band resolveObservation blends across.

| clock rate | scale | drift weight |
|-----------:|-------|-------------:|
| 1 | immediate | 1.000 |
| 12 | behavioral | 1.000 |
| 100 | behavioral | 1.000 |
| 800 | behavioral (exit edge) | 1.000 |
| 900 | blend | 0.844 |
| 1000 | blend | 0.500 |
| 1100 | blend | 0.156 |
| 1200 | ecological (enter edge) | 0.000 (held) |
| 1e5 .. 1e9 | seasonal .. evolutionary | 0.000 (held) |

Rewind (negative world-second delta) turns the shell backward, like the sun. No grid booted: drift falls back to the old 12 m/s at the equator, and Mie x 1.
