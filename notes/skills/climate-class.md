# Skill: a climate name from temperature, rain, and the seasons

Use when a place needs a climate class, and when an animal must not branch on that class. Roadmap step 8, issue #100. T-0094. The class is an output. It is not a biome colour and not a behaviour input.

## Steps
1. Read the year with `climateYearAt` in `src/core/climateClass.ts`. It calls `weatherAtLatLon` (the one planet query, T-0082) at the twelve mid-month days already used by `climate_seed.rs` (`15 + 30.4 k`). Each month is seeded, then stepped once by `FOREST_SPIN.dtS`. A zero-length moisture step leaves rain at 0, so that one step is what lets the rain shadow (T-0085) into the total. Temperature on that same read already includes the sea's reach. Do not add a second climate formula, a second grid, or a wasm plane.
2. Classify with `climateClass(tempC, precipMm)`. Twelve monthly temperatures in °C, January first, and twelve monthly rain totals in mm. The mean is the average temperature. The sum is the yearly rain. The hottest month minus the coldest month is how strong the temperature seasons are. Summer is whichever of April–September and October–March is warmer (Peel et al. 2007). When those two means are equal, neither block is summer: the 70% adjustment is not applied, and the rain-season letter is "no dry season". That tie is not a published threshold.
3. The boundaries are Peel, Finlayson and McMahon 2007, Hydrol. Earth Syst. Sci. 11:1633–1644, Table 1, plus the Herberton tie-break in the text. doi:10.5194/hess-11-1633-2007. Arid is decided first. The PDF's "hottest month above 10 °C" and "months above 10 °C" win over the authors' later HTML list, which uses "at or above". The very-cold letter is that HTML list of the same table: coldest month below −38 °C, and only when the summer is not already hot or warm. Constants live in `PEEL`. There are 30 symbols in `KOPPEN_IDS`.
4. Issue #100's four example names (tropical forest, temperate forest, grassland, desert) have no published bounds. Do not add them as a second scheme. Issue #101's 35 °C span is not a threshold.
5. Deer and wolves read depth, degrees, wind, and food. They do not read `climateClass`, `KOPPEN_IDS`, or `KOPPEN_NAME`. The picture does not import the module. `surfaceColour` and the surface bands stay as they are.
6. A month's millimetres are the grid's daily rate times `365/12`. The grid year is 365 days. That share is not a new climate constant.

## Checks that prove it worked
- `tests/climate-class.test.ts`. Herberton Post Office, Peel's own tie-break station, is `Cwa`. A hot dry place is `BWh` rather than tropical. Exactly 70% of the rain in the warm half crosses into steppe; the same rain spread evenly does not. The coldest month at 0 °C is cold, just above 0 °C is temperate. The hottest month at 10 °C is tundra. A month at exactly 10 °C does not count toward a warm summer. The coldest month at −38 °C is not the very-cold letter; below −38 °C is.
- The same file asserts behaviour sources (`src/core/needs`, `animalBehavior.ts`, `agent.ts`, `plan.ts`, `wolfModes.ts`, the behaviour pose and data, `sim/index.ts`) do not mention the class, and that `src/main.ts`, `src/render`, `src/world`, and `src/ui` do not either.
- On a booted grid, through `climateYearAt`: the ocean cell's seasonal range is smaller than the inland cell's, and the windward yearly rain is greater than the leeward yearly rain. Both classes are symbols from the same function.
- `npx tsc --noEmit` and `npm test`. Rust is not edited, so `cargo test` is not this step. Frame N/A: the class is not drawn.

## Mistakes to avoid
- A second climate, or editing `weather.ts`, `planetWeather.ts`, or `precipitation.rs` to force a class. Those files are the feed. This module only reads them.
- Using issue #100's example names as if "high" and "low" were millimetres.
- Following the HTML list's "hottest month at or above 10 °C" when the PDF says above. A hottest month of exactly 10 °C is polar.
- Letting an animal, a colour band, or a draw file import the class. Habitat may learn about the place later. It still must not hand the symbol to a deer or a wolf.
- Treating the yearly rain as a 30-year station normal. It is twelve mid-month rates from this planet, each held for an equal share of the 365-day year.
- Calling a class wrong because the model's range misses a real station. Record the miss. Do not move a Peel threshold to hide it.
