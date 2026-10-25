# Log arena decay

Use this when a fallen bole should lose mass from the site it lies in, and that mass should show up in the ground column. One module (`src/core/logDecay.ts`) owns the rates. Do not add a per-frame decay clock, and do not redraw the log mesh here.

## Steps

1. Register one row per site factor on `TRANSACTIONS`, with `needsContact: false` and a verb. The pair can carry more than one row, so the verb is required: `log|water#wet`, `log|oxygen#air`, `log|sun#sun`, `log|insects#feed`. Each `run` takes `{ wet, light, age }` and returns a factor. Put the citation on `source`.
2. Take the field mass-loss rate as `ln(2) / 19` per year (Yatskov, Harmon & Krankina 2003, Picea abies at St. Petersburg). That k already includes the climate. Do not multiply it by the CBM Q10.
3. Moisture factor is `min(1, mc / 0.431)`. Map site wetness from fiber saturation 0.30 (wetness 0) to the class III mean 1.42 g/g (wetness 1). Full sun dries that moisture to fiber saturation. Label that mix as game calibration. Yatskov found no extra temperature term among boreal sites, so sun is drying only.
4. Oxygen factor is `0.027 / 0.034` when `wet` is above `SATURATED_WET`, else 1. Those two k values are respiration rates from Bond-Lamberty et al. 2002 §3.4. Use the ratio only.
5. Insects are 0.15 of early loss for 3 years (Ulyshen 2016, midpoint of 10–20%, first 2–3 years) when the wood is at the moisture breakpoint and aerobic. Then the early rate equals the late rate, because the field k already includes them. When they are absent, the early rate is the late rate times 0.85 for those 3 years only.
6. Decay class is five equal steps across 100 years at the reference rate (Storaunet & Rolstad 2002, linear in class; this chain already has five classes, not their eight). `floor(1 + 4 * min(1, tEff / 100))`. Class 5 starts at year 100. Do not use `round` (that reaches class 5 at 87.5 years).
7. Floor stock is the closed form of `dW/dt = -a W` and `dD/dt = -kFloor D + pass a W`, in two pieces (the first 3 years, then the rest). `pass` is the duff `toNext` (0.17). `kFloor` is `rates()[2]`. Respiration is `(1 - pass)` of each loss. Pass `kFloor` and `pass` in. Do not import `ground.ts` from `logDecay.ts`.
8. Split dry mass across the ground cells the axis crosses (`cellsUnder`). The bole stays the mesh. The floor stock `D`, per cell area, is a `wood` layer under the humus and above the peat. Bulk 108 kg/m³ (Yatskov class 5). Do not add it to the CBM pools and do not let it match the organic-footing regex.
9. On a placed log, `place()` writes `by` on oxidized, insected, wetted, sunned, rotting, and decaying. Fall age is `fallFraction(seed) * standAge + logYears()`. `whyOf` without a seed uses 0.5. Register the year clock with `setLogYears` from `ground.ts`. Do not import `ground.ts` from `why.ts`. Leave the buried sentence as it is.

## Files

- `src/core/logDecay.ts` — rates, class, floor integral, dry mass, cells, year hook.
- `src/core/ground.ts` — wood layer inside `columnRaw`. Cache log sites per chunk.
- `src/core/flora/site.ts` — `SATURATED_WET` (the existing 0.85 cut).
- `src/core/why.ts` — `by` text only. No new steps (`WHY_MAX` is 24; the log chain is 23).
- `src/core/transactions.ts` — unchanged. Rows register on import of `logDecay.ts`.

## Checks

- `npx tsc --noEmit`
- `npm test` — `tests/log-decay.test.ts` holds the half-life, the class-5 year, the position order, conservation, and the inspector phrases.
- A known match (19 years, 100 years, wet shade ahead of dry sun and of a bog) scores at least 0.95. Reading 19 as 100 scores 0.19. Reading `ln(2)/0.03` as 19 years scores about 0.784.
- `tests/contact.test.ts` and `tests/why-place.test.ts` still expect the buried line `resting on the ground, becoming forest floor (one more trunk cycle)`.
- `tests/rocks.test.ts` still expects rock height above `column.organic`. The wood layer must stay out of that sum.

## Mistakes

- Multiplying the 19-year field k by Q10 double-counts the climate.
- Treating Bond-Lamberty's 0.034 and 0.027 as the mass-loss k replaces the 19-year half-life. Only their ratio is the oxygen factor.
- A saturated bog is slower than mesic shade, not faster. Moisture below 43.1% also slows decay. Wet shade is the fast case. Dry sun and a bog are both slower.
- `Math.round` on the class index marks class 5 at 87.5 years and fails the 100-year gate.
- Importing `ground.ts` from `logDecay.ts` or from `why.ts` cycles. Pass the floor rate in, and register the clock with `setLogYears`.
- Reading drawn crowns from inside `generateChunk` overflows the stack. The column asks `siteAt` with crowns false, the same way placement does.
- Adding the bole residue to the stand cwd pool, or folding the wood layer into `organic`, double-counts the litter or changes pebble burial.
- Changing the buried step text changes `nowText` and breaks the contact tests.
- Giving insects their own extra 15% on top of the field k moves the reference half-life off 19 years.
