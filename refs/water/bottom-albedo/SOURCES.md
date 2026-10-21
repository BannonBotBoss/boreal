# Bottom albedo for T-0023 (HUMIC.bottom, src/render/water.ts)

Dataset: Vahtmäe, E., Argus, L., Toming, K., Ligi, M., Kutser, T. (2024). Reflectance spectra of submerged aquatic vegetation
(SAV) species and substrates from the Baltic Sea coastal waters. PANGAEA, https://doi.org/10.1594/PANGAEA.971518 (CC BY 4.0).
Paper: Vahtmäe et al. (2025), Earth Syst. Sci. Data 17: 1685-1692, https://doi.org/10.5194/essd-17-1685-2025.
Wet samples taken out of the water, Ramses Lu/Ed (Rrs, sr⁻¹); irradiance reflectance = π · Rrs (paper sec. 2.2).

`pangaea-ab.out` (R, G, B = 610, 550, 466 nm, the HUMIC.nm channels; downloaded 2026-10-21 14:24 PDT):
- 4 sand samples: R 0.092-0.309, G 0.087-0.265, B 0.070-0.210 (mean 0.192 / 0.167 / 0.132); gravel 0.124 / 0.112 / 0.060;
  pebble 0.331 / 0.310 / 0.261; limestone plate 0.59 / 0.57 / 0.48.
- Dark covers: decaying beach-cast algae 0.015-0.031; SAV group means 0.037-0.062 (R, G), ~0.020 (B).
- Game HUMIC.bottom 0.16 / 0.13 / 0.09 = a sand-and-stones bottom (the reference t0023-noon.png shows brown stones and sand);
  it sits between sand sample 1 (0.144 / 0.124 / 0.098) and the sand mean. An organic (gyttja/detritus) or vegetated bottom
  would be 0.02-0.06 (agy's comment 13:42 cites 0.03-0.07; the dataset's dark covers agree).
- Limits: Baltic coastal, not a boreal lake; Kutser et al. 2020 (via the IOCCG benthic proposal, Dierssen 2016) report that
  bottom types share optical signatures across freshwater and sea, which is why a sea library is used for a lake bottom.
