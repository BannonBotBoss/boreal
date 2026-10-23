# Skill: planet solar budget (one cell)

When to use: the instantaneous energy at a point on the globe (zenith, top-of-atmosphere insolation, absorbed, reflected, outgoing longwave). T-0057.

Steps
1. Call `solarBudget(seed, day, hour, direction, cloud)` in `src/core/planet/solarBudget.ts`. It stores nothing. Do not add Berger 1978, and do not add a zonal Budyko–Sellers model beside the column.
2. Zenith and TOA are `solar()` (NOAA / Spencer 1971) at that direction's latitude and longitude, with `SITE.tz`, so a direction built from `PLANET.home.latDeg` and `SITE.lon` matches `solar(day, hour, PLANET.home.latDeg)`.
3. Albedo is `SURFACE.water.albedo` on ocean and lakes, and the Rec. 709 luminance of `surfaceColour` on land (those vertex colours are linear albedo).
4. Absorbed and reflected split `shortwave()` (Meinel & Meinel, Kasten & Czeplak), using the same Earth–Sun factor as `solar().toa`. Outgoing longwave is `columnLongwave().up`, the upward term `surfaceBalance` already uses (Brutsaert 1975, Crawford & Duchon 1999, emissivity 0.98). Temperature is the Kenora `climate()` column.
5. The globe draws `aAbsorbed` on the existing tile material (`tile.ts`). `solarLayerOn(tier)` is false when that row of `CLOUDS.octaves` is 0 (Minimum). `setSolarLayer` is the uniform. No new mesh and no new quality ladder.
6. Gate: `tests/solar-budget.test.ts`. A function that pins the latitude to Kenora fails the winter-equator check. A missing `aAbsorbed` on a tier with octaves above 0 fails `solarLayerGate`.

Mistakes to avoid: moving `sunPosition(hour)` in the sky (T-0022 still owns that call). Passing a stored cloud field (T-0059). Treating outgoing longwave as the net. Wiring the hare paw pole (T-0044) into this branch.
