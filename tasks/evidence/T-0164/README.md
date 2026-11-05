# T-0164 continentality check at 64.5, -119.7

Measured by `tests/continentality-nwt.test.ts` with `seaLevelZoneSeasonAtC`, `siteMaritimeWeight`, `continentalityRatio`, `treeLineAtM`, and `coverKind`. The warm-quarter helper matches `seaLevelZoneSeasonAtC` to under 1e-9 °C at `zone_season_fraction`. The same helper at fraction 1/12 is the July equivalent used only against July normals. It is not the 6.4 °C root-zone line.

Coast distance is 156 km, the census figure in `species.rs` and the T-0132 live grid. Decay length is the existing boundary-layer fetch, 21.4 km, so that coast is already the continental end member (maritime weight 0.000685).

## Click

| quantity | value | definition |
|---|---|---|
| maritime weight | 0.000685 | `siteMaritimeWeight(156000)` |
| continentality ratio | 1.3446 | existing land/ocean damping mix over the 0.7 band |
| warm-quarter air at 376 m | 9.25 °C | tree-line season, lapse 0.0065 K/m |
| July-equivalent air at 376 m | 10.91 °C | same sine, fraction 1/12. Not the 6.4 °C line |
| tree line | 813.9 m | `(warm quarter at sea level − 6.4) / 0.0065` |
| warmth above 6.4 °C | 2.85 K | 9.25 − 6.4. Above the ~2 K forest–tundra width |
| cover | boreal | existing rule. Stems 1,952 /ha, inside 1,000–3,000 |

## Stations

Environment and Climate Change Canada, Canadian Climate Normals 1981–2010, daily average temperature. JJA is the mean of June, July and August. Model column is the warm quarter at the station elevation. Continental stations use maritime weight 0, the same end member as the click. Inuvik uses the great-circle distance to Tuktoyaktuk A (weight 0.0027). Tuktoyaktuk uses the shoreline weight 1.

| station | climate id | model warm quarter | station JJA | station July | model colder? |
|---|---|---|---|---|---|
| Yellowknife A | 2204100 | 11.26 °C | 14.83 °C | 17.0 °C | yes, 3.57 K |
| Norman Wells A | 2202800 | 10.90 °C | 15.30 °C | 17.1 °C | yes, 4.40 K |
| Inuvik A | 2202570 | 9.68 °C | 12.23 °C | 14.1 °C | yes, 2.55 K |
| Tuktoyaktuk A | 2203912 | −5.34 °C | 8.77 °C | 11.0 °C | yes, 14.11 K |

GNWT 2008 section 3.4.1 modelled July for Taiga Shield High Subarctic is 13–16 °C. There is no long-term station inside the ecoregion. The click's July equivalent, 10.91 °C, is below that bracket. That July figure is not compared with 6.4 °C.

## Result

No continentality input was too warm. `seasonal_half_range_pole_K` stays 15.5. `zonal_land_fraction` stays 0.7. The 6.4 °C line and the 0.0065 K/m lapse stay as they are. 376 m remains 2.85 K warmer than the growing-season line, so the existing rule stays closed boreal. The task's stop applies: no stem thinning, no tundra relabel, no new class. A rock class above an 80 m tree line would empty the census, so the zonal line is not put back either.

The shoreline formula is much colder than Tuktoyaktuk. That miss is recorded. It is not fitted, and it does not move a site 156 km inland.
